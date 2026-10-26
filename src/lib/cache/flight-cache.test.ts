import { describe, expect, it } from "vitest";
import { SqliteFlightCache } from "@/lib/cache/flight-cache";

describe("SqliteFlightCache", () => {
  it("stores values with TTL and serves stale values within the limit", () => {
    let now = 1_000;
    const cache = new SqliteFlightCache(":memory:", () => now);

    cache.set("route", { price: 100 }, 500);
    expect(cache.get("route")).toEqual({ value: { price: 100 }, fetchedAt: 1_000 });

    now = 1_600;
    expect(cache.get("route")).toBeNull();
    expect(cache.getStale("route", 5_000)).toEqual({
      value: { price: 100 },
      fetchedAt: 1_000,
    });

    now = 7_000;
    expect(cache.getStale("route", 5_000)).toBeNull();
    cache.close();
  });

  it("overwrites an existing key", () => {
    const cache = new SqliteFlightCache(":memory:", () => 1_000);

    cache.set("route", { price: 100 }, 500);
    cache.set("route", { price: 80 }, 500, 1_100);

    expect(cache.get("route")?.value).toEqual({ price: 80 });
    expect(cache.get("route")?.fetchedAt).toBe(1_100);
    cache.close();
  });
});
