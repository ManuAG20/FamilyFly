import { describe, expect, it, vi } from "vitest";
import { MemoryFlightCache } from "@/lib/cache/flight-cache";
import { TravelpayoutsProvider } from "@/lib/providers/travelpayouts";
import type { FlightSearchRequest } from "@/lib/providers/types";

const NOW = Date.parse("2026-10-26T12:00:00Z");

const oneWayRequest: FlightSearchRequest = {
  origin: "LIM",
  destination: "MAD",
  departureDate: "2026-12-28",
  returnDate: null,
  passengers: 1,
  maxStops: null,
};

const oneWayPrice = {
  link: "/search/LIM2812MAD1?t=abc",
  flight_number: "501",
  origin_airport: "LIM",
  destination_airport: "MAD",
  departure_at: "2026-12-28T19:20:00-05:00",
  airline: "AF",
  origin: "LIM",
  destination: "MAD",
  price: 1273,
  gate: "Gotogate",
  transfers: 1,
  duration: 875,
  duration_to: 875,
  return_transfers: 0,
  duration_back: 0,
};

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function makeProvider(
  fetchImpl: typeof fetch,
  overrides: Partial<ConstructorParameters<typeof TravelpayoutsProvider>[0]> = {},
) {
  return new TravelpayoutsProvider({
    token: "test-token",
    fetchImpl,
    cache: new MemoryFlightCache(() => NOW),
    rateLimiter: null,
    now: () => NOW,
    sleep: async () => undefined,
    ttlMs: 60_000,
    staleMs: 300_000,
    ...overrides,
  });
}

