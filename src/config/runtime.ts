import { parseArgs } from 'node:util';
import type { SdkOptions } from 'sdk-node-apis-efi';
import {
  API_GROUPS,
  SENSITIVE_TOOL_NAMES,
  TOOL_CATALOG,
  type ApiGroup,
  type SensitiveToolName,
} from '../catalog/index.js';
import { DEFAULT_SERVER_LIMITS, type ServerLimits } from '../server/requestGuard.js';

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export type RuntimeSdkOptions = Omit<SdkOptions, 'client_id' | 'client_secret'> & {
  client_id?: string;
  client_secret?: string;
};

export interface RuntimeConfig {
  sdk: RuntimeSdkOptions;
  enabledApis: ReadonlySet<ApiGroup>;
  allowedSensitiveTools: ReadonlySet<SensitiveToolName>;
  limits: ServerLimits;
}

const cliOptions = {
  sandbox: { type: 'string' },
  'cert-base64': { type: 'string' },
  'validate-mtls': { type: 'string' },
  cache: { type: 'string' },
  apis: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const;

type CliValues = Partial<Record<keyof typeof cliOptions, string | boolean>>;

function isUnresolvedUserConfig(value: unknown): boolean {
  return typeof value === 'string' && /^\$\{user_config\.[^}]+\}$/.test(value.trim());
}

function first(...values: Array<string | boolean | undefined>): string | boolean | undefined {
  return values.find(
    (value) => value !== undefined && value !== '' && !isUnresolvedUserConfig(value),
  );
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' && !isUnresolvedUserConfig(value)
    ? value
    : undefined;
}

function booleanValue(value: unknown, label: string, defaultValue?: boolean): boolean {
  if (value === undefined && defaultValue !== undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  throw new ConfigurationError(`${label} deve ser true, false, 1 ou 0.`);
}

function positiveInteger(value: unknown, label: string, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value.trim()) ||
    !Number.isSafeInteger(Number(value))
  ) {
    throw new ConfigurationError(`${label} deve ser um inteiro positivo.`);
  }
  return Number(value);
}

function apiSelection(value: unknown): ReadonlySet<ApiGroup> {
  if (value === undefined || value === '') return new Set(API_GROUPS);
  if (typeof value !== 'string') throw new ConfigurationError('apis deve ser uma lista textual.');

  const requested = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (requested.length === 0) throw new ConfigurationError('apis não pode ser uma seleção vazia.');

  const valid = new Set<string>(API_GROUPS);
  const unknown = requested.filter((api) => !valid.has(api));
  if (unknown.length > 0) {
    throw new ConfigurationError(
      `APIs desconhecidas: ${unknown.join(', ')}. Valores aceitos: ${API_GROUPS.join(', ')}.`,
    );
  }
  return new Set(requested as ApiGroup[]);
}

