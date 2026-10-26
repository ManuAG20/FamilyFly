import { getAirline, type Airline } from "@/data/airlines";
import { airports, type Airport } from "@/data/airports";
import { buildIsoDateTime, addDays } from "@/lib/dates";
import { buildGoogleFlightsUrl } from "@/lib/flights/google-flights";
import { getAirport } from "@/lib/airports";
import type { CurrencyCode } from "@/lib/currency";
import type {
  CheapestDestination,
  CheapestDestinationsRequest,
  FlightLeg,
  FlightOffer,
  FlightProvider,
  FlightProviderId,
  FlightSearchRequest,
  PriceCalendarEntry,
  PriceCalendarRequest,
} from "@/lib/providers/types";

const CURRENCY: CurrencyCode = "USD";
const DAY_MS = 24 * 60 * 60 * 1000;

const PERU_AIRLINES = ["LA", "H2", "JA"];
const EUROPE_AIRLINES = [
  "IB",
  "VY",
  "FR",
  "U2",
  "UX",
  "KL",
  "AF",
  "LH",
  "LX",
  "TP",
  "AZ",
  "TK",
  "W6",
  "EW",
  "SK",
  "AY",
  "EI",
  "SN",
  "OS",
  "LO",
  "BT",
  "AT",
  "TU",
];
const AMERICA_AIRLINES = ["LA", "AV", "CM", "AA", "AC", "JA", "H2"];
const TRANSATLANTIC_AIRLINES = ["IB", "UX", "PU", "LA", "KL", "AF", "LH", "TP", "AV", "CM", "AA"];

const EUROPE_COUNTRIES = new Set([
  "ES",
  "PT",
  "FR",
  "NL",
  "BE",
  "IT",
  "DE",
  "GB",
  "IE",
  "CH",
  "AT",
  "DK",
  "SE",
  "NO",
  "FI",
  "PL",
  "CZ",
  "HU",
  "GR",
  "TR",
  "IS",
  "MT",
  "LU",
  "RS",
  "MA",
  "TN",
]);

const NONSTOP_ROUTES = new Set([
  "LIM-MAD",
  "MAD-LIM",
  "LIM-BCN",
  "BCN-LIM",
  "MAD-BCN",
  "BCN-MAD",
  "MAD-LIS",
  "LIS-MAD",
  "MAD-LHR",
  "LHR-MAD",
  "MAD-CDG",
  "CDG-MAD",
  "MAD-AMS",
  "AMS-MAD",
  "MAD-FCO",
  "FCO-MAD",
  "MAD-MUC",
  "MUC-MAD",
  "MAD-FRA",
  "FRA-MAD",
  "MAD-BRU",
  "BRU-MAD",
  "MAD-ZRH",
  "ZRH-MAD",
  "MAD-VIE",
  "VIE-MAD",
  "MAD-IST",
  "IST-MAD",
  "MAD-RAK",
  "RAK-MAD",
  "MAD-CMN",
  "CMN-MAD",
  "MAD-TUN",
  "TUN-MAD",
  "LIM-CUZ",
  "CUZ-LIM",
  "LIM-AQP",
  "AQP-LIM",
  "LIM-IQT",
  "IQT-LIM",
  "LIM-PIU",
  "PIU-LIM",
  "LIM-TRU",
  "TRU-LIM",
  "LIM-CIX",
  "CIX-LIM",
  "MAD-PMI",
  "PMI-MAD",
  "MAD-AGP",
  "AGP-MAD",
  "MAD-VLC",
  "VLC-MAD",
  "MAD-SVQ",
  "SVQ-MAD",
  "MAD-SCQ",
  "SCQ-MAD",
  "MAD-BIO",
  "BIO-MAD",
]);

const MAD_DESTINATIONS = [
  "BCN",
  "LIS",
  "OPO",
  "CDG",
  "AMS",
  "FCO",
  "LHR",
  "BER",
  "MUC",
  "IST",
  "RAK",
  "VLC",
];

const PERU_DESTINATIONS = ["MAD", "BCN", "VLC", "AGP", "LIS", "PMI"];

const GENERIC_DESTINATIONS = ["MAD", "BCN", "LIS", "CDG", "AMS", "FCO", "LHR", "BER"];

const CONNECTION_HUBS = [
  "MAD",
  "LIS",
  "AMS",
  "CDG",
  "FRA",
  "BOG",
  "PTY",
  "MIA",
  "GRU",
  "IST",
  "MUC",
  "FCO",
];

