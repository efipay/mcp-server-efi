import { randomInt } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolResult,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type EfiPay from 'sdk-node-apis-efi';
import { z } from 'zod';
import type { ApiGroup, ToolDefinition } from '../catalog/index.js';
import {
  inputSchemaFor,
  outputSchemaFor,
  SENSITIVE_TOOL_NAMES,
  TOOL_CATALOG,
} from '../catalog/index.js';
import { describePublicSchema } from '../catalog/schemaDescriptions.js';
import { MAX_SANITIZED_ERROR_LENGTH, sanitizeError } from './errorSanitizer.js';
import { inspectPixQrCode, type PixQrCodeVerification } from './pixQrCodeVerification.js';
import { ToolRequestGuard } from './requestGuard.js';

export { sanitizeError } from './errorSanitizer.js';

export type ToolInput = {
  params?: unknown;
  body?: unknown;
  idempotency_key?: string;
};

interface RegisteredToolRuntime {
  definition: ToolDefinition;
  handler: ReturnType<typeof createToolHandler>;
  inputSchema: ReturnType<typeof inputSchemaFor>;
  outputSchema: ReturnType<typeof outputSchemaFor>;
  publicDefinition: Tool;
}

class InternalToolError extends Error {
  override readonly name = 'InternalToolError';
}

function stringify(value: unknown): string {
  const serialized = JSON.stringify(value, undefined, 2);
  if (serialized === undefined) {
    throw new InternalToolError('Não foi possível serializar o resultado da operação.');
  }
  return serialized;
}

function apiErrorResult(
  error: unknown,
  secretValues: readonly string[],
  idempotencyKey?: string,
): CallToolResult {
  const sanitized = sanitizeError(error, secretValues);
  const payload = idempotencyKey ? { ...sanitized, idempotency_key: idempotencyKey } : sanitized;
  let text = stringify(payload);
  if (text.length > MAX_SANITIZED_ERROR_LENGTH) {
    text = stringify({
      message: 'A resposta de erro excedeu o limite seguro de serialização.',
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    });
  }
  return {
    isError: true,
    content: [{ type: 'text', text }],
  };
}

function rateLimitResult(retryAfterMs: number): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: stringify({
          error: 'rate_limit_exceeded',
          retry_after_ms: retryAfterMs,
        }),
      },
    ],
  };
}

function inputErrorResult(definition: ToolDefinition, issues: unknown): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: stringify({
          message: `Argumentos inválidos para a tool ${definition.name}.`,
          issues: sanitizeError(issues),
        }),
      },
    ],
  };
}

const RECEIPT_PARAMETER_NAMES = ['txid', 'e2eid', 'idEnvio', 'rtrId'] as const;
export type ReceiptParameterName = (typeof RECEIPT_PARAMETER_NAMES)[number];

export function receiptIdentity(input: ToolInput): {
  type: ReceiptParameterName;
  id: string;
} {
  const params = (input.params ?? {}) as Record<string, unknown>;
  const matches = RECEIPT_PARAMETER_NAMES.flatMap((type) => {
    const value = params[type];
    return typeof value === 'string' && value.length > 0 ? [{ type, id: value }] : [];
  });
  if (matches.length !== 1) {
    throw new InternalToolError(
      'O contrato de comprovante deve produzir exatamente um identificador Pix.',
    );
  }
  return matches[0];
}

function pdfResult(definition: ToolDefinition, input: ToolInput, result: unknown): CallToolResult {
  if (!Buffer.isBuffer(result)) {
    throw new InternalToolError(`O método ${definition.method} não retornou um Buffer PDF.`);
  }

  const identity = receiptIdentity(input);
  const uri = `efi://pix/comprovantes/${identity.type}/${encodeURIComponent(identity.id)}.pdf`;
  const structuredContent = {
    result: {
      uri,
      mimeType: 'application/pdf' as const,
      identifier: identity,
    },
  };

  return {
    content: [
      {
        type: 'text',
        text: stringify(structuredContent),
      },
      {
        type: 'resource',
        resource: {
          uri,
          blob: result.toString('base64'),
          mimeType: 'application/pdf',
        },
      },
    ],
    structuredContent,
  };
}

