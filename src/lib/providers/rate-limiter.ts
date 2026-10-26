import { ProviderError } from "@/lib/providers/errors";

type RateLimiterOptions = {
  maxRequestsPerMinute: number;
  windowMs?: number;
  maxWaitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export class RateLimiter {
  private readonly maxRequestsPerMinute: number;
  private readonly windowMs: number;
  private readonly maxWaitMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private timestamps: number[] = [];

  constructor({
    maxRequestsPerMinute,
    windowMs = 60_000,
    maxWaitMs = 5_000,
    now = Date.now,
    sleep = defaultSleep,
  }: RateLimiterOptions) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.windowMs = windowMs;
    this.maxWaitMs = maxWaitMs;
    this.now = now;
    this.sleep = sleep;
  }

  async acquire(): Promise<void> {
    if (this.maxRequestsPerMinute <= 0) return;

    for (;;) {
      const now = this.now();
      this.timestamps = this.timestamps.filter((timestamp) => now - timestamp < this.windowMs);

      if (this.timestamps.length < this.maxRequestsPerMinute) {
        this.timestamps.push(now);
        return;
      }

      const waitMs = this.windowMs - (now - this.timestamps[0]) + 25;
      if (waitMs > this.maxWaitMs) {
        throw new ProviderError("Límite de peticiones alcanzado.", "rate_limit");
      }
      await this.sleep(waitMs);
    }
  }
}

export function getRateLimitPerMinute(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
