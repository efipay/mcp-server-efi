import { describe, expect, it, vi } from 'vitest';
import type EfiPay from 'sdk-node-apis-efi';
import { TOOL_CATALOG } from '../catalog/index.js';
import { createToolHandler, generateIdempotencyKey, sanitizeError } from './toolFactory.js';

const definition = (method: string) => TOOL_CATALOG.find((tool) => tool.method === method)!;

function textOf(result: Awaited<ReturnType<ReturnType<typeof createToolHandler>>>): string {
  const text = result.content.find((item) => item.type === 'text');
  return text?.type === 'text' ? text.text : '';
}

describe('factory de tools', () => {
  it('monta os quatro formatos de overload do SDK Efí 2.x', async () => {
    const pixCreateEvp = vi.fn().mockRejectedValue({ reason: 'fixture' });
    const pixCreateImmediateCharge = vi.fn().mockRejectedValue({ reason: 'fixture' });
    const pixDetailCharge = vi.fn().mockRejectedValue({ reason: 'fixture' });
    const pixUpdateCharge = vi.fn().mockRejectedValue({ reason: 'fixture' });
    const client = {
      pixCreateEvp,
      pixCreateImmediateCharge,
      pixDetailCharge,
      pixUpdateCharge,
    } as unknown as EfiPay;

    await createToolHandler(definition('pixCreateEvp'), client)({});
    await createToolHandler(
      definition('pixCreateImmediateCharge'),
      client,
    )({
      body: { valor: '1.00' },
    });
    await createToolHandler(definition('pixDetailCharge'), client)({ params: { txid: '123' } });
    await createToolHandler(
      definition('pixUpdateCharge'),
      client,
    )({
      params: { txid: '123' },
      body: { chave: 'abc' },
    });

    expect(pixCreateEvp).toHaveBeenCalledWith();
    expect(pixCreateImmediateCharge).toHaveBeenCalledWith({ valor: '1.00' });
    expect(pixDetailCharge).toHaveBeenCalledWith({ txid: '123' });
    expect(pixUpdateCharge).toHaveBeenCalledWith({ txid: '123' }, { chave: 'abc' });
  });

  it('envia apenas a chave de idempotência permitida no Open Finance', async () => {
    const ofStartPixPayment = vi.fn().mockRejectedValue({ reason: 'fixture' });
    await createToolHandler(definition('ofStartPixPayment'), {
      ofStartPixPayment,
    } as unknown as EfiPay)({ body: { valor: '1.00' }, idempotency_key: 'idem-123' });

    expect(ofStartPixPayment).toHaveBeenCalledWith(
      { valor: '1.00' },
      { 'x-idempotency-key': 'idem-123' },
    );
  });

  it('gera uma chave independente de 72 caracteres por operação Open Finance', async () => {
    const response = {
      identificadorPagamento: 'payment-1',
      redirectURI: 'https://example.test/authorize',
    };
    const ofStartPixPayment = vi.fn().mockResolvedValue(response);
    const handler = createToolHandler(definition('ofStartPixPayment'), {
      ofStartPixPayment,
    } as unknown as EfiPay);

    const first = await handler({ body: { valor: '1.00' } });
    const second = await handler({ body: { valor: '1.00' } });
    const firstKey = (first.structuredContent as { idempotency_key: string }).idempotency_key;
    const secondKey = (second.structuredContent as { idempotency_key: string }).idempotency_key;

    expect(firstKey).toMatch(/^[A-Za-z0-9]{72}$/);
    expect(secondKey).toMatch(/^[A-Za-z0-9]{72}$/);
    expect(firstKey).not.toBe(secondKey);
    expect(ofStartPixPayment).toHaveBeenNthCalledWith(
      1,
      { valor: '1.00' },
      { 'x-idempotency-key': firstKey },
    );
    expect(ofStartPixPayment).toHaveBeenNthCalledWith(
      2,
      { valor: '1.00' },
      { 'x-idempotency-key': secondKey },
    );
  });

  it('devolve a chave gerada quando a Efí falha após iniciar a operação', async () => {
    const ofStartPixPayment = vi.fn().mockRejectedValue({ status: 503, message: 'indisponível' });
    const result = await createToolHandler(definition('ofStartPixPayment'), {
      ofStartPixPayment,
    } as unknown as EfiPay)({ body: { valor: '1.00' } });
    const payload = JSON.parse(textOf(result)) as Record<string, unknown>;

    expect(result.isError).toBe(true);
    expect(payload.idempotency_key).toMatch(/^[A-Za-z0-9]{72}$/);
    expect(ofStartPixPayment).toHaveBeenCalledWith(
      { valor: '1.00' },
      { 'x-idempotency-key': payload.idempotency_key },
    );
  });

  it('produz chaves criptográficas no formato público', () => {
    expect(generateIdempotencyKey()).toMatch(/^[A-Za-z0-9]{72}$/);
  });

  it('mantém o body nas regressões de atualização, devolução e MED', async () => {
    const medDefense = vi.fn().mockResolvedValue(undefined);
    const result = await createToolHandler(definition('medDefense'), {
      medDefense,
    } as unknown as EfiPay)({
      params: { idInfracao: 'i' },
      body: { analise: 'rejeitado', justificativa: 'Operação reconhecida.' },
    });

    expect(medDefense).toHaveBeenCalledWith(
      { idInfracao: 'i' },
      { analise: 'rejeitado', justificativa: 'Operação reconhecida.' },
    );
    expect(result.structuredContent).toEqual({ success: true });
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
  });

  it('usa o resultado validado como valor canônico no texto e structuredContent', async () => {
    const pixCreateEvp = vi.fn().mockResolvedValue({ chave: 'evp-1', origem: 'sdk' });
    const result = await createToolHandler(definition('pixCreateEvp'), {
      pixCreateEvp,
    } as unknown as EfiPay)({});

    expect(result.structuredContent).toEqual({ result: { chave: 'evp-1', origem: 'sdk' } });
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
  });

  it('retorna comprovante como EmbeddedResource com URI legível e tipada', async () => {
    const pixGetReceipt = vi.fn().mockResolvedValue(Buffer.from('%PDF-test'));
    const result = await createToolHandler(definition('pixGetReceipt'), {
      pixGetReceipt,
    } as unknown as EfiPay)({
      params: { txid: 'tx/1' },
    });

    expect(result.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'resource',
          resource: expect.objectContaining({
            uri: 'efi://pix/comprovantes/txid/tx%2F1.pdf',
            mimeType: 'application/pdf',
          }),
        }),
      ]),
    );
    expect(result.structuredContent).toEqual({
      result: {
        uri: 'efi://pix/comprovantes/txid/tx%2F1.pdf',
        mimeType: 'application/pdf',
        identifier: { type: 'txid', id: 'tx/1' },
      },
    });
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
  });

  it('bloqueia execução sensível até a allowlist explícita', async () => {
    const getAccountCredentials = vi.fn().mockRejectedValue({ reason: 'fixture' });
    const definitionSensitive = definition('getAccountCredentials');

    const blocked = await createToolHandler(definitionSensitive, {
      getAccountCredentials,
    } as unknown as EfiPay)({
      params: { idContaSimplificada: 'conta-1' },
    });
    expect(blocked.isError).toBe(true);
    expect(getAccountCredentials).not.toHaveBeenCalled();

    await createToolHandler(definitionSensitive, { getAccountCredentials } as unknown as EfiPay, {
      allowedSensitiveTools: new Set(['get_account_credentials']),
    })({
      params: { idContaSimplificada: 'conta-1' },
    });
    expect(getAccountCredentials).toHaveBeenCalledWith({ idContaSimplificada: 'conta-1' });
  });

  it('retorna QR Code canônico integral e também como imagem', async () => {
    const imagemQrcode = `data:image/png;base64,${Buffer.from('png').toString('base64')}`;
    const pixGenerateStaticQRCode = vi.fn().mockResolvedValue({
      qrcode: 'payload',
      imagemQrcode,
    });
    const result = await createToolHandler(definition('pixGenerateStaticQRCode'), {
      pixGenerateStaticQRCode,
    } as unknown as EfiPay)({
      body: { chave: 'chave', merchantName: 'LOJA', merchantCity: 'BELO HORIZONTE' },
    });

    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
    expect(textOf(result)).toContain(imagemQrcode);
    expect(result.content.some((item) => item.type === 'image')).toBe(true);
  });

  it('não publica ImageContent quando o QR Code não contém base64 válido', async () => {
    const pixGenerateStaticQRCode = vi.fn().mockResolvedValue({
      qrcode: 'payload',
      imagemQrcode: 'isto não é base64',
    });
    const result = await createToolHandler(definition('pixGenerateStaticQRCode'), {
      pixGenerateStaticQRCode,
    } as unknown as EfiPay)({
      body: { chave: 'chave', merchantName: 'LOJA', merchantCity: 'BELO HORIZONTE' },
    });

    expect(result.content.some((item) => item.type === 'image')).toBe(false);
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
  });

  it('sanitiza profundamente erros Axios, Error e plain object', async () => {
    const apiError: Record<string, unknown> = {
      message: 'negado client_secret=segredo-em-mensagem',
      code: 'AUTH_FAILED',
      stack: 'stack sigilosa',
      headers: { authorization: 'Bearer token-do-header', cookie: 'sid=cookie-secreto' },
      config: { auth: { username: 'client-id-secreto', password: 'senha-secreta' } },
      response: {
        status: 401,
        data: {
          client_secret: 'segredo-em-campo',
          nested: {
            token: 'token-aninhado',
            detail: 'Authorization: Bearer token-no-texto',
            certificate: '-----BEGIN PRIVATE KEY-----\nchave-privada\n-----END PRIVATE KEY-----',
          },
        },
      },
    };
    apiError.cycle = apiError;

    const pixCreateEvp = vi.fn().mockRejectedValue(apiError);
    const result = await createToolHandler(definition('pixCreateEvp'), {
      pixCreateEvp,
    } as unknown as EfiPay)({});
    const text = textOf(result);

    expect(result.isError).toBe(true);
    for (const secret of [
      'segredo-em-mensagem',
      'token-do-header',
      'cookie-secreto',
      'segredo-em-campo',
      'token-aninhado',
      'token-no-texto',
      'chave-privada',
      'stack sigilosa',
      'client-id-secreto',
      'senha-secreta',
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain('[REDACTED]');
    expect(text).toContain('[Circular]');
    expect(text).toContain('AUTH_FAILED');
    expect(text).toContain('401');
  });

  it('preserva code e cause não enumeráveis de Error sem expor stack', () => {
    const cause = new Error('causa útil');
    const error = new Error('falha principal', { cause });
    Object.defineProperty(error, 'code', { value: 'EFI_FAILURE', enumerable: false });

    expect(sanitizeError(error)).toMatchObject({
      name: 'Error',
      message: 'falha principal',
      code: 'EFI_FAILURE',
      cause: { name: 'Error', message: 'causa útil' },
    });
    expect(JSON.stringify(sanitizeError(error))).not.toContain('stack');
  });

  it('sanitiza JSON textual, URLs, valores reais e não executa getters', () => {
    const getter = vi.fn(() => 'segredo-do-getter');
    const error = {
      message:
        '{"detail":"Bearer token-json","client_secret":"segredo-json","url":"https://user:pass@example.test/path?access_token=query-secret"}',
      safe: 'o segredo-runtime apareceu',
    };
    Object.defineProperty(error, 'dangerous', { enumerable: true, get: getter });

    const sanitized = sanitizeError(error, ['segredo-runtime']);
    const text = JSON.stringify(sanitized);

    expect(getter).not.toHaveBeenCalled();
    expect(text).not.toContain('token-json');
    expect(text).not.toContain('segredo-json');
    expect(text).not.toContain('query-secret');
    expect(text).not.toContain('segredo-runtime');
    expect(text).not.toContain('user:pass');
  });
});