function imageContent(result: unknown): CallToolResult['content'][number] | undefined {
  if (typeof result !== 'object' || result === null || !('imagemQrcode' in result)) {
    return undefined;
  }
  const image = (result as { imagemQrcode?: unknown }).imagemQrcode;
  if (typeof image !== 'string') return undefined;

  const validBase64 = (value: string): string | undefined => {
    const normalized = value.replace(/\s/g, '');
    if (
      normalized.length === 0 ||
      normalized.length % 4 !== 0 ||
      !/^(?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?$/i.test(normalized)
    ) {
      return undefined;
    }
    const canonical = Buffer.from(normalized, 'base64').toString('base64');
    return canonical === normalized ? normalized : undefined;
  };

  const dataUrl = image.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is);
  if (dataUrl) {
    const data = validBase64(dataUrl[2]);
    return data ? { type: 'image', mimeType: dataUrl[1], data } : undefined;
  }

  const data = validBase64(image);
  if (data) return { type: 'image', mimeType: 'image/png', data };

  return undefined;
}

async function successResult(
  definition: ToolDefinition,
  input: ToolInput,
  result: unknown,
  idempotencyKey?: string,
  verification?: PixQrCodeVerification,
): Promise<CallToolResult> {
  if (definition.responseKind === 'pdf') return pdfResult(definition, input, result);

  if (definition.responseKind === 'void') {
    if (result !== undefined) {
      throw new InternalToolError(
        `O método ${definition.method} retornou conteúdo apesar do contrato void do SDK 2.0.0.`,
      );
    }
    const canonical = { success: true } as const;
    return {
      content: [{ type: 'text', text: stringify(canonical) }],
      structuredContent: canonical,
    };
  }

  const parsed = await definition.responseSchema?.safeParseAsync(result);
  if (!parsed?.success) {
    const detail = parsed ? parsed.error.message : 'schema de resposta ausente';
    throw new InternalToolError(
      `A resposta de ${definition.method} não corresponde ao contrato do SDK 2.0.0: ${detail}`,
    );
  }

  const canonical = parsed.data;
  if (definition.method === 'pixQrCodeDetail' && !verification) {
    throw new InternalToolError('A inspeção do QR Code Pix não produziu dados de verificação.');
  }
  const structuredContent = {
    result: canonical,
    ...(verification ? { verification } : {}),
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
  };
  const content: CallToolResult['content'] = [{ type: 'text', text: stringify(structuredContent) }];
  if (definition.responseKind === 'qr') {
    const image = imageContent(canonical);
    if (image) content.push(image);
  }

  return {
    content,
    structuredContent,
  };
}

const IDEMPOTENCY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const sensitiveToolNames = new Set<string>(SENSITIVE_TOOL_NAMES);

export type EfiPayClientProvider = (definition: ToolDefinition) => EfiPay;

export function generateIdempotencyKey(): string {
  return Array.from(
    { length: 72 },
    () => IDEMPOTENCY_ALPHABET[randomInt(IDEMPOTENCY_ALPHABET.length)],
  ).join('');
}

export interface ToolHandlerOptions {
  allowedSensitiveTools?: ReadonlySet<string>;
  requestGuard?: ToolRequestGuard;
  secretValues?: readonly string[];
  fetch?: typeof fetch;
}

