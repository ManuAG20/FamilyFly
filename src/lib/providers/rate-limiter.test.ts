import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/lib/providers/rate-limiter";

describe("RateLimiter", () => {
  it("fails fast when the window is saturated for too long", async () => {
    const limiter = new RateLimiter({
      maxRequestsPerMinute: 2,
      maxWaitMs: 100,
      now: () => 1_000,
      sleep: async () => undefined,
    });

    await limiter.acquire();
    await limiter.acquire();

    await expect(limiter.acquire()).rejects.toMatchObject({ code: "rate_limit" });
  });

  it("waits until the window frees a slot", async () => {
    let now = 1_000;
    const sleeps: number[] = [];
    const limiter = new RateLimiter({
      maxRequestsPerMinute: 1,
      maxWaitMs: 70_000,
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    });

    await limiter.acquire();
    now += 30_000;
    await limiter.acquire();

    expect(sleeps).toEqual([30_025]);
  });
});
