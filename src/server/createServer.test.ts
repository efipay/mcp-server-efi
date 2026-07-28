import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type EfiPay from 'sdk-node-apis-efi';
import { describe, expect, it, vi } from 'vitest';
import {
  API_GROUPS,
  SENSITIVE_TOOL_NAMES,
  type ApiGroup,
  type SensitiveToolName,
} from '../catalog/index.js';
import { createServer, SERVER_INFO } from './createServer.js';
import { PIX_RECEIPT_URI_TEMPLATE } from './receiptResource.js';

async function connected(
  clientImplementation: Partial<EfiPay> = {},
  enabledApis: ReadonlySet<ApiGroup> = new Set(API_GROUPS),
  enabledSensitiveTools: ReadonlySet<SensitiveToolName> = new Set(),
) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({
    sdk: { sandbox: true, client_id: 'id', client_secret: 'secret' },
    enabledApis,
    enabledSensitiveTools,
    client: clientImplementation as EfiPay,
  });
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function close(connection: Awaited<ReturnType<typeof connected>>): Promise<void> {
  await connection.client.close();
  await connection.server.close();
}

describe('servidor MCP', () => {
  it('publica 170 tools por padrão, ocultando respostas sensíveis', async () => {
    const connection = await connected();
    const result = await connection.client.listTools();
    const capabilities = connection.client.getServerCapabilities();

    expect(connection.client.getServerVersion()).toMatchObject({
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
    });
    expect(result.tools).toHaveLength(170);
    expect(capabilities).toMatchObject({ tools: {}, resources: {} });
    for (const unsupported of ['prompts', 'logging', 'sampling', 'elicitation', 'tasks'] as const) {
      expect(capabilities).not.toHaveProperty(unsupported);
    }
    for (const tool of result.tools) {
      const onWire = JSON.parse(JSON.stringify(tool)) as Record<string, unknown>;
      const allowedFields = new Set([
        'name',
        'title',
        'description',
        'inputSchema',
        'outputSchema',
        'annotations',
      ]);
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema.type).toBe('object');
      if (tool.outputSchema) expect(tool.outputSchema.type).toBe('object');
      expect(Object.keys(onWire).every((field) => allowedFields.has(field))).toBe(true);
      expect(onWire).not.toHaveProperty('execution');
      expect(Object.keys(tool)).toEqual(
        expect.arrayContaining(['name', 'title', 'description', 'inputSchema', 'annotations']),
      );
      // The high-level SDK materializes optional fields as `undefined` on an in-memory transport;
      // JSON serialization omits them from the actual MCP wire payload.
      expect(tool._meta).toBeUndefined();
      expect(JSON.stringify(onWire)).not.toContain('"_meta"');
      expect(JSON.stringify(onWire)).not.toContain('contexto/');
      expect(JSON.stringify(onWire)).not.toContain('sdkMethod');
      expect(JSON.stringify(onWire)).not.toContain('httpMethod');
      expect(JSON.stringify(onWire)).not.toContain('route');
    }
    expect(result.tools.filter(({ outputSchema }) => outputSchema)).toHaveLength(169);
    for (const sensitive of SENSITIVE_TOOL_NAMES) {
      expect(result.tools.some(({ name }) => name === sensitive)).toBe(false);
    }

    await close(connection);
  });

  it('publica as 173 tools somente após allowlist sensível explícita', async () => {
    const connection = await connected({}, new Set(API_GROUPS), new Set(SENSITIVE_TOOL_NAMES));
    expect((await connection.client.listTools()).tools).toHaveLength(173);
    await close(connection);
  });

  it('filtra tools e só anuncia resources quando Pix está habilitado', async () => {
    const cobrancas = await connected({}, new Set(['cobrancas']));
    expect((await cobrancas.client.listTools()).tools).toHaveLength(47);
    expect(cobrancas.client.getServerCapabilities()).toMatchObject({ tools: {} });
    expect(cobrancas.client.getServerCapabilities()).not.toHaveProperty('resources');
    await close(cobrancas);

    const pix = await connected({}, new Set(['pix']));
    expect(pix.client.getServerCapabilities()).toMatchObject({
      tools: {},
      resources: { listChanged: true },
    });
    const templates = await pix.client.listResourceTemplates();
    expect(templates.resourceTemplates).toEqual([
      expect.objectContaining({
        name: 'comprovante_pix',
        uriTemplate: PIX_RECEIPT_URI_TEMPLATE,
        mimeType: 'application/pdf',
      }),
    ]);
    await close(pix);
  });

  it('executa QR local e mantém texto, structuredContent e imagem coerentes', async () => {
    const imagemQrcode = `data:image/png;base64,${Buffer.from('png').toString('base64')}`;
    const connection = await connected(
      {
        pixGenerateStaticQRCode: vi.fn().mockResolvedValue({
          qrcode: 'payload',
          imagemQrcode,
        }),
      },
      new Set(['pix']),
    );

    const result = await connection.client.callTool({
      name: 'pix_generate_static_qr_code',
      arguments: {
        body: { chave: 'chave', merchantName: 'LOJA', merchantCity: 'BELO HORIZONTE' },
      },
    });
    const text = result.content.find((item) => item.type === 'text');

    expect(text?.type).toBe('text');
    expect(text?.type === 'text' ? JSON.parse(text.text) : undefined).toEqual(
      result.structuredContent,
    );
    expect(result.content.some((item) => item.type === 'image')).toBe(true);
    await close(connection);
  });

  it('mantém JSON e void canônicos pelo transporte MCP', async () => {
    const pixCreateEvp = vi.fn().mockResolvedValue({ chave: 'evp-1' });
    const pixDeleteEvp = vi.fn().mockResolvedValue(undefined);
    const connection = await connected({ pixCreateEvp, pixDeleteEvp }, new Set(['pix']));

    const jsonResult = await connection.client.callTool({ name: 'pix_create_evp' });
    const jsonText = jsonResult.content.find((item) => item.type === 'text');
    expect(jsonText?.type === 'text' ? JSON.parse(jsonText.text) : undefined).toEqual(
      jsonResult.structuredContent,
    );
    expect(jsonResult.structuredContent).toEqual({ result: { chave: 'evp-1' } });

    const voidResult = await connection.client.callTool({
      name: 'pix_delete_evp',
      arguments: { params: { chave: 'evp-1' } },
    });
    const voidText = voidResult.content.find((item) => item.type === 'text');
    expect(voidText?.type === 'text' ? JSON.parse(voidText.text) : undefined).toEqual(
      voidResult.structuredContent,
    );
    expect(voidResult.structuredContent).toEqual({ success: true });
    expect(pixCreateEvp).toHaveBeenCalledWith();
    expect(pixDeleteEvp).toHaveBeenCalledWith({ chave: 'evp-1' });
    await close(connection);
  });

  it('encaminha somente x-idempotency-key nas mutações Open Finance', async () => {
    const ofStartPixPayment = vi.fn().mockResolvedValue({
      identificadorPagamento: 'payment-1',
      redirectURI: 'https://example.test/authorize',
    });
    const connection = await connected({ ofStartPixPayment }, new Set(['open-finance']));
    const body = {
      pagador: { idParticipante: '12345678901234567890123456789012', cpf: '12345678900' },
      favorecido: { chave: 'pix@example.test' },
      pagamento: { valor: '1.00' },
    };

    const result = await connection.client.callTool({
      name: 'of_start_pix_payment',
      arguments: { body, idempotency_key: 'idem-1' },
    });

    expect(result.isError).not.toBe(true);
    expect(ofStartPixPayment).toHaveBeenCalledWith(body, { 'x-idempotency-key': 'idem-1' });
    expect(result.structuredContent).toMatchObject({ idempotency_key: 'idem-1' });
    await close(connection);
  });

  it('gera idempotência quando omitida e rejeita valor vazio antes do SDK', async () => {
    const ofStartPixPayment = vi.fn().mockResolvedValue({
      identificadorPagamento: 'payment-1',
      redirectURI: 'https://example.test/authorize',
    });
    const generatedConnection = await connected({ ofStartPixPayment }, new Set(['open-finance']));
    const body = {
      pagador: { idParticipante: '12345678901234567890123456789012', cpf: '12345678900' },
      favorecido: { chave: 'pix@example.test' },
      pagamento: { valor: '1.00' },
    };

    const generated = await generatedConnection.client.callTool({
      name: 'of_start_pix_payment',
      arguments: { body },
    });
    const key = (generated.structuredContent as { idempotency_key: string }).idempotency_key;
    expect(key).toMatch(/^[A-Za-z0-9]{72}$/);
    expect(ofStartPixPayment).toHaveBeenCalledWith(body, { 'x-idempotency-key': key });
    await close(generatedConnection);

    const blankCall = vi.fn();
    const blankConnection = await connected(
      { ofStartPixPayment: blankCall },
      new Set(['open-finance']),
    );
    const invalid = await blankConnection.client.callTool({
      name: 'of_start_pix_payment',
      arguments: { body, idempotency_key: ' \r\n ' },
    });
    expect(invalid.isError).toBe(true);
    expect(blankCall).not.toHaveBeenCalled();
    await close(blankConnection);
  });

  it('preserva a posição de params e body opcionais nos overloads do SDK', async () => {
    const getAccountBalance = vi.fn().mockRejectedValue({ reason: 'fixture' });
    const sendBilletEmail = vi.fn().mockRejectedValue({ reason: 'fixture' });
    const connection = await connected(
      { getAccountBalance, sendBilletEmail },
      new Set(['pix', 'cobrancas']),
    );

    const optionalParams = await connection.client.callTool({ name: 'get_account_balance' });
    const optionalBody = await connection.client.callTool({
      name: 'send_billet_email',
      arguments: { params: { id: 123 } },
    });

    expect(optionalParams.isError).toBe(true);
    expect(optionalBody.isError).toBe(true);
    expect(getAccountBalance).toHaveBeenCalledWith(undefined);
    expect(sendBilletEmail).toHaveBeenCalledWith({ id: 123 }, undefined);
    await close(connection);
  });

  it('mantém params e body nas regressões Pix e usa fixture MED válida', async () => {
    const pixUpdateCharge = vi.fn().mockRejectedValue({ reason: 'fixture' });
    const pixDevolution = vi.fn().mockRejectedValue({ reason: 'fixture' });
    const medDefense = vi.fn().mockRejectedValue({ reason: 'fixture' });
    const connection = await connected(
      { pixUpdateCharge, pixDevolution, medDefense },
      new Set(['pix']),
    );

    const updateInput = { params: { txid: 'abcd1234' }, body: { chave: 'chave-pix' } };
    const devolutionInput = {
      params: { e2eId: 'E12345678901234567890123456789012', id: 'devolucao1' },
      body: { valor: '1.00' },
    };
    const medInput = {
      params: { idInfracao: 'infracao-1' },
      body: {
        analise: 'rejeitado',
        justificativa: 'Operação reconhecida pelo participante.',
      },
    } as const;

    expect(
      await connection.client.callTool({ name: 'pix_update_charge', arguments: updateInput }),
    ).toMatchObject({ isError: true });
    expect(
      await connection.client.callTool({ name: 'pix_devolution', arguments: devolutionInput }),
    ).toMatchObject({ isError: true });
    expect(
      await connection.client.callTool({ name: 'med_defense', arguments: medInput }),
    ).toMatchObject({ isError: true });

    expect(pixUpdateCharge).toHaveBeenCalledWith(updateInput.params, updateInput.body);
    expect(pixDevolution).toHaveBeenCalledWith(devolutionInput.params, devolutionInput.body);
    expect(medDefense).toHaveBeenCalledWith(medInput.params, medInput.body);
    await close(connection);
  });

  it('publica EmbeddedResource PDF e permite relê-lo pelo template', async () => {
    const pixGetReceipt = vi
      .fn()
      .mockResolvedValueOnce(Buffer.from('%PDF-tool'))
      .mockResolvedValueOnce(Buffer.from('%PDF-resource'));
    const connection = await connected({ pixGetReceipt }, new Set(['pix']));

    const toolResult = await connection.client.callTool({
      name: 'pix_get_receipt',
      arguments: { params: { rtrId: 'return/1' } },
    });
    const embedded = toolResult.content.find((item) => item.type === 'resource');
    expect(embedded).toMatchObject({
      type: 'resource',
      resource: {
        uri: 'efi://pix/comprovantes/rtrId/return%2F1.pdf',
        mimeType: 'application/pdf',
      },
    });

    const resource = await connection.client.readResource({
      uri: 'efi://pix/comprovantes/rtrId/return%2F1.pdf',
    });
    expect(resource.contents).toEqual([
      expect.objectContaining({
        uri: 'efi://pix/comprovantes/rtrId/return%2F1.pdf',
        blob: Buffer.from('%PDF-resource').toString('base64'),
        mimeType: 'application/pdf',
      }),
    ]);
    expect(pixGetReceipt).toHaveBeenNthCalledWith(1, { rtrId: 'return/1' });
    expect(pixGetReceipt).toHaveBeenNthCalledWith(2, { rtrId: 'return/1' });
    await close(connection);
  });

  it.each(['txid', 'e2eid', 'idEnvio', 'rtrId'] as const)(
    'aceita o identificador %s em resources/read',
    async (type) => {
      const pixGetReceipt = vi.fn().mockResolvedValue(Buffer.from('%PDF'));
      const connection = await connected({ pixGetReceipt }, new Set(['pix']));

      await connection.client.readResource({
        uri: `efi://pix/comprovantes/${type}/id-1.pdf`,
      });
      expect(pixGetReceipt).toHaveBeenCalledWith({ [type]: 'id-1' });
      await close(connection);
    },
  );

  it.each(['txid', 'e2eid', 'idEnvio', 'rtrId'] as const)(
    'aceita o identificador %s na tool pix_get_receipt',
    async (type) => {
      const pixGetReceipt = vi.fn().mockResolvedValue(Buffer.from('%PDF'));
      const connection = await connected({ pixGetReceipt }, new Set(['pix']));

      const result = await connection.client.callTool({
        name: 'pix_get_receipt',
        arguments: { params: { [type]: 'id-1' } },
      });
      expect(result.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'resource',
            resource: expect.objectContaining({
              uri: `efi://pix/comprovantes/${type}/id-1.pdf`,
              mimeType: 'application/pdf',
            }),
          }),
        ]),
      );
      expect(pixGetReceipt).toHaveBeenCalledWith({ [type]: 'id-1' });
      await close(connection);
    },
  );

  it('retorna isError para input inválido sem chamar o SDK', async () => {
    const pixGenerateStaticQRCode = vi.fn();
    const connection = await connected({ pixGenerateStaticQRCode }, new Set(['pix']));
    const result = await connection.client.callTool({
      name: 'pix_generate_static_qr_code',
      arguments: { body: { chave: 'incompleto' } },
    });

    expect(result.isError).toBe(true);
    expect(pixGenerateStaticQRCode).not.toHaveBeenCalled();
    await close(connection);
  });

  it('retorna isError para falha de negócio/API e preserva detalhe sanitizado', async () => {
    const connection = await connected(
      {
        pixCreateEvp: vi.fn().mockRejectedValue({
          status: 422,
          error: 'chave já existe',
          client_secret: 'não-vazar',
        }),
      },
      new Set(['pix']),
    );
    const result = await connection.client.callTool({ name: 'pix_create_evp' });
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';

    expect(result.isError).toBe(true);
    expect(text).toContain('chave já existe');
    expect(text).toContain('422');
    expect(text).not.toContain('não-vazar');
    await close(connection);
  });

  it('mantém tool desconhecida como InvalidParams JSON-RPC', async () => {
    const connection = await connected({}, new Set(['pix']));
    await expect(connection.client.callTool({ name: 'tool_que_nao_existe' })).rejects.toMatchObject(
      { code: ErrorCode.InvalidParams },
    );
    await close(connection);
  });

  it('trata chamada direta de tool sensível oculta como InvalidParams', async () => {
    const connection = await connected({}, new Set(['abertura-contas']));
    await expect(
      connection.client.callTool({
        name: 'get_account_credentials',
        arguments: { params: { idContaSimplificada: 'conta-1' } },
      }),
    ).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
    await close(connection);
  });

  it('mantém quebra de contrato interno como InternalError JSON-RPC', async () => {
    const connection = await connected(
      { pixGenerateStaticQRCode: vi.fn().mockResolvedValue({ qrcode: 'sem imagem' }) },
      new Set(['pix']),
    );

    await expect(
      connection.client.callTool({
        name: 'pix_generate_static_qr_code',
        arguments: {
          body: { chave: 'chave', merchantName: 'LOJA', merchantCity: 'BELO HORIZONTE' },
        },
      }),
    ).rejects.toMatchObject({ code: ErrorCode.InternalError });
    await close(connection);
  });

  it('rejeita conteúdo inesperado em resposta void como InternalError', async () => {
    const connection = await connected(
      { pixDeleteEvp: vi.fn().mockResolvedValue({ unexpected: true }) },
      new Set(['pix']),
    );

    await expect(
      connection.client.callTool({
        name: 'pix_delete_evp',
        arguments: { params: { chave: 'evp-1' } },
      }),
    ).rejects.toMatchObject({ code: ErrorCode.InternalError });
    await close(connection);
  });
});