export function createToolHandler(
  definition: ToolDefinition,
  clientProvider: EfiPay | EfiPayClientProvider,
  options: ToolHandlerOptions = {},
) {
  return async (input: ToolInput): Promise<CallToolResult> => {
    if (
      sensitiveToolNames.has(definition.name) &&
      !options.allowedSensitiveTools?.has(definition.name)
    ) {
      return apiErrorResult(
        new Error(
          `A execução de ${definition.name} está bloqueada porque sua resposta contém material ` +
            'sensível. Configure EFI_SENSITIVE_TOOLS e ' +
            'EFI_ACCEPT_SENSITIVE_OUTPUT_RISK=I_UNDERSTAND para autorizar explicitamente.',
        ),
        options.secretValues ?? [],
      );
    }

    const decision = options.requestGuard?.acquire(
      definition,
      sensitiveToolNames.has(definition.name),
    );
    if (decision && !decision.allowed) return rateLimitResult(decision.retryAfterMs);

    const idempotencyKey = definition.acceptsIdempotencyKey
      ? input.idempotency_key || generateIdempotencyKey()
      : undefined;

    try {
      const headers =
        definition.acceptsIdempotencyKey && idempotencyKey
          ? { 'x-idempotency-key': idempotencyKey }
          : undefined;
      if (definition.method === 'pixQrCodeDetail') {
        const body = input.body as { pixCopiaECola?: unknown } | undefined;
        if (typeof body?.pixCopiaECola !== 'string') {
          throw new InternalToolError('O contrato de Pix Copia e Cola não produziu uma string.');
        }
        const inspection = await inspectPixQrCode(
          body.pixCopiaECola,
          options.fetch ?? globalThis.fetch,
        );
        return await successResult(
          definition,
          input,
          inspection.result,
          idempotencyKey,
          inspection.verification,
        );
      }

      const client =
        typeof clientProvider === 'function' ? clientProvider(definition) : clientProvider;
      if (typeof client[definition.method] !== 'function') {
        throw new InternalToolError(`O SDK não expõe o método ${definition.method}.`);
      }
      const result = await definition.invoke(
        client,
        { params: input.params, body: input.body },
        headers,
      );
      return await successResult(definition, input, result, idempotencyKey);
    } catch (error) {
      if (error instanceof InternalToolError) throw error;
      return apiErrorResult(error, options.secretValues ?? [], idempotencyKey);
    } finally {
      if (decision?.allowed) decision.lease.release();
    }
  };
}

function internalError(error: unknown): McpError {
  const sanitized = sanitizeError(error);
  const message =
    typeof sanitized === 'object' && sanitized !== null && 'message' in sanitized
      ? String((sanitized as { message: unknown }).message)
      : 'Falha interna ao executar a tool.';
  return new McpError(ErrorCode.InternalError, message, sanitized);
}

