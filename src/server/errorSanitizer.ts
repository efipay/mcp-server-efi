const REDACTED = '[REDACTED]';
const CIRCULAR = '[Circular]';
const MAX_DEPTH = 8;
const MAX_NODES = 1_000;
const MAX_STRING_LENGTH = 16 * 1_024;
export const MAX_SANITIZED_ERROR_LENGTH = 32 * 1_024;

const sensitiveNormalizedKeys = new Set([
  'auth',
  'authorization',
  'credential',
  'credentials',
  'cookie',
  'setcookie',
  'password',
  'passphrase',
  'clientid',
  'clientsecret',
  'certificate',
  'cert',
  'pem',
  'pemkey',
  'privatekey',
  'partnertoken',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'apikey',
  'token',
  'username',
]);

const omittedNormalizedKeys = new Set([
  'stack',
  'config',
  'request',
  'header',
  'headers',
  'socket',
  'sockets',
  'agent',
  'agents',
  'httpagent',
  'httpsagent',
]);

class SanitizationBudgetExceeded extends Error {}

interface SanitizeState {
  readonly seen: WeakSet<object>;
  readonly secrets: readonly string[];
  nodes: number;
}

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  return sensitiveNormalizedKeys.has(normalizedKey(key));
}

function redactUrl(value: string): string {
  return value.replace(/\bhttps?:\/\/[^\s"'<>]+/gi, (candidate) => {
    try {
      const url = new URL(candidate);
      if (url.username) url.username = REDACTED;
      if (url.password) url.password = REDACTED;
      for (const key of [...url.searchParams.keys()]) {
        if (isSensitiveKey(key)) url.searchParams.set(key, REDACTED);
      }
      return url.toString();
    } catch {
      return candidate;
    }
  });
}

function redactText(value: string, secrets: readonly string[]): string {
  let sanitized = value
    .replace(/-----BEGIN [^-\r\n]+-----[\s\S]*?-----END [^-\r\n]+-----/gi, '[REDACTED PEM]')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
    .replace(/\b(?:set-cookie|cookie)\s*:\s*[^\r\n]+/gi, 'Cookie: [REDACTED]')
    .replace(
      /\b(client[_-]?secret|access[_-]?token|refresh[_-]?token|partner[_-]?token|api[_-]?key|password)\b\s*([=:])\s*(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi,
      '$1$2[REDACTED]',
    )
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED);

  sanitized = redactUrl(sanitized);
  for (const secret of secrets) {
    if (secret) sanitized = sanitized.split(secret).join(REDACTED);
  }

  if (sanitized.length > MAX_STRING_LENGTH) {
    return `${sanitized.slice(0, MAX_STRING_LENGTH)}[TRUNCATED]`;
  }
  return sanitized;
}

function ownDataProperties(value: object): Array<[string, unknown]> {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Object.entries(descriptors).flatMap(([key, descriptor]) =>
    'value' in descriptor ? [[key, descriptor.value] as [string, unknown]] : [],
  );
}

function sanitizeValue(value: unknown, state: SanitizeState, key = '', depth = 0): unknown {
  state.nodes += 1;
  if (state.nodes > MAX_NODES || depth > MAX_DEPTH) throw new SanitizationBudgetExceeded();
  if (key && isSensitiveKey(key)) return REDACTED;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'undefined') return undefined;
  if (typeof value === 'symbol') return redactText(String(value), state.secrets);
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      value.length <= MAX_STRING_LENGTH &&
      ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']')))
    ) {
      try {
        return sanitizeValue(JSON.parse(trimmed) as unknown, state, key, depth + 1);
      } catch {
        // A string that only resembles JSON remains a string and is still redacted below.
      }
    }
    return redactText(value, state.secrets);
  }

  if (Buffer.isBuffer(value)) return `[Buffer: ${value.byteLength} bytes]`;
  if (value instanceof Date) return value.toISOString();
  if (state.seen.has(value)) return CIRCULAR;
  state.seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, state, '', depth + 1));
  }

  const sanitized: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  if (value instanceof Error) sanitized.name = value.name;

  for (const [property, propertyValue] of ownDataProperties(value)) {
    if (omittedNormalizedKeys.has(normalizedKey(property))) continue;
    sanitized[property] = sanitizeValue(propertyValue, state, property, depth + 1);
  }
  return sanitized;
}

function ownDataValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

function fallbackError(error: unknown, secrets: readonly string[]): Record<string, unknown> {
  try {
    const fallback: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    if (typeof error === 'string') return { message: redactText(error, secrets) };
    if (typeof error !== 'object' || error === null) return { message: String(error) };

    for (const key of ['message', 'code', 'status', 'requestId'] as const) {
      const value = ownDataValue(error, key);
      if (['string', 'number', 'boolean'].includes(typeof value)) {
        fallback[key] =
          typeof value === 'string' ? redactText(value, secrets) : (value as number | boolean);
      }
    }

    const response = ownDataValue(error, 'response');
    if (typeof response === 'object' && response !== null && fallback.status === undefined) {
      const status = ownDataValue(response, 'status');
      if (typeof status === 'number') fallback.status = status;
    }

    if (Object.keys(fallback).length === 0) fallback.message = 'Falha na operação Efí.';
    return fallback;
  } catch {
    return { message: 'Falha na operação Efí.' };
  }
}

/** Produz uma representação JSON-safe sem invocar getters ou expor material sensível. */
export function sanitizeError(
  error: unknown,
  secretValues: readonly string[] = [],
): Record<string, unknown> {
  const secrets = [...new Set(secretValues.filter(Boolean))].sort((a, b) => b.length - a.length);

  try {
    const sanitized = sanitizeValue(error, { seen: new WeakSet<object>(), secrets, nodes: 0 });
    const normalized =
      typeof sanitized === 'object' && sanitized !== null
        ? (sanitized as Record<string, unknown>)
        : { message: sanitized };
    if (JSON.stringify(normalized).length > MAX_SANITIZED_ERROR_LENGTH) {
      return fallbackError(error, secrets);
    }
    return normalized;
  } catch {
    return fallbackError(error, secrets);
  }
}