describe("TravelpayoutsProvider", () => {
  it("maps a one-way cached price to an offer", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, currency: "usd", data: [oneWayPrice] }),
    ) as unknown as typeof fetch;
    const provider = makeProvider(fetchMock);

    const offers = await provider.searchFlights(oneWayRequest);

    expect(offers).toHaveLength(1);
    const offer = offers[0];
    expect(offer.provider).toBe("travelpayouts");
    expect(offer.price).toEqual({ amount: 1273, currency: "USD" });
    expect(offer.airlineCode).toBe("AF");
    expect(offer.legs).toHaveLength(1);
    expect(offer.stops).toBe(1);
    expect(offer.legs[0].durationMinutes).toBe(875);
    expect(offer.legs[0].segments[0]).toMatchObject({
      origin: "LIM",
      destination: "MAD",
      departureAt: "2026-12-28T19:20:00-05:00",
      arrivalAt: "2026-12-29T15:55:00+01:00",
      marketingAirlineCode: "AF",
      flightNumber: "AF501",
    });
    expect(offer.deepLink).toBe("https://www.aviasales.com/search/LIM2812MAD1?t=abc");
    expect(offer.fallbackLink).toContain("google.com/travel/flights");
    expect(offer.observedAt).toBe(new Date(NOW).toISOString());

    const url = new URL(String((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]));
    expect(url.searchParams.get("origin")).toBe("LIM");
    expect(url.searchParams.get("destination")).toBe("MAD");
    expect(url.searchParams.get("departure_at")).toBe("2026-12-28");
    expect(url.searchParams.get("one_way")).toBe("true");
    expect(url.searchParams.get("currency")).toBe("usd");
  });

  it("maps round-trip offers with return leg and total duration", async () => {
    const roundTripPrice = {
      ...oneWayPrice,
      price: 1512,
      return_at: "2027-01-18T11:00:00+01:00",
      return_transfers: 0,
      duration: 1605,
      duration_to: 875,
      duration_back: 730,
    };
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, currency: "usd", data: [roundTripPrice] }),
    ) as unknown as typeof fetch;
    const provider = makeProvider(fetchMock);

    const offers = await provider.searchFlights({
      ...oneWayRequest,
      returnDate: "2027-01-18",
    });

    expect(offers).toHaveLength(1);
    expect(offers[0].legs).toHaveLength(2);
    expect(offers[0].legs[1].direction).toBe("return");
    expect(offers[0].legs[1].segments[0]).toMatchObject({
      origin: "MAD",
      destination: "LIM",
      departureAt: "2027-01-18T11:00:00+01:00",
      arrivalAt: "2027-01-18T17:10:00-05:00",
    });
    expect(offers[0].totalDurationMinutes).toBe(1605);
  });

  it("filters mismatched dates and stops", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: [{ ...oneWayPrice, departure_at: "2026-12-27T19:20:00-05:00" }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: [{ ...oneWayPrice, transfers: 2 }] }),
      ) as unknown as typeof fetch;
    const provider = makeProvider(fetchMock);

    expect(await provider.searchFlights(oneWayRequest)).toEqual([]);

    const noStops = await provider.searchFlights({ ...oneWayRequest, maxStops: 1 });
    expect(noStops).toEqual([]);
  });

  it("searches any destination without a destination filter", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        data: [
          {
            ...oneWayPrice,
            destination: "PAR",
            destination_airport: "ORY",
            departure_at: "2026-12-28T05:25:00+01:00",
          },
          {
            ...oneWayPrice,
            destination: "RAK",
            destination_airport: "RAK",
            departure_at: "2026-12-28T09:00:00+01:00",
          },
        ],
      }),
    ) as unknown as typeof fetch;
    const provider = makeProvider(fetchMock);

    const offers = await provider.searchFlights({ ...oneWayRequest, destination: null });

    expect(offers).toHaveLength(1);
    expect(offers[0].legs[0].segments[0].destination).toBe("ORY");
    const url = new URL(String((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]));
    expect(url.searchParams.has("destination")).toBe(false);
    expect(url.searchParams.get("unique")).toBe("true");
    expect(url.searchParams.get("sorting")).toBe("route");
  });

  it("uses the cache for repeated searches and refreshes after TTL", async () => {
    let now = NOW;
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, data: [oneWayPrice] }),
    ) as unknown as typeof fetch;
    const cache = new MemoryFlightCache(() => now);
    const provider = makeProvider(fetchMock, {
      cache,
      now: () => now,
      ttlMs: 1000,
    });

    await provider.searchFlights(oneWayRequest);
    await provider.searchFlights(oneWayRequest);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now += 2000;
    await provider.searchFlights(oneWayRequest);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("serves stale cache when the provider fails", async () => {
    let now = NOW;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: [oneWayPrice] }))
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline")) as unknown as typeof fetch;
    const cache = new MemoryFlightCache(() => now);
    const provider = makeProvider(fetchMock, {
      cache,
      now: () => now,
      ttlMs: 1000,
      staleMs: 10_000,
    });

    await provider.searchFlights(oneWayRequest);
    now += 2000;
    const offers = await provider.searchFlights(oneWayRequest);

    expect(offers).toHaveLength(1);
    expect(offers[0].observedAt).toBe(new Date(NOW).toISOString());
    expect(fetchMock).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("retries once after HTTP 429", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "too many" }, 429, { "retry-after": "0" }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: [oneWayPrice] })) as unknown as typeof fetch;
    const provider = makeProvider(fetchMock);

    const offers = await provider.searchFlights(oneWayRequest);
    expect(offers).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails with a config error when the token is missing", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const provider = makeProvider(fetchMock, { token: "" });

    await expect(provider.searchFlights(oneWayRequest)).rejects.toMatchObject({
      code: "config",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps grouped prices to a calendar", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const month = url.searchParams.get("departure_at");
      const data =
        month === "2026-12"
          ? {
              "2026-12-30": { ...oneWayPrice, price: 1200 },
              "2026-12-31": { ...oneWayPrice, price: 900 },
            }
          : {
              "2027-01-01": { ...oneWayPrice, price: 1100 },
            };
      return jsonResponse({ success: true, data });
    }) as unknown as typeof fetch;
    const provider = makeProvider(fetchMock);

    const calendar = await provider.getPriceCalendar({
      origin: "LIM",
      destination: "MAD",
      startDate: "2026-12-30",
      days: 3,
      returnDate: null,
      passengers: 1,
    });

    expect(calendar).toEqual([
      { date: "2026-12-30", price: 1200, currency: "USD" },
      { date: "2026-12-31", price: 900, currency: "USD" },
      { date: "2027-01-01", price: 1100, currency: "USD" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps city directions and falls back to latest prices", async () => {
    const cityDirections = {
      PAR: {
        ...oneWayPrice,
        destination: "PAR",
        destination_airport: "",
        price: 106,
        airline: "FR",
        departure_at: "2026-11-29T14:45:00+01:00",
        return_at: "2026-12-01T07:30:00+01:00",
      },
    };
    const latest = [
      {
        origin: "MAD",
        destination: "BCN",
        depart_date: "2026-11-20",
        return_date: "2026-11-24",
        value: 80,
        number_of_changes: 1,
        duration: 90,
        gate: "Tickets",
      },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: cityDirections }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: {} }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: latest })) as unknown as typeof fetch;
    const provider = makeProvider(fetchMock);

    const destinations = await provider.getCheapestDestinations({
      origin: "MAD",
      departureDate: "2026-11-29",
      returnDate: "2026-12-01",
      passengers: 1,
      limit: 5,
    });

    expect(destinations[0]).toMatchObject({
      destination: "PAR",
      price: 106,
      airlineCode: "FR",
      city: "PAR",
    });
    expect(destinations[0].deepLink).toContain("aviasales.com");

    const fallback = await provider.getCheapestDestinations({
      origin: "MAD",
      departureDate: "2026-11-20",
      returnDate: "2026-11-24",
      passengers: 1,
      limit: 4,
    });

    expect(fallback[0]).toMatchObject({
      destination: "BCN",
      city: "Barcelona",
      country: "España",
      price: 80,
    });
  });
});
