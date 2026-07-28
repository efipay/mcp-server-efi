import { describe, expect, it } from 'vitest';
import EfiPay from 'sdk-node-apis-efi';
import { z } from 'zod';
import {
  inputSchemaFor,
  methodToToolName,
  outputSchemaFor,
  TOOL_CATALOG,
  VOID_METHODS,
} from './index.js';

const sdkInternals = new Set([
  'resolveRequestContext',
  'isExpired',
  'authenticate',
  'requestAuthentication',
  'call',
  'callBodyEndpoint',
  'callWithoutParams',
]);

function countBy<T extends string>(values: readonly T[]): Record<T, number> {
  return values.reduce(
    (counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    },
    {} as Record<T, number>,
  );
}

describe('catálogo de tools', () => {
  it('cobre exatamente os 173 métodos públicos do SDK', () => {
    const sdkMethods = Object.getOwnPropertyNames(EfiPay.prototype)
      .filter((name) => name !== 'constructor' && !sdkInternals.has(name))
      .sort();
    const catalogMethods = TOOL_CATALOG.map(({ method }) => method).sort();

    expect(sdkMethods).toHaveLength(173);
    expect(catalogMethods).toHaveLength(173);
    expect(catalogMethods).toEqual(sdkMethods);
    expect(new Set(catalogMethods).size).toBe(173);
  });

  it('mantém as contagens oficiais por API', () => {
    const count = (api: string, local: boolean) =>
      TOOL_CATALOG.filter(
        (tool) =>
          tool.api === api && (local ? tool.httpMethod === 'local' : tool.httpMethod !== 'local'),
      ).length;

    expect(count('cobrancas', false)).toBe(47);
    expect(count('pix', false)).toBe(78);
    expect(count('pix', true)).toBe(2);
    expect(count('open-finance', false)).toBe(26);
    expect(count('pagamento-contas', false)).toBe(7);
    expect(count('abertura-contas', false)).toBe(7);
    expect(count('extratos', false)).toBe(6);
  });

  it('gera nomes MCP snake_case únicos e válidos', () => {
    const names = TOOL_CATALOG.map(({ name }) => name);
    expect(new Set(names).size).toBe(173);
    expect(names.every((name) => /^[a-z0-9_]{1,128}$/.test(name))).toBe(true);
    expect(methodToToolName('pixGenerateQRCode')).toBe('pix_generate_qr_code');
  });

  it('preserva os quatro formatos e as optionalidades auditadas no SDK', () => {
    expect(countBy(TOOL_CATALOG.map(({ callShape }) => callShape))).toEqual({
      none: 13,
      body: 35,
      params: 75,
      'params-body': 50,
    });
    expect(TOOL_CATALOG.filter(({ optionalParams }) => optionalParams)).toHaveLength(5);
    expect(TOOL_CATALOG.filter(({ optionalBody }) => optionalBody)).toHaveLength(5);
  });

  it('publica schemas objeto para entrada e saída estruturada', () => {
    for (const tool of TOOL_CATALOG) {
      expect(z.toJSONSchema(inputSchemaFor(tool))).toMatchObject({ type: 'object' });

      const outputSchema = outputSchemaFor(tool);
      if (tool.responseKind === 'pdf') {
        expect(outputSchema).toBeUndefined();
      } else {
        expect(z.toJSONSchema(outputSchema!)).toMatchObject({ type: 'object' });
      }

      if (tool.responseKind === 'json' || tool.responseKind === 'qr') {
        expect(tool.responseSchema).toBeDefined();
      }
    }
  });

  it('mantém as contagens de resposta auditadas', () => {
    expect(countBy(TOOL_CATALOG.map(({ responseKind }) => responseKind))).toEqual({
      json: 153,
      void: 17,
      qr: 2,
      pdf: 1,
    });
    expect(VOID_METHODS.size).toBe(17);
  });

  it('expõe idempotency_key somente nas 17 mutações Open Finance', () => {
    const accepting = TOOL_CATALOG.filter(({ acceptsIdempotencyKey }) => acceptsIdempotencyKey);
    expect(accepting).toHaveLength(17);

    for (const tool of TOOL_CATALOG) {
      expect(tool.acceptsIdempotencyKey).toBe(
        tool.api === 'open-finance' && tool.httpMethod !== 'get',
      );
      const input = inputSchemaFor(tool);
      const minimalInput: Record<string, unknown> = {};
      if (tool.paramsSchema && !tool.optionalParams) minimalInput.params = undefined;
      if (tool.bodySchema && !tool.optionalBody) minimalInput.body = undefined;

      if (tool.acceptsIdempotencyKey) {
        expect(input.shape.idempotency_key).toBeDefined();
        expect(input.shape.idempotency_key.safeParse('')).toMatchObject({ success: false });
        expect(input.shape.idempotency_key.safeParse('  ')).toMatchObject({ success: false });
        expect(input.shape.idempotency_key.safeParse('abc\r\nInjected: value')).toMatchObject({
          success: false,
        });
        expect(input.shape.idempotency_key.safeParse('  idem-1  ')).toMatchObject({
          success: true,
          data: 'idem-1',
        });
      } else {
        expect(input.shape.idempotency_key).toBeUndefined();
        expect(
          input.safeParse({ ...minimalInput, idempotency_key: 'não permitido' }),
        ).toMatchObject({
          success: false,
        });
      }
    }
  });

  it('implementa integralmente a matriz MCP de annotations', () => {
    const reads = TOOL_CATALOG.filter(({ annotations }) => annotations.readOnlyHint);
    const mutations = TOOL_CATALOG.filter(({ annotations }) => !annotations.readOnlyHint);
    const additive = mutations.filter(({ annotations }) => annotations.destructiveHint === false);
    const destructive = mutations.filter(({ annotations }) => annotations.destructiveHint === true);

    expect(reads).toHaveLength(64);
    expect(mutations).toHaveLength(109);
    expect(additive).toHaveLength(33);
    expect(destructive).toHaveLength(76);
    expect(TOOL_CATALOG.filter(({ annotations }) => annotations.openWorldHint)).toHaveLength(172);
    expect(TOOL_CATALOG.filter(({ annotations }) => !annotations.openWorldHint)).toHaveLength(1);

    for (const tool of TOOL_CATALOG) {
      expect(tool.annotations.readOnlyHint).toBe(
        tool.httpMethod === 'get' || tool.httpMethod === 'local',
      );
      expect(tool.annotations.idempotentHint).toBe(
        tool.httpMethod === 'get' ||
          tool.httpMethod === 'local' ||
          tool.httpMethod === 'put' ||
          tool.httpMethod === 'delete',
      );
      expect(tool.annotations.openWorldHint).toBe(
        tool.httpMethod !== 'local' || tool.method === 'pixQrCodeDetail',
      );
    }
  });

  it('fornece título e descrição específicos sem metadados de desenvolvimento', () => {
    expect(new Set(TOOL_CATALOG.map(({ title }) => title)).size).toBe(173);
    expect(new Set(TOOL_CATALOG.map(({ description }) => description)).size).toBe(173);

    for (const tool of TOOL_CATALOG) {
      expect(tool.title.length).toBeGreaterThan(8);
      expect(tool.title).not.toMatch(/^Executar\b/i);
      expect(tool.description.length).toBeGreaterThan(80);
      expect(tool.description).toContain('Use ');
      expect(tool.description).not.toMatch(
        /<\/?[a-z]|import\s+Tabs|className=|contexto\/|primary|supporting/i,
      );
      expect(tool).not.toHaveProperty('context');
      expect(tool).not.toHaveProperty('_meta');
    }
  });

  it('distingue consultas de mutações nas descrições financeiras críticas', () => {
    const byMethod = (method: string) => TOOL_CATALOG.find((tool) => tool.method === method)!;

    expect(byMethod('pixDevolution').title).toMatch(/Solicitar.*devolução/i);
    expect(byMethod('pixDetailDevolution').title).toMatch(/Consultar.*devolução/i);
    expect(byMethod('pixUpdateCharge').title).toMatch(/Revisar.*cobrança/i);
    expect(byMethod('pixGetReceipt').title).toMatch(/Obter.*comprovante/i);
    expect(byMethod('medDefense').description).toMatch(/defesa|rejeitad/i);
  });
});