function installStrictToolCallHandler(
  server: McpServer,
  registeredTools: ReadonlyMap<string, RegisteredToolRuntime>,
): void {
  // `McpServer.server` and `Server.setRequestHandler` are public APIs. Replacing the high-level
  // tools/call handler avoids its intentional conversion of every McpError into a tool result,
  // allowing unknown tools and broken server contracts to remain JSON-RPC errors.
  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const runtime = registeredTools.get(request.params.name);
    if (!runtime) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Tool ${request.params.name} não encontrada ou não habilitada.`,
      );
    }

    if (request.params.task) {
      throw new McpError(ErrorCode.InvalidParams, 'Este servidor não oferece execução por tasks.');
    }

    let parsedInput: Awaited<ReturnType<typeof runtime.inputSchema.safeParseAsync>>;
    try {
      parsedInput = await runtime.inputSchema.safeParseAsync(request.params.arguments ?? {});
    } catch (error) {
      throw internalError(error);
    }
    if (!parsedInput.success) {
      return inputErrorResult(runtime.definition, parsedInput.error.issues);
    }

    let result: CallToolResult;
    try {
      result = await runtime.handler(parsedInput.data);
    } catch (error) {
      throw internalError(error);
    }

    if (!result.isError && runtime.outputSchema) {
      let parsedOutput: Awaited<ReturnType<typeof runtime.outputSchema.safeParseAsync>>;
      try {
        parsedOutput = await runtime.outputSchema.safeParseAsync(result.structuredContent);
      } catch (error) {
        throw internalError(error);
      }
      if (!parsedOutput.success) {
        throw internalError(
          new InternalToolError(
            `A saída da tool ${runtime.definition.name} não corresponde ao outputSchema publicado.`,
          ),
        );
      }
    }

    return result;
  });
}

function protocolObjectSchema(
  schema: ReturnType<typeof inputSchemaFor>,
  definition: ToolDefinition,
  purpose: 'entrada',
): Tool['inputSchema'];
function protocolObjectSchema(
  schema: NonNullable<ReturnType<typeof outputSchemaFor>>,
  definition: ToolDefinition,
  purpose: 'saída',
): NonNullable<Tool['outputSchema']>;
function protocolObjectSchema(
  schema: ReturnType<typeof inputSchemaFor> | NonNullable<ReturnType<typeof outputSchemaFor>>,
  definition: ToolDefinition,
  purpose: 'entrada' | 'saída',
): Tool['inputSchema'] {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7' });
  if (jsonSchema.type !== 'object') {
    throw new InternalToolError('Schemas MCP de entrada e saída devem possuir raiz object.');
  }
  return describePublicSchema(
    jsonSchema as Record<string, unknown>,
    definition,
    purpose,
  ) as Tool['inputSchema'];
}

function publicToolDefinition(
  definition: ToolDefinition,
  inputSchema: ReturnType<typeof inputSchemaFor>,
  outputSchema: ReturnType<typeof outputSchemaFor>,
): Tool {
  return {
    name: definition.name,
    title: definition.title,
    description: definition.description,
    inputSchema: protocolObjectSchema(inputSchema, definition, 'entrada'),
    ...(outputSchema
      ? { outputSchema: protocolObjectSchema(outputSchema, definition, 'saída') }
      : {}),
    annotations: definition.annotations,
  };
}

function installPublicToolListHandler(
  server: McpServer,
  registeredTools: ReadonlyMap<string, RegisteredToolRuntime>,
): void {
  // MCP SDK 1.29 includes `execution.taskSupport = forbidden` on every high-level registration.
  // This server does not expose Tasks, so the public low-level API is used to publish only the
  // interoperable fields that it intentionally supports. Registration itself remains high-level.
  server.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [...registeredTools.values()].map(({ publicDefinition }) => publicDefinition),
  }));
}

export function registerCatalogTools(
  server: McpServer,
  clientProvider: EfiPayClientProvider,
  enabledApis: ReadonlySet<ApiGroup>,
  options: RegisterCatalogToolsOptions = {},
): number {
  const registeredTools = new Map<string, RegisteredToolRuntime>();
  const requestGuard = options.requestGuard;

  for (const definition of TOOL_CATALOG) {
    if (!enabledApis.has(definition.api)) continue;

    const inputSchema = inputSchemaFor(definition);
    const outputSchema = outputSchemaFor(definition);
    const handler = createToolHandler(definition, clientProvider, {
      allowedSensitiveTools: options.allowedSensitiveTools,
      requestGuard,
      secretValues: options.secretValues,
      fetch: options.fetch,
    });
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema,
        outputSchema,
        annotations: definition.annotations,
      },
      handler,
    );
    registeredTools.set(definition.name, {
      definition,
      handler,
      inputSchema,
      outputSchema,
      publicDefinition: publicToolDefinition(definition, inputSchema, outputSchema),
    });
  }

  installPublicToolListHandler(server, registeredTools);
  installStrictToolCallHandler(server, registeredTools);
  return registeredTools.size;
}

export interface RegisterCatalogToolsOptions {
  allowedSensitiveTools?: ReadonlySet<string>;
  requestGuard?: ToolRequestGuard;
  secretValues?: readonly string[];
  fetch?: typeof fetch;
}
