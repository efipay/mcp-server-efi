import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import EfiPay, { type SdkOptions } from 'sdk-node-apis-efi';
import type { ApiGroup, SensitiveToolName } from '../catalog/index.js';
import { registerPixReceiptResource } from './receiptResource.js';
import { DEFAULT_SERVER_LIMITS, ToolRequestGuard, type ServerLimits } from './requestGuard.js';
import { registerCatalogTools } from './toolFactory.js';

export const SERVER_INFO = {
  name: 'mcp-server-efi',
  version: '1.0.0',
  description: 'Servidor MCP tipado para as APIs da Efí.',
} as const;

export interface CreateServerOptions {
  sdk: SdkOptions;
  enabledApis: ReadonlySet<ApiGroup>;
  enabledSensitiveTools?: ReadonlySet<SensitiveToolName>;
  limits?: ServerLimits;
  client?: EfiPay;
  fetch?: typeof fetch;
}

export function createServer(options: CreateServerOptions): McpServer {
  const server = new McpServer(SERVER_INFO);
  const client = options.client ?? new EfiPay(options.sdk);
  const secretValues = [
    options.sdk.client_id,
    options.sdk.client_secret,
    options.sdk.certificate,
    options.sdk.pemKey,
    options.sdk.partner_token,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  const requestGuard = new ToolRequestGuard(options.limits ?? DEFAULT_SERVER_LIMITS);
  registerCatalogTools(server, client, options.enabledApis, {
    enabledSensitiveTools: options.enabledSensitiveTools,
    requestGuard,
    secretValues,
    fetch: options.fetch,
  });
  if (options.enabledApis.has('pix')) {
    registerPixReceiptResource(server, client, { requestGuard, secretValues });
  }
  return server;
}
