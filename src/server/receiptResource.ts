import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type EfiPay from 'sdk-node-apis-efi';
import { TOOL_CATALOG, type ToolDefinition } from '../catalog/index.js';
import type { ToolRequestGuard } from './requestGuard.js';
import {
  sanitizeError,
  type EfiPayClientProvider,
  type ReceiptParameterName,
} from './toolFactory.js';

export const PIX_RECEIPT_URI_TEMPLATE = 'efi://pix/comprovantes/{tipo}/{id}.pdf';

const RECEIPT_TYPES: readonly ReceiptParameterName[] = ['txid', 'e2eid', 'idEnvio', 'rtrId'];

function receiptDefinition(): ToolDefinition {
  const definition = TOOL_CATALOG.find(({ method }) => method === 'pixGetReceipt');
  if (!definition) throw new Error('pixGetReceipt não foi encontrado no catálogo.');
  return definition;
}

const RECEIPT_DEFINITION = receiptDefinition();

function isReceiptParameterName(value: string): value is ReceiptParameterName {
  return RECEIPT_TYPES.some((type) => type === value);
}

function receiptParams(
  type: ReceiptParameterName,
  id: string,
): Parameters<EfiPay['pixGetReceipt']>[0] {
  switch (type) {
    case 'txid':
      return { txid: id };
    case 'e2eid':
      return { e2eid: id };
    case 'idEnvio':
      return { idEnvio: id };
    case 'rtrId':
      return { rtrId: id };
  }
}

function singleVariable(value: string | string[] | undefined, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, `A variável ${name} deve possuir um único valor.`);
  }
  try {
    return decodeURIComponent(value);
  } catch {
    throw new McpError(ErrorCode.InvalidParams, `A variável ${name} contém escape URI inválido.`);
  }
}

export interface PixReceiptResourceOptions {
  requestGuard?: ToolRequestGuard;
  secretValues?: readonly string[];
}

export function registerPixReceiptResource(
  server: McpServer,
  clientProvider: EfiPayClientProvider,
  options: PixReceiptResourceOptions = {},
): void {
  const template = new ResourceTemplate(PIX_RECEIPT_URI_TEMPLATE, { list: undefined });

  server.registerResource(
    'comprovante_pix',
    template,
    {
      title: 'Comprovante Pix em PDF',
      description:
        'Obtém novamente um comprovante Pix a partir do tipo e identificador retornados pela tool pix_get_receipt.',
      mimeType: 'application/pdf',
    },
    async (uri, variables) => {
      const type = singleVariable(variables.tipo, 'tipo');
      if (!isReceiptParameterName(type)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'O tipo do comprovante deve ser txid, e2eid, idEnvio ou rtrId.',
        );
      }
      const id = singleVariable(variables.id, 'id');
      const decision = options.requestGuard?.acquire(RECEIPT_DEFINITION, false);
      if (decision && !decision.allowed) {
        throw new McpError(ErrorCode.InvalidRequest, 'Limite de leitura excedido.', {
          error: 'rate_limit_exceeded',
          retry_after_ms: decision.retryAfterMs,
        });
      }

      let receipt: unknown;
      try {
        const client = clientProvider(RECEIPT_DEFINITION);
        receipt = await client.pixGetReceipt(receiptParams(type, id));
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          'Não foi possível obter o comprovante Pix na Efí.',
          sanitizeError(error, options.secretValues),
        );
      } finally {
        if (decision?.allowed) decision.lease.release();
      }

      if (!Buffer.isBuffer(receipt)) {
        throw new McpError(
          ErrorCode.InternalError,
          'A Efí não retornou o comprovante Pix no formato PDF esperado.',
        );
      }

      return {
        contents: [
          {
            uri: uri.toString(),
            blob: receipt.toString('base64'),
            mimeType: 'application/pdf',
          },
        ],
      };
    },
  );
}