function parseCli(argv: readonly string[]): CliValues {
  try {
    return parseArgs({
      args: [...argv],
      options: cliOptions,
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigurationError(`Argumentos inválidos: ${message}`);
  }
}

function sensitiveToolSelection(
  toolsValue: unknown,
  acceptanceValue: unknown,
  enabledApis: ReadonlySet<ApiGroup>,
): ReadonlySet<SensitiveToolName> {
  const tools = optionalString(toolsValue);
  const acceptance = optionalString(acceptanceValue);
  if (!tools && !acceptance) return new Set();
  if (!tools || !acceptance) {
    throw new ConfigurationError(
      'EFI_SENSITIVE_TOOLS e EFI_ACCEPT_SENSITIVE_OUTPUT_RISK devem ser informadas juntas.',
    );
  }
  if (acceptance !== 'I_UNDERSTAND') {
    throw new ConfigurationError(
      'EFI_ACCEPT_SENSITIVE_OUTPUT_RISK deve possuir exatamente o valor I_UNDERSTAND.',
    );
  }

  const requested = tools
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const allowed = new Set<string>(SENSITIVE_TOOL_NAMES);
  const unknown = requested.filter((name) => !allowed.has(name));
  if (requested.length === 0 || unknown.length > 0) {
    throw new ConfigurationError(
      `EFI_SENSITIVE_TOOLS aceita somente nomes explícitos: ${SENSITIVE_TOOL_NAMES.join(', ')}.`,
    );
  }

  const disabledByApi = requested.filter((name) => {
    const definition = TOOL_CATALOG.find((tool) => tool.name === name);
    return !definition || !enabledApis.has(definition.api);
  });
  if (disabledByApi.length > 0) {
    throw new ConfigurationError(
      `Tools sensíveis selecionadas em APIs desabilitadas: ${disabledByApi.join(', ')}.`,
    );
  }
  return new Set(requested as SensitiveToolName[]);
}

export function loadRuntimeConfig(
  argv: readonly string[] = process.argv.slice(2),
  processEnv: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const cli = parseCli(argv);
  if (cli.help === true) throw new ConfigurationError('HELP');

  const enabledApis = apiSelection(first(cli.apis, processEnv.EFI_APIS, processEnv.APIS));
  const allowedSensitiveTools = sensitiveToolSelection(
    processEnv.EFI_SENSITIVE_TOOLS,
    processEnv.EFI_ACCEPT_SENSITIVE_OUTPUT_RISK,
    enabledApis,
  );
  const certificate = optionalString(processEnv.EFI_CERTIFICATE);

  const sdk: RuntimeSdkOptions = {
    sandbox: booleanValue(
      first(cli.sandbox, processEnv.EFI_SANDBOX, processEnv.SANDBOX),
      'sandbox',
      true,
    ),
    client_id: optionalString(processEnv.EFI_CLIENT_ID),
    client_secret: optionalString(processEnv.EFI_CLIENT_SECRET),
    certificate,
    pemKey: optionalString(processEnv.EFI_PEM_KEY),
    cert_base64: booleanValue(
      first(cli['cert-base64'], processEnv.EFI_CERT_BASE64, processEnv.CERT_BASE64),
      'cert-base64',
      true,
    ),
    partner_token: optionalString(processEnv.EFI_PARTNER_TOKEN),
    validateMtls: booleanValue(
      first(cli['validate-mtls'], processEnv.EFI_VALIDATE_MTLS, processEnv.VALIDATE_MTLS),
      'validate-mtls',
      true,
    ),
    cache: booleanValue(first(cli.cache, processEnv.EFI_CACHE, processEnv.CACHE), 'cache', true),
  };

  const limits: ServerLimits = {
    maxConcurrency: positiveInteger(
      processEnv.EFI_MAX_CONCURRENCY,
      'EFI_MAX_CONCURRENCY',
      DEFAULT_SERVER_LIMITS.maxConcurrency,
    ),
    mutationMaxConcurrency: positiveInteger(
      processEnv.EFI_MUTATION_MAX_CONCURRENCY,
      'EFI_MUTATION_MAX_CONCURRENCY',
      DEFAULT_SERVER_LIMITS.mutationMaxConcurrency,
    ),
    readRatePerMinute: positiveInteger(
      processEnv.EFI_READ_RATE_PER_MINUTE,
      'EFI_READ_RATE_PER_MINUTE',
      DEFAULT_SERVER_LIMITS.readRatePerMinute,
    ),
    mutationRatePerMinute: positiveInteger(
      processEnv.EFI_MUTATION_RATE_PER_MINUTE,
      'EFI_MUTATION_RATE_PER_MINUTE',
      DEFAULT_SERVER_LIMITS.mutationRatePerMinute,
    ),
    sensitiveRatePerMinute: positiveInteger(
      processEnv.EFI_SENSITIVE_RATE_PER_MINUTE,
      'EFI_SENSITIVE_RATE_PER_MINUTE',
      DEFAULT_SERVER_LIMITS.sensitiveRatePerMinute,
    ),
  };

  return { sdk, enabledApis, allowedSensitiveTools, limits };
}

export function helpText(): string {
  return `mcp-server-efi 1.0.2

Uso: mcp-server-efi [opções]

Opções:
  --sandbox=<true|false>       Ambiente de homologação ou produção (padrão: true)
  --apis=<lista>               cobrancas,pix,open-finance,pagamento-contas,abertura-contas,extratos
  --cert-base64=<true|false>   Certificado e PEM estão em base64 (padrão: true)
  --validate-mtls=<booleano>   Proteção mTLS dos webhooks (padrão/recomendado: true)
  --cache=<true|false>         Cache OAuth do SDK (padrão: true)
  -h, --help                   Exibe esta ajuda

Credenciais (somente via ambiente):
  EFI_CLIENT_ID                Client ID, exigido ao chamar endpoints HTTP
  EFI_CLIENT_SECRET            Client secret, exigido ao chamar endpoints HTTP
  EFI_CERTIFICATE              Certificado, exigido ao chamar APIs mTLS
  EFI_PEM_KEY                  Chave privada do certificado PEM
  EFI_PARTNER_TOKEN            Token de parceiro, quando aplicável

Opt-in de respostas sensíveis:
  EFI_SENSITIVE_TOOLS          Lista explícita de tools sensíveis
  EFI_ACCEPT_SENSITIVE_OUTPUT_RISK=I_UNDERSTAND

Contenção (padrões):
  EFI_MAX_CONCURRENCY=4
  EFI_MUTATION_MAX_CONCURRENCY=1
  EFI_READ_RATE_PER_MINUTE=60
  EFI_MUTATION_RATE_PER_MINUTE=10
  EFI_SENSITIVE_RATE_PER_MINUTE=1

As opções não secretas usam a precedência CLI > EFI_* > variável legada.`;
}
