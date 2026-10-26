import { getAirline } from "@/data/airlines";
import { addDays, parseIsoDate } from "@/lib/dates";
import { getAirport, getAirportTimeZone } from "@/lib/airports";
import {
  getFlightCache,
  getFlightCacheStaleMs,
  getFlightCacheTtlMs,
  type CacheEnvelope,
  type FlightCache,
} from "@/lib/cache/flight-cache";
import type { CurrencyCode } from "@/lib/currency";
import { buildGoogleFlightsUrl } from "@/lib/flights/google-flights";
import { ProviderError } from "@/lib/providers/errors";
import { getRateLimitPerMinute, RateLimiter } from "@/lib/providers/rate-limiter";
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

const PROVIDER_ID: FlightProviderId = "travelpayouts";
const CURRENCY: CurrencyCode = "USD";
const CACHE_VERSION = "v1";
const PRICES_FOR_DATES = "/aviasales/v3/prices_for_dates";
const GROUPED_PRICES = "/aviasales/v3/grouped_prices";
const CITY_DIRECTIONS = "/v1/city-directions";
const LATEST_PRICES = "/v2/prices/latest";
const DEFAULT_BASE_URL = "https://api.travelpayouts.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESULTS = 30;
const RETRIES = 1;
const EUROPEAN_COUNTRY_CODES = new Set([
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
  "HR",
  "SI",
  "SK",
  "BG",
  "RO",
  "EE",
  "LV",
  "LT",
  "UA",
  "MD",
  "AL",
  "MK",
  "BA",
  "ME",
  "CY",
]);

type TravelpayoutsPrice = {
  link?: string;
  flight_number?: string | number;
  origin_airport?: string;
  destination_airport?: string;
  departure_at?: string;
  airline?: string;
  destination?: string;
  origin?: string;
  price?: number | string;
  gate?: string;
  return_transfers?: number | string;
  duration?: number | string;
  duration_to?: number | string;
  duration_back?: number | string;
  transfers?: number | string;
  return_at?: string;
};

type CityDirectionPrice = TravelpayoutsPrice & {
  expires_at?: string;
};

type LatestPrice = {
  depart_date?: string;
  return_date?: string;
  origin?: string;
  destination?: string;
  found_at?: string;
  value?: number | string;
  number_of_changes?: number | string;
  duration?: number | string;
  gate?: string;
};

type ApiEnvelope<T> = {
  success?: boolean | string;
  data?: T;
  error?: string;
  currency?: string;
};

type TravelpayoutsProviderOptions = {
  token?: string;
  baseUrl?: string;
  cache?: FlightCache;
  rateLimiter?: RateLimiter | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  ttlMs?: number;
  staleMs?: number;
};

export class TravelpayoutsProvider implements FlightProvider {
  readonly id: FlightProviderId = PROVIDER_ID;

  private readonly token: string | undefined;
  private readonly baseUrl: string;
  private readonly cache: FlightCache;
  private readonly rateLimiter: RateLimiter | null;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly timeoutMs: number;
  private readonly ttlMs: number;
  private readonly staleMs: number;