const AIRLINE_PRICE_FACTOR: Record<string, number> = {
  FR: 0.78,
  U2: 0.82,
  W6: 0.8,
  VY: 0.86,
  EW: 0.88,
  H2: 0.9,
  JA: 0.88,
  IB: 1.12,
  UX: 1.04,
  PU: 0.98,
  LA: 1.06,
  KL: 1.08,
  AF: 1.1,
  LH: 1.12,
  LX: 1.14,
  TP: 1.02,
  AZ: 1.06,
  TK: 0.96,
  AV: 1.02,
  CM: 1.05,
  AA: 1.1,
  AC: 1.12,
  AT: 0.95,
  TU: 0.93,
};

export class MockProvider implements FlightProvider {
  readonly id: FlightProviderId = "mock";

  async searchFlights(request: FlightSearchRequest): Promise<FlightOffer[]> {
    if (!request.destination) {
      return this.searchAnyDestination(request);
    }

    return this.buildOffers(request, request.destination, 9);
  }

  async getPriceCalendar(request: PriceCalendarRequest): Promise<PriceCalendarEntry[]> {
    const destination = getAirport(request.destination);
    const origin = getAirport(request.origin);
    if (!origin || !destination) return [];

    return Array.from({ length: request.days }, (_, index) => {
      const date = addDays(request.startDate, index);
      const seed = hashString(`${request.origin}-${request.destination}-${date}-calendar`);
      const random = mulberry32(seed);
      const base = estimateBasePrice(origin, destination, date, random);
      const weekendFactor = isWeekend(date) ? 1.12 : 1;
      const price = Math.round((base * (0.78 + random() * 0.55) * weekendFactor) / 5) * 5;

      return {
        date,
        price,
        currency: CURRENCY,
      };
    });
  }

  async getCheapestDestinations(
    request: CheapestDestinationsRequest,
  ): Promise<CheapestDestination[]> {
    const origin = getAirport(request.origin);
    if (!origin) return [];

    const candidates = getDestinationCandidates(origin, request.limit ?? 8);
    const destinations: CheapestDestination[] = [];

    for (const destination of candidates) {
      const offers = this.buildOffers(
        {
          origin: request.origin,
          destination: destination.iata,
          departureDate: request.departureDate,
          returnDate: request.returnDate ?? null,
          passengers: request.passengers,
          maxStops: null,
        },
        destination.iata,
        2,
      );
      const cheapest = offers.sort((a, b) => a.price.amount - b.price.amount)[0];
      if (!cheapest) continue;

      destinations.push({
        origin: request.origin,
        destination: destination.iata,
        city: destination.city,
        country: destination.country,
        departureDate: request.departureDate,
        returnDate: request.returnDate ?? null,
        price: cheapest.price.amount,
        currency: cheapest.price.currency,
        airlineCode: cheapest.airlineCode,
        deepLink: cheapest.deepLink,
        fallbackLink: cheapest.fallbackLink,
      });
    }

    return destinations.sort((a, b) => a.price - b.price);
  }

  private searchAnyDestination(request: FlightSearchRequest): FlightOffer[] {
    const origin = getAirport(request.origin);
    if (!origin) return [];

    const candidates = getDestinationCandidates(origin, 8);
    const offers: FlightOffer[] = [];

    for (const destination of candidates) {
      offers.push(...this.buildOffers(request, destination.iata, 2));
    }

    return offers.sort((a, b) => a.price.amount - b.price.amount).slice(0, 16);
  }

