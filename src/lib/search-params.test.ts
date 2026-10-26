import { describe, expect, it } from "vitest";
import {
  flightQueryToSearchParams,
  parseFlightQuery,
  SearchQueryError,
} from "@/lib/search-params";

describe("search params", () => {
  it("parses a complete round trip", () => {
    const query = parseFlightQuery(
      new URLSearchParams(
        "origin=LIM&destination=MAD&trip=roundtrip&departure=2026-11-15&return=2026-11-29&passengers=2&maxStops=1&flexible=1",
      ),
    );

    expect(query).toEqual({
      origin: "LIM",
      destination: "MAD",
      tripType: "roundtrip",
      departureDate: "2026-11-15",
      returnDate: "2026-11-29",
      passengers: 2,
      maxStops: 1,
      flexible: true,
      anyDestination: false,
    });
  });

  it("supports any destination from Madrid", () => {
    const query = parseFlightQuery(
      new URLSearchParams(
        "origin=MAD&any=1&trip=oneway&departure=2026-11-20&passengers=1",
      ),
    );

    expect(query.destination).toBeNull();
    expect(query.anyDestination).toBe(true);
    expect(query.returnDate).toBeNull();
  });

  it("clamps passengers and ignores the return date on one way trips", () => {
    const query = parseFlightQuery(
      new URLSearchParams(
        "origin=LIM&destination=CUZ&trip=oneway&departure=2026-11-20&return=2026-11-25&passengers=99",
      ),
    );

    expect(query.passengers).toBe(9);
    expect(query.returnDate).toBeNull();
  });

  it("rejects invalid searches", () => {
    expect(() => parseFlightQuery(new URLSearchParams("origin=LIM"))).toThrow(SearchQueryError);
    expect(() =>
      parseFlightQuery(
        new URLSearchParams(
          "origin=LIM&destination=MAD&trip=roundtrip&departure=2026-11-29&return=2026-11-15",
        ),
      ),
    ).toThrow(SearchQueryError);
    expect(() =>
      parseFlightQuery(new URLSearchParams("origin=LIM&destination=MAD&departure=not-a-date")),
    ).toThrow(SearchQueryError);
  });

  it("serializes back to URL search params", () => {
    const params = flightQueryToSearchParams({
      origin: "MAD",
      destination: null,
      tripType: "oneway",
      departureDate: "2026-11-20",
      returnDate: null,
      passengers: 3,
      maxStops: 0,
      flexible: true,
      anyDestination: true,
    });

    expect(params.get("origin")).toBe("MAD");
    expect(params.get("destination")).toBeNull();
    expect(params.get("any")).toBe("1");
    expect(params.get("flexible")).toBe("1");
    expect(params.get("maxStops")).toBe("0");
    expect(params.get("passengers")).toBe("3");
  });
});
