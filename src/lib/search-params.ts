import { isIsoDate } from "@/lib/dates";

export type TripType = "oneway" | "roundtrip";

export type FlightSearchQuery = {
  origin: string;
  destination: string | null;
  tripType: TripType;
  departureDate: string;
  returnDate: string | null;
  passengers: number;
  maxStops: number | null;
  flexible: boolean;
  anyDestination: boolean;
};

export class SearchQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchQueryError";
  }
}

type SearchInput = URLSearchParams | Record<string, string | string[] | undefined>;

export function parseFlightQuery(input: SearchInput): FlightSearchQuery {
  const origin = read(input, "origin").toUpperCase();
  const anyDestination = isTruthy(read(input, "any"));
  const destination = anyDestination ? null : read(input, "destination").toUpperCase();
  const departureDate = read(input, "departure");
  const rawReturnDate = read(input, "return");
  const rawTrip = read(input, "trip");
  const tripType: TripType = rawTrip === "oneway" ? "oneway" : rawReturnDate ? "roundtrip" : "oneway";
  const returnDate = tripType === "roundtrip" ? rawReturnDate : null;

  if (!/^[A-Z]{3}$/.test(origin)) {
    throw new SearchQueryError("Selecciona un aeropuerto de origen válido.");
  }

  if (!anyDestination && (!destination || !/^[A-Z]{3}$/.test(destination))) {
    throw new SearchQueryError("Selecciona un aeropuerto de destino válido.");
  }

  if (!isIsoDate(departureDate)) {
    throw new SearchQueryError("Selecciona una fecha de ida válida.");
  }

  if (returnDate && !isIsoDate(returnDate)) {
    throw new SearchQueryError("Selecciona una fecha de vuelta válida.");
  }

  if (returnDate && returnDate < departureDate) {
    throw new SearchQueryError("La fecha de vuelta debe ser posterior a la de ida.");
  }

  const passengers = clampInt(read(input, "passengers"), 1, 9, 1);
  const maxStopsValue = read(input, "maxStops");
  const maxStops = maxStopsValue === "" ? null : clampInt(maxStopsValue, 0, 2, 2);

  return {
    origin,
    destination: destination || null,
    tripType,
    departureDate,
    returnDate,
    passengers,
    maxStops,
    flexible: isTruthy(read(input, "flexible")),
    anyDestination,
  };
}

export function flightQueryToSearchParams(query: FlightSearchQuery): URLSearchParams {
  const params = new URLSearchParams({
    origin: query.origin,
    trip: query.tripType,
    departure: query.departureDate,
    passengers: String(query.passengers),
    flexible: query.flexible ? "1" : "0",
  });

  if (query.destination) {
    params.set("destination", query.destination);
  }

  if (query.returnDate) {
    params.set("return", query.returnDate);
  }

  if (query.maxStops !== null) {
    params.set("maxStops", String(query.maxStops));
  }

  if (query.anyDestination) {
    params.set("any", "1");
  }

  return params;
}

export function buildApiSearchPath(query: FlightSearchQuery): string {
  return `/api/flights/search?${flightQueryToSearchParams(query).toString()}`;
}

function read(input: SearchInput, key: string): string {
  if (input instanceof URLSearchParams) {
    return input.get(key)?.trim() ?? "";
  }

  const value = input[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

function isTruthy(value: string): boolean {
  return value === "1" || value === "true" || value === "on";
}

function clampInt(value: string, min: number, max: number, fallback: number): number {
  if (!/^\d+$/.test(value)) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
