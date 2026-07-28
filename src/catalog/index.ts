import { z } from 'zod';
import { annotationsFor } from './annotations.js';
import { describeTool } from './descriptions.js';
import { RAW_TOOL_DEFINITIONS } from './raw.js';
import type { EfiMethodName, ToolDefinition } from './types.js';

export { API_GROUPS } from './types.js';
export type {
  ApiGroup,
  CallShape,
  EfiMethodName,
  ToolDefinition,
  ToolInvocationInput,
} from './types.js';

export const SENSITIVE_TOOL_NAMES = [
  'create_account_certificate',
  'get_account_credentials',
  'create_sftp_key',
] as const;

export type SensitiveToolName = (typeof SENSITIVE_TOOL_NAMES)[number];

export const PIX_QR_CODE_VERIFICATION_SCHEMA = z
  .object({
    jku_origin_match: z.boolean().nullable(),
    signature_status: z.enum(['verified', 'invalid', 'unavailable']),
  })
  .strict();

export function methodToToolName(method: string): string {
  return method
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function buildDefinition(raw: (typeof RAW_TOOL_DEFINITIONS)[number]): ToolDefinition {
  const { title, description } = describeTool(raw.method, raw.api, raw.httpMethod);

  return {
    ...raw,
    name: methodToToolName(raw.method),
    title,
    description,
    annotations: annotationsFor(raw.method, raw.httpMethod),
  };
}

export const TOOL_CATALOG: readonly ToolDefinition[] = RAW_TOOL_DEFINITIONS.map(buildDefinition);

export const VOID_METHODS = new Set<EfiMethodName>(
  TOOL_CATALOG.filter(({ responseKind }) => responseKind === 'void').map(({ method }) => method),
);

export function inputSchemaFor(definition: ToolDefinition): z.ZodObject {
  const shape: Record<string, z.ZodType> = {};

  if (definition.paramsSchema) {
    shape.params = definition.optionalParams
      ? definition.paramsSchema.optional()
      : definition.paramsSchema;
  }
  if (definition.bodySchema) {
    shape.body = definition.optionalBody ? definition.bodySchema.optional() : definition.bodySchema;
  }
  if (definition.acceptsIdempotencyKey) {
    shape.idempotency_key = z
      .string()
      .refine((value) => !/[\r\n]/.test(value), {
        message: 'idempotency_key não pode conter CR ou LF.',
      })
      .trim()
      .min(1, 'idempotency_key não pode estar vazia.')
      .optional();
  }

  return z.object(shape).strict();
}

export function outputSchemaFor(definition: ToolDefinition): z.ZodObject | undefined {
  if (definition.responseKind === 'pdf') return undefined;
  if (definition.responseKind === 'void') return z.object({ success: z.literal(true) }).strict();
  if (!definition.responseSchema) return undefined;
  return z
    .object({
      result: definition.responseSchema,
      ...(definition.method === 'pixQrCodeDetail'
        ? { verification: PIX_QR_CODE_VERIFICATION_SCHEMA }
        : {}),
      ...(definition.acceptsIdempotencyKey ? { idempotency_key: z.string() } : {}),
    })
    .strict();
}