  constructor(options: TravelpayoutsProviderOptions = {}) {
    this.token = (options.token ?? process.env.TRAVELPAYOUTS_TOKEN)?.trim() || undefined;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.cache = options.cache ?? getFlightCache();
    this.rateLimiter =
      options.rateLimiter === undefined
        ? new RateLimiter({
            maxRequestsPerMinute: getRateLimitPerMinute(
              "TRAVELPAYOUTS_RATE_LIMIT_PER_MINUTE",
              30,
            ),
          })
        : options.rateLimiter;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
    this.timeoutMs = options.timeoutMs ?? readPositiveNumber("FLIGHT_PROVIDER_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
    this.ttlMs = options.ttlMs ?? getFlightCacheTtlMs();
    this.staleMs = options.staleMs ?? getFlightCacheStaleMs();
  }

  async searchFlights(request: FlightSearchRequest): Promise<FlightOffer[]> {
    const isOneWay = request.returnDate === null;
    const params = new URLSearchParams({
      origin: request.origin,
      departure_at: request.departureDate,
      one_way: String(isOneWay),
      currency: CURRENCY.toLowerCase(),
      limit: String(MAX_RESULTS),
      page: "1",
      sorting: request.destination ? "price" : "route",
    });

    if (request.destination) {
      params.set("destination", request.destination);
    } else {
      params.set("unique", "true");
    }

    if (request.returnDate) {
      params.set("return_at", request.returnDate);
    }

    if (request.maxStops === 0) {
      params.set("direct", "true");
    }

    const cached = await this.fetchCached<TravelpayoutsPrice[]>(PRICES_FOR_DATES, params);
    const offers = cached.value
      .filter((item) => request.destination !== null || !isKnownNonEuropean(item))
      .map((item) => mapOffer(item, request, cached.fetchedAt))
      .filter((offer): offer is FlightOffer => offer !== null)
      .filter((offer) => request.maxStops === null || offer.stops <= request.maxStops)
      .sort((a, b) => a.price.amount - b.price.amount);

    return dedupeOffers(offers);
  }

  async getPriceCalendar(request: PriceCalendarRequest): Promise<PriceCalendarEntry[]> {
    const endDate = addDays(request.startDate, Math.max(0, request.days - 1));
    const months = enumerateMonths(request.startDate, endDate);
    const prices = new Map<string, number>();

    for (const month of months) {
      const params = new URLSearchParams({
        origin: request.origin,
        destination: request.destination,
        departure_at: month,
        currency: CURRENCY.toLowerCase(),
        group_by: "departure_at",
      });

      if (request.returnDate) {
        params.set("return_at", request.returnDate.slice(0, 7));
      }

      const cached = await this.fetchCached<Record<string, TravelpayoutsPrice>>(
        GROUPED_PRICES,
        params,
      );

      for (const [date, item] of Object.entries(cached.value ?? {})) {
        if (date < request.startDate || date > endDate) continue;
        const price = toPositiveNumber(item.price);
        if (price === null) continue;
        const current = prices.get(date);
        if (current === undefined || price < current) prices.set(date, price);
      }
    }

    return [...prices.entries()]
      .map(([date, price]) => ({ date, price, currency: CURRENCY }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getCheapestDestinations(
    request: CheapestDestinationsRequest,
  ): Promise<CheapestDestination[]> {
    const limit = Math.min(Math.max(request.limit ?? 8, 1), MAX_RESULTS);
    const params = new URLSearchParams({
      origin: request.origin,
      currency: CURRENCY.toLowerCase(),
      limit: String(limit),
    });

    const cached = await this.fetchCached<Record<string, CityDirectionPrice>>(
      CITY_DIRECTIONS,
      params,
    );
    const destinations = Object.entries(cached.value ?? {})
      .filter(([, item]) => !isKnownNonEuropean(item))
      .map(([key, item]) => mapCheapestDestination(key, item, request))
      .filter((item): item is CheapestDestination => item !== null)
      .sort((a, b) => a.price - b.price)
      .slice(0, limit);

    if (destinations.length > 0) return destinations;

    return this.getLatestDestinations(request, limit);
  }

  private async getLatestDestinations(
    request: CheapestDestinationsRequest,
    limit: number,
  ): Promise<CheapestDestination[]> {
    const params = new URLSearchParams({
      origin: request.origin,
      currency: CURRENCY.toLowerCase(),
      limit: String(limit),
      page: "1",
      period_type: "year",
      one_way: String(!request.returnDate),
      sorting: "price",
      show_to_affiliates: "true",
    });

    const cached = await this.fetchCached<LatestPrice[]>(LATEST_PRICES, params);
    return (cached.value ?? [])
      .filter((item) => {
        const airport = getAirport(item.destination ?? "");
        return !airport || EUROPEAN_COUNTRY_CODES.has(airport.countryCode);
      })
      .map((item) => mapLatestDestination(item, request))
      .filter((item): item is CheapestDestination => item !== null)
      .sort((a, b) => a.price - b.price)
      .slice(0, limit);
  }

  private async fetchCached<T>(
    endpoint: string,
    params: URLSearchParams,
  ): Promise<CacheEnvelope<T>> {
    const key = buildCacheKey(endpoint, params);
    const canUseCache = this.ttlMs > 0;

    if (canUseCache) {
      const cached = this.cache.get<T>(key);
      if (cached) return cached;
    }

    try {
      const data = await this.request<T>(endpoint, params);
      const envelope = { value: data, fetchedAt: this.now() };

      if (canUseCache) {
        this.cache.set(key, data, this.ttlMs, envelope.fetchedAt);
      }

      return envelope;
    } catch (error) {
      if (canUseCache) {
        const stale = this.cache.getStale<T>(key, this.staleMs);
        if (stale) {
          console.warn(
            `Travelpayouts no respondió; se usa caché de ${new Date(stale.fetchedAt).toISOString()}.`,
          );
          return stale;
        }
      }

      throw error;
    }
  }

  private async request<T>(endpoint: string, params: URLSearchParams): Promise<T> {
    const token = this.token;
    if (!token) {
      throw new ProviderError(
        "Falta TRAVELPAYOUTS_TOKEN en la configuración del servidor.",
        "config",
      );
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.search = params.toString();

    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      if (this.rateLimiter) await this.rateLimiter.acquire();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "X-Access-Token": token,
          },
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.ok) {
          const payload = (await response.json()) as ApiEnvelope<T>;
          if (payload.success === false || payload.success === "false" || payload.error) {
            throw new ProviderError(
              "Travelpayouts devolvió una respuesta de error.",
              "invalid_response",
            );
          }
          if (!("data" in payload)) {
            throw new ProviderError(
              "Travelpayouts devolvió una respuesta sin datos.",
              "invalid_response",
            );
          }
          return payload.data as T;
        }

        if (response.status === 401 || response.status === 403) {
          throw new ProviderError(
            "Travelpayouts rechazó el token configurado.",
            "auth",
          );
        }

        if (response.status === 429) {
          if (attempt < RETRIES) {
            await this.sleep(retryDelay(response, attempt));
            continue;
          }
          throw new ProviderError(
            "Travelpayouts alcanzó su límite de peticiones.",
            "rate_limit",
          );
        }

        if (response.status >= 500) {
          if (attempt < RETRIES) {
            await this.sleep(500 * (attempt + 1));
            continue;
          }
          throw new ProviderError(
            "Travelpayouts no está disponible en este momento.",
            "upstream",
          );
        }

        throw new ProviderError(
          `Travelpayouts devolvió HTTP ${response.status}.`,
          "upstream",
        );
      } catch (error) {
        if (error instanceof ProviderError) throw error;

        if (isAbortError(error)) {
          throw new ProviderError(
            "Travelpayouts tardó demasiado en responder.",
            "timeout",
            { cause: error },
          );
        }

        if (attempt < RETRIES) {
          await this.sleep(400 * (attempt + 1));
          continue;
        }

        throw new ProviderError(
          "No se pudo conectar con Travelpayouts.",
          "upstream",
          { cause: error },
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new ProviderError("Travelpayouts no respondió.", "upstream");
  }
}

function mapOffer(
  item: TravelpayoutsPrice,
  request: FlightSearchRequest,
  fetchedAt: number,
): FlightOffer | null {
  const origin = normalizeCode(item.origin_airport ?? item.origin);
  const destination = normalizeCode(item.destination_airport ?? item.destination);
  const departureAt = item.departure_at;
  const returnAt = request.returnDate ? item.return_at : null;

  if (!origin || !destination || !departureAt) return null;
  if (dateOf(departureAt) !== request.departureDate) return null;
  if (request.returnDate && (!returnAt || dateOf(returnAt) !== request.returnDate)) {
    return null;
  }

  const price = toPositiveNumber(item.price);
  const airlineCode = normalizeCode(item.airline);
  if (price === null || !airlineCode) return null;

  const outboundDuration =
    toPositiveNumber(item.duration_to) ?? toPositiveNumber(item.duration);
  if (outboundDuration === null) return null;

  const returnDuration = returnAt
    ? toPositiveNumber(item.duration_back) ??
      toPositiveNumber(item.duration) ??
      outboundDuration
    : null;

  if (returnAt && returnDuration === null) return null;

  const airline = getAirline(airlineCode);
  const outboundStops = toStops(item.transfers);
  const returnStops = toStops(item.return_transfers);
  const flightNumber = composeFlightNumber(airlineCode, item.flight_number);
  const destinationTimeZone = getAirportTimeZone(destination);
  const originTimeZone = getAirportTimeZone(origin);
  const outbound: FlightLeg = {
    direction: "outbound",
    durationMinutes: outboundDuration,
    stops: outboundStops,
    segments: [
      {
        origin,
        destination,
        departureAt,
        arrivalAt: addMinutesToLocalIso(departureAt, outboundDuration, destinationTimeZone),
        marketingAirlineCode: airlineCode,
        flightNumber,
      },
    ],
  };
  const legs = [outbound];

  if (returnAt && returnDuration !== null) {
    legs.push({
      direction: "return",
      durationMinutes: returnDuration,
      stops: returnStops,
      segments: [
        {
          origin: destination,
          destination: origin,
          departureAt: returnAt,
          arrivalAt: addMinutesToLocalIso(returnAt, returnDuration, originTimeZone),
          marketingAirlineCode: airlineCode,
          flightNumber: "",
        },
      ],
    });
  }

  const actualDepartureDate = dateOf(departureAt);
  const actualReturnDate = returnAt ? dateOf(returnAt) : null;
  const fallbackLink = buildGoogleFlightsUrl({
    origin,
    destination,
    departureDate: actualDepartureDate,
    returnDate: actualReturnDate,
    passengers: request.passengers,
    maxStops: request.maxStops,
  });
  const deepLink = absoluteAviasalesLink(item.link) ?? fallbackLink;
  const stops = Math.max(outboundStops, returnStops);
  const totalDurationMinutes = legs.reduce((total, leg) => total + leg.durationMinutes, 0);

  return {
    id: [
      PROVIDER_ID,
      origin,
      destination,
      departureAt,
      returnAt ?? "ow",
      flightNumber || airlineCode,
    ].join("-"),
    provider: PROVIDER_ID,
    airlineCode,
    airlineName: airline.name,
    price: { amount: price, currency: CURRENCY },
    legs,
    totalDurationMinutes,
    stops,
    deepLink,
    fallbackLink,
    observedAt: new Date(fetchedAt).toISOString(),
    source: item.gate ? `travelpayouts:${item.gate}` : PROVIDER_ID,
    requestedDepartureDate: request.departureDate,
    requestedReturnDate: request.returnDate,
  };
}

function mapCheapestDestination(
  key: string,
  item: CityDirectionPrice,
  request: CheapestDestinationsRequest,
): CheapestDestination | null {
  const destination = normalizeCode(item.destination ?? key);
  const price = toPositiveNumber(item.price);
  if (!destination || price === null) return null;

  const departureDate = item.departure_at
    ? dateOf(item.departure_at)
    : request.departureDate;
  const returnDate = item.return_at ? dateOf(item.return_at) : (request.returnDate ?? null);
  const airport = getAirport(destination) ?? getAirport(item.destination_airport ?? "");
  const fallbackLink = buildGoogleFlightsUrl({
    origin: request.origin,
    destination,
    departureDate,
    returnDate,
    passengers: request.passengers,
    maxStops: null,
  });

  return {
    origin: normalizeCode(item.origin) ?? request.origin,
    destination,
    city: airport?.city ?? destination,
    country: airport?.country ?? "",
    departureDate,
    returnDate,
    price,
    currency: CURRENCY,
    airlineCode: normalizeCode(item.airline) ?? "",
    deepLink: absoluteAviasalesLink(item.link) ?? fallbackLink,
    fallbackLink,
  };
}

function mapLatestDestination(
  item: LatestPrice,
  request: CheapestDestinationsRequest,
): CheapestDestination | null {
  const destination = normalizeCode(item.destination);
  const departureDate = item.depart_date;
  const price = toPositiveNumber(item.value);
  if (!destination || !departureDate || price === null) return null;

  const returnDate = item.return_date || null;
  const airport = getAirport(destination);
  const fallbackLink = buildGoogleFlightsUrl({
    origin: request.origin,
    destination,
    departureDate,
    returnDate,
    passengers: request.passengers,
    maxStops: null,
  });

  return {
    origin: normalizeCode(item.origin) ?? request.origin,
    destination,
    city: airport?.city ?? destination,
    country: airport?.country ?? "",
    departureDate,
    returnDate,
    price,
    currency: CURRENCY,
    airlineCode: "",
    deepLink: fallbackLink,
    fallbackLink,
  };
}

function isKnownNonEuropean(item: TravelpayoutsPrice): boolean {
  const code = normalizeCode(item.destination_airport ?? item.destination);
  if (!code) return false;
  const airport = getAirport(code);
  return airport ? !EUROPEAN_COUNTRY_CODES.has(airport.countryCode) : false;
}

function buildCacheKey(endpoint: string, params: URLSearchParams): string {
  const entries = [...params.entries()].sort(([aKey, aValue], [bKey, bValue]) => {
    const byKey = aKey.localeCompare(bKey);
    return byKey !== 0 ? byKey : aValue.localeCompare(bValue);
  });
  return `${CACHE_VERSION}:${endpoint}:${entries
    .map(([key, value]) => `${key}=${value}`)
    .join("&")}`;
}

function enumerateMonths(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  let cursor = startDate.slice(0, 7);
  const last = endDate.slice(0, 7);

  while (cursor <= last) {
    months.push(cursor);
    const date = parseIsoDate(`${cursor}-01`);
    date.setUTCMonth(date.getUTCMonth() + 1);
    cursor = date.toISOString().slice(0, 7);
  }

  return months;
}

function normalizeCode(value: string | undefined): string | null {
  const code = value?.trim().toUpperCase();
  return code ? code : null;
}

function dateOf(value: string): string {
  return value.slice(0, 10);
}

function toPositiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function toStops(value: unknown): number {
  const stops = Number(value);
  return Number.isFinite(stops) && stops > 0 ? Math.floor(stops) : 0;
}

function composeFlightNumber(airlineCode: string, value: unknown): string {
  const number = value === undefined || value === null ? "" : String(value).trim();
  if (!number) return airlineCode;
  return number.toUpperCase().startsWith(airlineCode) ? number : `${airlineCode}${number}`;
}

function absoluteAviasalesLink(link: string | undefined): string | null {
  if (!link) return null;
  if (/^https?:\/\//i.test(link)) return link;
  return `https://www.aviasales.com${link.startsWith("/") ? "" : "/"}${link}`;
}

function addMinutesToLocalIso(
  iso: string,
  minutes: number,
  timeZone: string | null,
): string {
  const instant = Date.parse(iso);
  if (!Number.isFinite(instant)) return iso;

  const arrival = new Date(instant + minutes * 60_000);

  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(arrival);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value ?? "00";
    const wallClock = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;

    return `${wallClock}${zoneOffsetLabel(arrival, timeZone)}`;
  }

  const suffix = iso.match(/(Z|[+-]\d{2}:?\d{2})$/)?.[1] ?? "Z";
  const offsetMinutes = suffix === "Z" ? 0 : parseOffsetMinutes(suffix);
  const wallClock = new Date(instant + minutes * 60_000 + offsetMinutes * 60_000)
    .toISOString()
    .slice(0, 19);

  return `${wallClock}${suffix}`;
}

function zoneOffsetLabel(date: Date, timeZone: string): string {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  if (!label || label === "GMT" || label === "UTC") return "+00:00";

  const match = label.match(/GMT([+-])(\d{2}):?(\d{2})/);
  return match ? `${match[1]}${match[2]}:${match[3]}` : "+00:00";
}

function parseOffsetMinutes(suffix: string): number {
  const sign = suffix.startsWith("-") ? -1 : 1;
  const digits = suffix.slice(1).replace(":", "");
  return sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
}

function dedupeOffers(offers: FlightOffer[]): FlightOffer[] {
  const seen = new Set<string>();
  return offers.filter((offer) => {
    if (seen.has(offer.id)) return false;
    seen.add(offer.id);
    return true;
  });
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 5000);
  }
  return 1000 * (attempt + 1);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function readPositiveNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 1000 ? Math.min(value, 30_000) : fallback;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
