import { describe, expect, it } from 'vitest';
import { sanitizeError } from './errorSanitizer.js';

describe('sanitização defensiva de erros', () => {
  it('normaliza tipos JSON-incompatíveis sem executar código do valor', () => {
    const namedFunction = function fixtureFunction() {};
    const value = {
      nullValue: null,
      integer: 7,
      enabled: true,
      big: 12n,
      missing: undefined,
      symbol: Symbol('fixture'),
      callback: namedFunction,
      bytes: Buffer.from('secret bytes'),
      timestamp: new Date('2026-07-27T12:00:00Z'),
      list: ['safe', 1],
      invalidJson: '{"incompleto":',
      invalidUrl: 'endereço http://% inválido',
    };

    const sanitized = sanitizeError(value);

    expect(sanitized).toMatchObject({
      nullValue: null,
      integer: 7,
      enabled: true,
      big: '12',
      symbol: 'Symbol(fixture)',
      callback: '[Function fixtureFunction]',
      bytes: '[Buffer: 12 bytes]',
      timestamp: '2026-07-27T12:00:00.000Z',
      list: ['safe', 1],
      invalidJson: '{"incompleto":',
      invalidUrl: 'endereço http://% inválido',
    });
    expect(Object.hasOwn(sanitized, 'missing')).toBe(true);
  });

  it('usa fallback útil ao exceder profundidade, número de nós ou tamanho', () => {
    const deep: Record<string, unknown> = {
      message: 'falha profunda',
      code: 'DEEP',
      response: { status: 503 },
    };
    let cursor = deep;
    for (let index = 0; index < 12; index += 1) {
      const child: Record<string, unknown> = {};
      cursor.child = child;
      cursor = child;
    }
    expect(sanitizeError(deep)).toEqual({
      message: 'falha profunda',
      code: 'DEEP',
      status: 503,
    });

    expect(sanitizeError(Array.from({ length: 1_100 }, (_, index) => index))).toEqual({
      message: 'Falha na operação Efí.',
    });

    const oversized = {
      message: 'falha extensa',
      first: 'x'.repeat(20_000),
      second: 'y'.repeat(20_000),
    };
    expect(sanitizeError(oversized)).toEqual({ message: 'falha extensa' });
  });

  it('produz mensagem segura para valores primitivos após fallback', () => {
    const circular: unknown[] = [];
    circular.push(circular);
    expect(sanitizeError(circular)).toEqual(['[Circular]']);
    expect(sanitizeError('client_secret=valor')).toEqual({
      message: 'client_secret=[REDACTED]',
    });
    expect(sanitizeError(42)).toEqual({ message: 42 });
  });
});
