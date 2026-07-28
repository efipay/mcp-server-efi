import type { ToolDefinition } from '../catalog/index.js';

const WINDOW_MS = 60_000;

export interface ServerLimits {
  maxConcurrency: number;
  mutationMaxConcurrency: number;
  readRatePerMinute: number;
  mutationRatePerMinute: number;
  sensitiveRatePerMinute: number;
}

export const DEFAULT_SERVER_LIMITS: Readonly<ServerLimits> = {
  maxConcurrency: 4,
  mutationMaxConcurrency: 1,
  readRatePerMinute: 60,
  mutationRatePerMinute: 10,
  sensitiveRatePerMinute: 1,
};

export interface GuardLease {
  release(): void;
}

export type GuardDecision =
  { allowed: true; lease: GuardLease } | { allowed: false; retryAfterMs: number };

type RateClass = 'read' | 'mutation' | 'sensitive';

export class ToolRequestGuard {
  private active = 0;
  private activeMutations = 0;
  private readonly events: Record<RateClass, number[]> = {
    read: [],
    mutation: [],
    sensitive: [],
  };

  constructor(
    private readonly limits: ServerLimits = DEFAULT_SERVER_LIMITS,
    private readonly now: () => number = Date.now,
  ) {}

  acquire(definition: ToolDefinition, sensitive: boolean): GuardDecision {
    const mutation = definition.annotations.readOnlyHint !== true;
    const now = this.now();
    const rateClass: RateClass = sensitive ? 'sensitive' : mutation ? 'mutation' : 'read';
    const rateLimit =
      rateClass === 'sensitive'
        ? this.limits.sensitiveRatePerMinute
        : rateClass === 'mutation'
          ? this.limits.mutationRatePerMinute
          : this.limits.readRatePerMinute;
    const events = this.events[rateClass];

    while (events.length > 0 && events[0] <= now - WINDOW_MS) events.shift();
    if (this.active >= this.limits.maxConcurrency) {
      return { allowed: false, retryAfterMs: 1_000 };
    }
    if (mutation && this.activeMutations >= this.limits.mutationMaxConcurrency) {
      return { allowed: false, retryAfterMs: 1_000 };
    }
    if (events.length >= rateLimit) {
      return {
        allowed: false,
        retryAfterMs: Math.max(1, events[0] + WINDOW_MS - now),
      };
    }

    events.push(now);
    this.active += 1;
    if (mutation) this.activeMutations += 1;

    let released = false;
    return {
      allowed: true,
      lease: {
        release: () => {
          if (released) return;
          released = true;
          this.active -= 1;
          if (mutation) this.activeMutations -= 1;
        },
      },
    };
  }
}