  private buildOffers(
    request: FlightSearchRequest,
    destinationIata: string,
    count: number,
  ): FlightOffer[] {
    const origin = getAirport(request.origin);
    const destination = getAirport(destinationIata);
    if (!origin || !destination) return [];

    const isTransatlantic = isTransatlanticPair(origin, destination);
    const isEurope = isEuropePair(origin, destination);
    const isPeru = origin.countryCode === "PE" && destination.countryCode === "PE";
    const hasNonstop = hasNonstopRoute(origin.iata, destination.iata);
    const airlinePool = pickAirlinePool({ isTransatlantic, isEurope, isPeru });
    const offers: FlightOffer[] = [];

    for (let index = 0; index < count; index += 1) {
      const seed = hashString(
        `${origin.iata}-${destination.iata}-${request.departureDate}-${request.returnDate ?? "ow"}-${index}-${count}`,
      );
      const random = mulberry32(seed);
      const airline = getAirline(airlinePool[Math.floor(random() * airlinePool.length)]);
      const stops = pickStops({ index, isTransatlantic, isEurope, isPeru, hasNonstop, random });
      const route = buildRoute(origin, destination, stops, airline, random);
      const outbound = buildLeg("outbound", route, request.departureDate, airline.code, random);
      const legs: FlightLeg[] = [outbound];

      if (request.returnDate) {
        const reverseRoute = [...route].reverse();
        legs.push(
          buildLeg("return", reverseRoute, request.returnDate, airline.code, random),
        );
      }

      const basePrice = estimateBasePrice(origin, destination, request.departureDate, random);
      const airlineFactor = AIRLINE_PRICE_FACTOR[airline.code] ?? 1;
      const stopFactor = stops === 0 ? 1.08 : stops === 1 ? 1 : 0.89;
      const roundTripFactor = request.returnDate ? 1.82 : 1;
      const price =
        Math.round(
          (basePrice * airlineFactor * stopFactor * roundTripFactor * (0.92 + random() * 0.22)) /
            5,
        ) * 5;
      const observedHours = 1 + Math.floor(random() * 9);
      const observedAt = new Date(Date.now() - observedHours * 60 * 60 * 1000).toISOString();
      const stopsCount = legs.reduce((max, leg) => Math.max(max, leg.segments.length - 1), 0);
      const fallbackLink = buildGoogleFlightsUrl(request);

      offers.push({
        id: [
          "mock",
          origin.iata,
          destination.iata,
          request.departureDate,
          request.returnDate ?? "ow",
          index,
        ].join("-"),
        provider: this.id,
        airlineCode: airline.code,
        airlineName: airline.name,
        price: {
          amount: price,
          currency: CURRENCY,
        },
        legs,
        totalDurationMinutes: legs.reduce((total, leg) => total + leg.durationMinutes, 0),
        stops: stopsCount,
        deepLink: fallbackLink,
        fallbackLink,
        observedAt,
        source: "mock-cache",
        requestedDepartureDate: request.departureDate,
        requestedReturnDate: request.returnDate,
      });
    }

    return offers.filter(
      (offer) => request.maxStops === null || offer.stops <= request.maxStops,
    );
  }
}

function pickAirlinePool({
  isTransatlantic,
  isEurope,
  isPeru,
}: {
  isTransatlantic: boolean;
  isEurope: boolean;
  isPeru: boolean;
}): string[] {
  if (isPeru) return PERU_AIRLINES;
  if (isTransatlantic) return TRANSATLANTIC_AIRLINES;
  if (isEurope) return EUROPE_AIRLINES;
  return AMERICA_AIRLINES;
}

function pickStops({
  index,
  isTransatlantic,
  isEurope,
  isPeru,
  hasNonstop,
  random,
}: {
  index: number;
  isTransatlantic: boolean;
  isEurope: boolean;
  isPeru: boolean;
  hasNonstop: boolean;
  random: () => number;
}): number {
  if (index === 0 && hasNonstop) return 0;
  if (isPeru) return random() < 0.55 ? 0 : 1;
  if (isEurope) {
    if (random() < 0.4) return 0;
    if (random() < 0.85) return 1;
    return 2;
  }
  if (isTransatlantic) return random() < 0.22 ? 2 : index === 0 ? 0 : 1;
  if (random() < 0.35) return 0;
  if (random() < 0.85) return 1;
  return 2;
}

function buildRoute(
  origin: Airport,
  destination: Airport,
  stops: number,
  airline: Airline,
  random: () => number,
): Airport[] {
  if (stops === 0) return [origin, destination];

  const used = new Set([origin.iata, destination.iata]);
  const route: Airport[] = [origin];
  const candidates = [...airline.hubs, ...CONNECTION_HUBS]
    .map((iata) => getAirport(iata))
    .filter((airport): airport is Airport => Boolean(airport))
    .filter((airport) => !used.has(airport.iata));

  for (let index = 0; index < stops; index += 1) {
    const pool = candidates.filter((airport) => !used.has(airport.iata));
    if (pool.length === 0) break;
    const hub = pool[Math.floor(random() * pool.length)];
    used.add(hub.iata);
    route.push(hub);
  }

  route.push(destination);
  return route;
}

