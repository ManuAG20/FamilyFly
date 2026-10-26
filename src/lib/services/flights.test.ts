import { describe, expect, it } from "vitest";
import { searchFlights } from "@/lib/services/flights";
import type { FlightSearchQuery } from "@/lib/search-params";

const query: FlightSearchQuery = {
  origin: "LIM",
  destination: "MAD",
  tripType: "roundtrip",
  departureDate: "2026-11-15",
  returnDate: "2026-11-29",
  passengers: 2,
  maxStops: 1,
  flexible: true,
  anyDestination: false,
};

describe("flight search service", () => {
  it("searches a flexible window and returns sorted priced offers", async () => {
    const response = await searchFlights(query);

    expect(response.meta.provider).toBe("mock");
    expect(response.meta.flexibleDates).toHaveLength(7);
    expect(response.meta.flexibleDates).toContain("2026-11-12");
    expect(response.meta.flexibleDates).toContain("2026-11-18");
    expect(response.offers.length).toBe(response.meta.offersCount);
    expect(response.offers.length).toBeGreaterThan(0);
    expect(response.offers.every((offer) => offer.stops <= 1)).toBe(true);
    expect(response.offers.every((offer) => offer.dataAgeHours >= 0)).toBe(true);

    const prices = response.offers.map((offer) => offer.price.amount);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it("keeps the return date offset aligned with flexible departures", async () => {
    const response = await searchFlights({ ...query, flexible: true });
    const dates = new Set(response.offers.map((offer) => offer.requestedDepartureDate));

    for (const departureDate of dates) {
      const matches = response.offers.filter(
        (offer) => offer.requestedDepartureDate === departureDate,
      );
      expect(matches.every((offer) => offer.requestedReturnDate !== null)).toBe(true);
      expect(matches.length).toBeGreaterThan(0);

      for (const offer of matches) {
        const returnDate = offer.requestedReturnDate;
        if (!returnDate) throw new Error("La vuelta flexible no debería ser nula");
        const departure = new Date(`${offer.requestedDepartureDate}T00:00:00Z`).getTime();
        const arrival = new Date(`${returnDate}T00:00:00Z`).getTime();
        expect(Math.round((arrival - departure) / 86_400_000)).toBe(14);
      }
    }
  });

  it("uses a single date when flexibility is disabled", async () => {
    const response = await searchFlights({ ...query, flexible: false });

    expect(response.meta.flexibleDates).toEqual(["2026-11-15"]);
    expect(response.offers.every((offer) => offer.requestedDepartureDate === "2026-11-15")).toBe(
      true,
    );
  });

  it("supports any destination searches", async () => {
    const response = await searchFlights({
      ...query,
      destination: null,
      tripType: "oneway",
      returnDate: null,
      anyDestination: true,
      flexible: false,
    });

    expect(response.meta.anyDestination).toBe(true);
    expect(response.offers.length).toBeGreaterThan(0);
    expect(response.offers.every((offer) => offer.legs.length === 1)).toBe(true);
  });
});
