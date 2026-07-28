import { describe, expect, it } from 'vitest';
import { TOOL_CATALOG } from '../catalog/index.js';
import { ToolRequestGuard, type ServerLimits } from './requestGuard.js';

const definition = (method: string) => TOOL_CATALOG.find((tool) => tool.method === method)!;
const limits: ServerLimits = {
  maxConcurrency: 2,
  mutationMaxConcurrency: 1,
  readRatePerMinute: 2,
  mutationRatePerMinute: 1,
  sensitiveRatePerMinute: 1,
};

describe('contenção de chamadas', () => {
  it('rejeita concorrência mutável sem criar fila', () => {
    const guard = new ToolRequestGuard(limits);
    const first = guard.acquire(definition('pixCreateEvp'), false);
    const second = guard.acquire(definition('pixDeleteEvp'), false);

    expect(first.allowed).toBe(true);
    expect(second).toEqual({ allowed: false, retryAfterMs: 1_000 });
    if (first.allowed) first.lease.release();
    expect(guard.acquire(definition('pixDeleteEvp'), false).allowed).toBe(false);
  });

  it('aplica janelas separadas para leitura, mutação e saída sensível', () => {
    let now = 1_000;
    const guard = new ToolRequestGuard(limits, () => now);

    const readOne = guard.acquire(definition('pixDetailCharge'), false);
    if (readOne.allowed) readOne.lease.release();
    const readTwo = guard.acquire(definition('pixDetailCharge'), false);
    if (readTwo.allowed) readTwo.lease.release();
    expect(guard.acquire(definition('pixDetailCharge'), false)).toEqual({
      allowed: false,
      retryAfterMs: 60_000,
    });

    const sensitive = guard.acquire(definition('getAccountCredentials'), true);
    if (sensitive.allowed) sensitive.lease.release();
    expect(guard.acquire(definition('getAccountCredentials'), true).allowed).toBe(false);

    now += 60_001;
    expect(guard.acquire(definition('pixDetailCharge'), false).allowed).toBe(true);
    expect(guard.acquire(definition('getAccountCredentials'), true).allowed).toBe(true);
  });
});
