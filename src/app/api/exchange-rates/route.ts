import { connection } from "next/server";
import { FALLBACK_USD_TO_EUR } from "@/lib/currency";

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=USD&to=EUR";

type RateCache = {
  usdToEur: number;
  fetchedAt: number;
  rateDate: string;
  source: "frankfurter" | "fallback";
};

let cache: RateCache | null = null;

export async function GET() {
  await connection();

  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return jsonResponse(cache, false);
  }

  try {
    const response = await fetch(FRANKFURTER_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Frankfurter respondió ${response.status}`);
    }

    const data = (await response.json()) as {
      date?: string;
      rates?: { EUR?: number };
    };
    const usdToEur = Number(data.rates?.EUR);

    if (!Number.isFinite(usdToEur) || usdToEur <= 0) {
      throw new Error("Tipo de cambio inválido");
    }

    cache = {
      usdToEur,
      fetchedAt: now,
      rateDate: data.date ?? new Date(now).toISOString().slice(0, 10),
      source: "frankfurter",
    };

    return jsonResponse(cache, false);
  } catch (error) {
    console.error("Exchange rate request failed", error);

    if (cache) {
      return jsonResponse(cache, true);
    }

    cache = {
      usdToEur: FALLBACK_USD_TO_EUR,
      fetchedAt: now,
      rateDate: new Date(now).toISOString().slice(0, 10),
      source: "fallback",
    };

    return jsonResponse(cache, true);
  }
}

function jsonResponse(rate: RateCache, stale: boolean): Response {
  return Response.json(
    {
      base: "USD",
      rates: { EUR: rate.usdToEur },
      fetchedAt: new Date(rate.fetchedAt).toISOString(),
      rateDate: rate.rateDate,
      source: rate.source,
      stale,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=43200",
      },
    },
  );
}