function buildLeg(
  direction: "outbound" | "return",
  route: Airport[],
  date: string,
  airlineCode: string,
  random: () => number,
): FlightLeg {
  const startMinutes = 300 + Math.floor(random() * 1020);
  let cursor = new Date(buildIsoDateTime(date, startMinutes));
  const segments: FlightLeg["segments"] = [];

  for (let index = 0; index < route.length - 1; index += 1) {
    const from = route[index];
    const to = route[index + 1];
    const distance = haversineKm(from, to);
    const durationMinutes = Math.max(35, Math.round((distance / 820) * 60 + 25));
    const departureAt = new Date(cursor);
    const arrivalAt = new Date(departureAt.getTime() + durationMinutes * 60 * 1000);

    segments.push({
      origin: from.iata,
      destination: to.iata,
      departureAt: departureAt.toISOString(),
      arrivalAt: arrivalAt.toISOString(),
      marketingAirlineCode: airlineCode,
      flightNumber: `${airlineCode}${100 + Math.floor(random() * 8999)}`,
    });

    const layoverMinutes = 75 + Math.floor(random() * 95);
    cursor = new Date(arrivalAt.getTime() + layoverMinutes * 60 * 1000);
  }

  const first = segments[0];
  const last = segments[segments.length - 1];
  const durationMinutes =
    (new Date(last.arrivalAt).getTime() - new Date(first.departureAt).getTime()) / 60000;

  return {
    direction,
    durationMinutes: Math.round(durationMinutes),
    segments,
  };
}

function estimateBasePrice(
  origin: Airport,
  destination: Airport,
  departureDate: string,
  random: () => number,
): number {
  const distance = haversineKm(origin, destination);
  const isTransatlantic = isTransatlanticPair(origin, destination);
  const isEurope = isEuropePair(origin, destination);
  const isPeru = origin.countryCode === "PE" && destination.countryCode === "PE";

  let base: number;
  if (isTransatlantic) {
    base = 360 + distance * 0.035 + random() * 260;
  } else if (isEurope) {
    base = 28 + distance * 0.05 + random() * 70;
  } else if (isPeru) {
    base = 38 + distance * 0.09 + random() * 45;
  } else {
    base = 110 + distance * 0.045 + random() * 180;
  }

  const date = new Date(`${departureDate}T00:00:00Z`).getTime();
  const dayOffset = Math.round(date / DAY_MS);
  const seasonFactor = 0.94 + ((dayOffset % 17) / 17) * 0.18;

  return Math.max(35, base * seasonFactor);
}

function getDestinationCandidates(origin: Airport, limit: number): Airport[] {
  let codes: string[];

  if (origin.iata === "MAD") {
    codes = MAD_DESTINATIONS;
  } else if (origin.countryCode === "PE") {
    codes = PERU_DESTINATIONS;
  } else {
    codes = GENERIC_DESTINATIONS;
  }

  const candidates = codes
    .map((code) => getAirport(code))
    .filter((airport): airport is Airport => airport !== undefined && airport.iata !== origin.iata);

  const fallback = airports
    .filter(
      (airport) =>
        airport.iata !== origin.iata &&
        airport.countryCode !== origin.countryCode &&
        (EUROPE_COUNTRIES.has(airport.countryCode) || airport.countryCode === "PE"),
    )
    .slice(0, 20);

  const seen = new Set(candidates.map((airport) => airport.iata));
  for (const airport of fallback) {
    if (candidates.length >= limit) break;
    if (!seen.has(airport.iata)) {
      candidates.push(airport);
      seen.add(airport.iata);
    }
  }

  return candidates.slice(0, limit);
}

function isTransatlanticPair(origin: Airport, destination: Airport): boolean {
  const originEurope = EUROPE_COUNTRIES.has(origin.countryCode);
  const destinationEurope = EUROPE_COUNTRIES.has(destination.countryCode);
  const originPeru = origin.countryCode === "PE";
  const destinationPeru = destination.countryCode === "PE";

  if ((originPeru && destinationEurope) || (destinationPeru && originEurope)) {
    return true;
  }

  return haversineKm(origin, destination) > 6500;
}

function isEuropePair(origin: Airport, destination: Airport): boolean {
  return (
    EUROPE_COUNTRIES.has(origin.countryCode) && EUROPE_COUNTRIES.has(destination.countryCode)
  );
}

function hasNonstopRoute(origin: string, destination: string): boolean {
  return NONSTOP_ROUTES.has(`${origin}-${destination}`);
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function haversineKm(from: Airport, to: Airport): number {
  const earthRadius = 6371;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const deltaLat = ((to.lat - from.lat) * Math.PI) / 180;
  const deltaLon = ((to.lon - from.lon) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}


