import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import EfiPay, { type SdkOptions } from 'sdk-node-apis-efi';
import type { ApiGroup, SensitiveToolName, ToolDefinition } from '../catalog/index.js';
import type { RuntimeSdkOptions } from '../config/runtime.js';
import { registerPixReceiptResource } from './receiptResource.js';
import { DEFAULT_SERVER_LIMITS, ToolRequestGuard, type ServerLimits } from './requestGuard.js';
import {
  registerCatalogTools,
  type EfiPayClientProvider,
  type RegisterCatalogToolsOptions,
} from './toolFactory.js';

export const SERVER_INFO = {
  name: 'mcp-server-efi',
  title: 'Servidor MCP Efí',
  version: '1.0.1',
  description: 'Servidor MCP tipado para as APIs da Efí.',
  websiteUrl: 'https://github.com/efipay/mcp-server-efi',
  icons: [
    {
      src: 'https://github.com/efipay.png?size=512',
      mimeType: 'image/png',
    },
  ],
};

export interface CreateServerOptions {
  sdk: RuntimeSdkOptions;
  enabledApis: ReadonlySet<ApiGroup>;
  allowedSensitiveTools?: ReadonlySet<SensitiveToolName>;
  limits?: ServerLimits;
  client?: EfiPay;
  clientFactory?: (sdk: SdkOptions) => EfiPay;
  fetch?: typeof fetch;
}

function configuredValue(value: string | undefined): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function missingAuthenticationError(
  definition: ToolDefinition,
  variables: readonly string[],
): Error {
  return new Error(
    `A tool ${definition.name} exige configuração de autenticação antes da chamada HTTP. ` +
      `Defina ${variables.join(' e ')} no ambiente do servidor MCP.`,
  );
}

function createClientProvider(options: CreateServerOptions): EfiPayClientProvider {
  if (options.client) return () => options.client as EfiPay;

  let remoteClient: EfiPay | undefined;
  let localClient: EfiPay | undefined;
  const instantiate = options.clientFactory ?? ((sdk: SdkOptions) => new EfiPay(sdk));

  return (definition) => {
    if (definition.httpMethod === 'local') {
      // O SDK 2.0.0 exige credenciais no construtor, embora pixGenerateStaticQRCode seja
      // inteiramente local. Os valores sentinela nunca são usados em autenticação ou tráfego.
      localClient ??= instantiate({
        sandbox: options.sdk.sandbox,
        client_id: 'mcp-local-operation',
        client_secret: 'mcp-local-operation',
        cache: false,
      });
      return localClient;
    }

    const clientId = configuredValue(options.sdk.client_id);
    const clientSecret = configuredValue(options.sdk.client_secret);
    const missing = [
      ...(clientId ? [] : ['EFI_CLIENT_ID']),
      ...(clientSecret ? [] : ['EFI_CLIENT_SECRET']),
    ];
    if (missing.length > 0) throw missingAuthenticationError(definition, missing);
    if (!clientId || !clientSecret) {
      throw missingAuthenticationError(definition, ['EFI_CLIENT_ID', 'EFI_CLIENT_SECRET']);
    }

    if (definition.api !== 'cobrancas' && !configuredValue(options.sdk.certificate)) {
      throw missingAuthenticationError(definition, ['EFI_CERTIFICATE']);
    }

    if (!remoteClient) {
      const sdkOptions: SdkOptions = {
        ...options.sdk,
        client_id: clientId,
        client_secret: clientSecret,
      };
      remoteClient = instantiate(sdkOptions);
    }
    return remoteClient;
  };
}

export function createServer(options: CreateServerOptions): McpServer {
  const server = new McpServer(SERVER_INFO);
  const clientProvider = createClientProvider(options);
  const secretValues = [
    options.sdk.client_id,
    options.sdk.client_secret,
    options.sdk.certificate,
    options.sdk.pemKey,
    options.sdk.partner_token,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  const requestGuard = new ToolRequestGuard(options.limits ?? DEFAULT_SERVER_LIMITS);
  const registrationOptions: RegisterCatalogToolsOptions = {
    allowedSensitiveTools: options.allowedSensitiveTools,
    requestGuard,
    secretValues,
    fetch: options.fetch,
  };
  registerCatalogTools(server, clientProvider, options.enabledApis, registrationOptions);
  if (options.enabledApis.has('pix')) {
    registerPixReceiptResource(server, clientProvider, { requestGuard, secretValues });
  }
  return server;
}
