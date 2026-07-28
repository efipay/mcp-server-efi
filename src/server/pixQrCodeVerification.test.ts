import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { inspectPixQrCode } from './pixQrCodeVerification.js';

function dynamicPixCode(payloadUrl: string): string {
  const gui = '0014BR.GOV.BCB.PIX';
  const url = `25${String(payloadUrl.length).padStart(2, '0')}${payloadUrl}`;
  const merchantAccount = `${gui}${url}`;
  return `26${String(merchantAccount.length).padStart(2, '0')}${merchantAccount}6304ABCD`;
}

async function signedFixture(jku?: string) {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  Object.assign(jwk, { kid: 'pix-key-1', alg: 'RS256', use: 'sig' });
  const payload = {
    txid: 'txid-1',
    revisao: 0,
    status: 'ATIVA',
    recebedor: { cpf: '12345678900', nome: 'Recebedor' },
    chave: 'pix@example.test',
    calendario: {
      criacao: '2026-07-27T00:00:00Z',
      apresentacao: '2026-07-27T00:00:00Z',
      expiracao: 3600,
    },
    valor: { original: '1.00' },
  };
  const token = await new SignJWT(payload)
    .setProtectedHeader({
      alg: 'RS256',
      kid: 'pix-key-1',
      ...(jku === undefined ? {} : { jku }),
    })
    .sign(privateKey);
  return { token, jwks: { keys: [jwk] }, payload };
}

describe('verificação do QR Code Pix dinâmico', () => {
  it.each(['http', 'https'])(
    'valida a assinatura em %s quando as origens coincidem',
    async (protocol) => {
      const payloadUrl = `${protocol}://pix.example.test/cob/payload-1`;
      const jku = `${protocol}://pix.example.test/jwks`;
      const fixture = await signedFixture(jku);
      const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
        const url = String(input);
        return url.startsWith(jku)
          ? Response.json(fixture.jwks)
          : new Response(fixture.token, { status: 200 });
      });

      const inspected = await inspectPixQrCode(dynamicPixCode(payloadUrl), fetch);

      expect(inspected.result).toMatchObject({ tipoCob: 'cob', txid: 'txid-1' });
      expect(inspected.verification).toEqual({
        jku_origin_match: true,
        signature_status: 'verified',
      });
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it('não acessa o JWKS quando o jku pertence a outra origem', async () => {
    const payloadUrl = 'https://pix.example.test/cob/payload-1';
    const fixture = await signedFixture('https://keys.example.test/jwks');
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(fixture.token));

    const inspected = await inspectPixQrCode(dynamicPixCode(payloadUrl), fetch);

    expect(inspected.verification).toEqual({
      jku_origin_match: false,
      signature_status: 'invalid',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['http', 'https'])('classifica assinatura inválida em %s', async (protocol) => {
    const payloadUrl = `${protocol}://pix.example.test/cob/payload-1`;
    const jku = `${protocol}://pix.example.test/jwks`;
    const fixture = await signedFixture(jku);
    const [header, payload, signature] = fixture.token.split('.');
    const tamperedSignature = `${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;
    const tampered = `${header}.${payload}.${tamperedSignature}`;

    const invalidFetch = vi.fn<typeof globalThis.fetch>(async (input) =>
      String(input).startsWith(jku) ? Response.json(fixture.jwks) : new Response(tampered),
    );
    const invalid = await inspectPixQrCode(dynamicPixCode(payloadUrl), invalidFetch);
    expect(invalid.verification.signature_status).toBe('invalid');
  });

  it('mantém sucesso com alerta quando o JWKS está indisponível', async () => {
    const payloadUrl = 'https://pix.example.test/cob/payload-1';
    const jku = 'https://pix.example.test/jwks';
    const fixture = await signedFixture(jku);

    const unavailableFetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      if (String(input).startsWith(jku)) throw new TypeError('network unavailable');
      return new Response(fixture.token);
    });
    const unavailable = await inspectPixQrCode(dynamicPixCode(payloadUrl), unavailableFetch);
    expect(unavailable.verification).toEqual({
      jku_origin_match: true,
      signature_status: 'unavailable',
    });
  });

  it.each([undefined, 'endereço inválido', 'ftp://pix.example.test/jwks'])(
    'não usa um jku ausente ou não HTTP: %s',
    async (jku) => {
      const payloadUrl = 'https://pix.example.test/cob/payload-1';
      const fixture = await signedFixture(jku);
      const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(fixture.token));

      const inspected = await inspectPixQrCode(dynamicPixCode(payloadUrl), fetch);

      expect(inspected.verification).toEqual({
        jku_origin_match: null,
        signature_status: 'unavailable',
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('classifica uma resposta JWKS inválida como indisponível', async () => {
    const payloadUrl = 'https://pix.example.test/cob/payload-1';
    const jku = 'https://pix.example.test/jwks';
    const fixture = await signedFixture(jku);
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) =>
      String(input).startsWith(jku) ? Response.json({ notKeys: [] }) : new Response(fixture.token),
    );

    const inspected = await inspectPixQrCode(dynamicPixCode(payloadUrl), fetch);

    expect(inspected.verification).toEqual({
      jku_origin_match: true,
      signature_status: 'unavailable',
    });
  });
});
