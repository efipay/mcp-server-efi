import { compactVerify, createLocalJWKSet, type JSONWebKeySet } from 'jose';
import { getDecodedPixJwt } from 'pix-qr-code-detail';

const FETCH_TIMEOUT_MS = 5_000;

export type PixQrCodeSignatureStatus = 'verified' | 'invalid' | 'unavailable';

export interface PixQrCodeVerification {
  jku_origin_match: boolean | null;
  signature_status: PixQrCodeSignatureStatus;
}

export interface PixQrCodeInspection {
  result: unknown;
  verification: PixQrCodeVerification;
}

function inputUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJwks(value: unknown): value is JSONWebKeySet {
  return isRecord(value) && Array.isArray(value.keys) && value.keys.every((key) => isRecord(key));
}

async function fetchJsonWebKeySet(jku: URL, fetchFn: typeof fetch): Promise<JSONWebKeySet> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetchFn(jku, {
      headers: { Accept: 'application/jwk-set+json, application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new TypeError(`Falha ao baixar JWKS: HTTP ${response.status}.`);
    }
    const value: unknown = await response.json();
    if (!isJwks(value)) throw new Error('O endereço jku não retornou um JWKS válido.');
    return value;
  } finally {
    clearTimeout(timeout);
  }
}

function unavailableVerification(originMatch: boolean | null): PixQrCodeVerification {
  return {
    jku_origin_match: originMatch,
    signature_status: 'unavailable',
  };
}

/**
 * Reproduz a implementação pública do SDK Efí 2.x para obter e decodificar o payload,
 * preservando o JWS compacto e o cabeçalho que o wrapper do SDK não devolve.
 */
export async function inspectPixQrCode(
  pixCopiaECola: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<PixQrCodeInspection> {
  let accessedPayloadUrl: URL | undefined;
  let compactJws: string | undefined;

  const capturingFetch: typeof fetch = async (input, init) => {
    const requestedUrl = new URL(inputUrl(input));
    const response = await fetchFn(input, init);
    accessedPayloadUrl = new URL(response.url || requestedUrl);
    compactJws = (await response.clone().text()).trim();
    return response;
  };

  const decoded = await getDecodedPixJwt(pixCopiaECola, {
    fetch: capturingFetch,
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  const tipoCob = pixCopiaECola.includes('/cobv/') ? 'cobv' : 'cob';
  const result = isRecord(decoded.payload) ? { tipoCob, ...decoded.payload } : decoded.payload;

  const jkuValue = decoded.header.jku;
  if (typeof jkuValue !== 'string' || !jkuValue.trim() || !accessedPayloadUrl || !compactJws) {
    return { result, verification: unavailableVerification(null) };
  }

  let jku: URL;
  try {
    jku = new URL(jkuValue);
  } catch {
    return { result, verification: unavailableVerification(null) };
  }

  if (!['http:', 'https:'].includes(jku.protocol)) {
    return { result, verification: unavailableVerification(null) };
  }

  const originMatch = jku.origin === accessedPayloadUrl.origin;
  if (!originMatch) {
    return {
      result,
      verification: {
        jku_origin_match: false,
        signature_status: 'invalid',
      },
    };
  }

  let jwks: JSONWebKeySet;
  try {
    jwks = await fetchJsonWebKeySet(jku, fetchFn);
  } catch {
    return {
      result,
      verification: {
        jku_origin_match: true,
        signature_status: 'unavailable',
      },
    };
  }

  try {
    await compactVerify(compactJws, createLocalJWKSet(jwks));
    return {
      result,
      verification: {
        jku_origin_match: true,
        signature_status: 'verified',
      },
    };
  } catch {
    return {
      result,
      verification: {
        jku_origin_match: true,
        signature_status: 'invalid',
      },
    };
  }
}
