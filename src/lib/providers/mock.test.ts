import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/providers/mock";
import type { FlightSearchRequest } from "@/lib/providers/types";

const provider = new MockProvider();

const roundTrip: FlightSearchRequest = {
  origin: "LIM",
  destination: "MAD",
  departureDate: "2026-11-15",
  returnDate: "2026-11-29",
  passengers: 2,
  maxStops: null,
};

describe("MockProvider", () => {
  it("returns round trip offers with two legs and valid pricing", async () => {
    const offers = await provider.searchFlights(roundTrip);

    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => offer.legs.length === 2)).toBe(true);
    expect(offers.every((offer) => offer.price.currency === "USD")).toBe(true);
    expect(offers.every((offer) => offer.price.amount > 0)).toBe(true);
    expect(offers.every((offer) => offer.provider === "mock")).toBe(true);
    expect(offers.every((offer) => offer.deepLink.startsWith("https://"))).toBe(true);
    expect(offers.every((offer) => offer.legs[0].direction === "outbound")).toBe(true);
    expect(offers.every((offer) => offer.legs[1].direction === "return")).toBe(true);
  });

  it("keeps segment airlines consistent with the offer airline", async () => {
    const offers = await provider.searchFlights(roundTrip);
    const airlines = new Set(offers.map((offer) => offer.airlineCode));

    for (const offer of offers) {
      for (const leg of offer.legs) {
        for (const segment of leg.segments) {
          expect(airlines.has(segment.marketingAirlineCode)).toBe(true);
        }
      }
    }
  });

  it("filters by maximum stops", async () => {
    const offers = await provider.searchFlights({ ...roundTrip, maxStops: 0 });

    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => offer.stops === 0)).toBe(true);
  });

  it("is deterministic for the same search", async () => {
    const first = await provider.searchFlights(roundTrip);
    const second = await provider.searchFlights(roundTrip);

    expect(first.map((offer) => [offer.id, offer.price.amount])).toEqual(
      second.map((offer) => [offer.id, offer.price.amount]),
    );
  });

  it("searches any destination from Madrid sorted by price", async () => {
    const offers = await provider.searchFlights({
      origin: "MAD",
      destination: null,
      departureDate: "2026-11-20",
      returnDate: null,
      passengers: 1,
      maxStops: null,
    });

    expect(offers.length).toBeGreaterThan(1);
    expect(offers.length).toBeLessThanOrEqual(16);
    const destinations = new Set(
      offers.map((offer) => offer.legs[0].segments.at(-1)?.destination),
    );
    expect(destinations.size).toBeGreaterThan(1);
    expect(offers.every((offer) => offer.legs[0].segments[0].origin === "MAD")).toBe(true);

    const prices = offers.map((offer) => offer.price.amount);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it("returns a sorted cheapest destinations list", async () => {
    const destinations = await provider.getCheapestDestinations({
      origin: "MAD",
      departureDate: "2026-11-20",
      returnDate: "2026-11-27",
      passengers: 1,
      limit: 5,
    });

    expect(destinations).toHaveLength(5);
    expect(destinations.every((item) => item.city.length > 0)).toBe(true);
    expect(destinations.every((item) => item.destination !== "MAD")).toBe(true);
    expect(destinations[0].price).toBeLessThanOrEqual(destinations[4].price);
  });

  it("builds a consecutive price calendar", async () => {
    const calendar = await provider.getPriceCalendar({
      origin: "LIM",
      destination: "MAD",
      startDate: "2026-11-15",
      days: 5,
      passengers: 1,
    });

    expect(calendar.map((entry) => entry.date)).toEqual([
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
    ]);
    expect(calendar.every((entry) => entry.price > 0)).toBe(true);
    expect(calendar.every((entry) => entry.currency === "USD")).toBe(true);
  });

  it("returns no offers for unknown airports", async () => {
    expect(
      await provider.searchFlights({ ...roundTrip, origin: "XXX", destination: "YYY" }),
    ).toEqual([]);
    expect(
      await provider.getPriceCalendar({
        origin: "XXX",
        destination: "MAD",
        startDate: "2026-11-15",
        days: 3,
        passengers: 1,
      }),
    ).toEqual([]);
    expect(
      await provider.getCheapestDestinations({
        origin: "XXX",
        departureDate: "2026-11-15",
        passengers: 1,
      }),
    ).toEqual([]);
  });
});
