import { getAirline } from '@/data/airlines';
import { getFlightCache, getFlightCacheStaleMs, getFlightCacheTtlMs, type FlightCache } from '@/lib/cache/flight-cache';
import type { CurrencyCode } from '@/lib/currency';
import { buildGoogleFlightsUrl } from '@/lib/flights/google-flights';
import { ProviderError } from '@/lib/providers/errors';
import { getRateLimitPerMinute, RateLimiter } from '@/lib/providers/rate-limiter';
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
} from '@/lib/providers/types';

const PROVIDER_ID: FlightProviderId = 'ignav';
const CURRENCY: CurrencyCode = 'USD';
const CACHE_VERSION = 'v1';
const DEFAULT_BASE_URL = 'https://api.ignav.com';
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RESULTS = 30;

type IgnavLeg = {
  from: string;
  to: string;
  departure: string;
  arrival: string;
  carrier?: string;
  flight_number?: string;
  duration_minutes?: number;
  stops?: number;
};

type IgnavOffer = {
  id?: string;
  price: number;
  currency?: string;
  airline?: string;
  carrier?: string;
  segments?: IgnavLeg[];
  legs?: IgnavLeg[];
  outbound?: IgnavLeg[];
  return?: IgnavLeg[];
  deep_link?: string;
  link?: string;
  book_url?: string;
  url?: string;
  found_at?: string;
  observed_at?: string;
};

type IgnavResponse =
  | { data?: IgnavOffer[]; offers?: IgnavOffer[]; results?: IgnavOffer[] }
  | IgnavOffer[];

function getBaseUrl() {
  return process.env.IGNAV_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

function getApiKey() {
  const key = process.env.IGNAV_API_KEY?.trim();
  if (!key) throw new ProviderError('Clave de Ignav no configurada.', 'config');
  return key;
}

function getTimeoutMs() {
  const value = Number(process.env.FLIGHT_PROVIDER_TIMEOUT_MS);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.floor(value);
}

function buildCacheKey(prefix: string, payload: unknown) {
  const serialized = JSON.stringify(payload);
  return `ignav:${CACHE_VERSION}:${prefix}:${serialized}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ProviderError('Tiempo de espera agotado.', 'timeout')), timeoutMs);
    promise.then((v) => { clearTimeout(timer); resolve(v); }).catch((e) => { clearTimeout(timer); reject(e); });
  });
}

function isIgnavOffer(value: unknown): value is IgnavOffer {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as IgnavOffer).price === 'number' && Number.isFinite((value as IgnavOffer).price);
}

function extractOffers(payload: IgnavResponse): IgnavOffer[] {
  if (Array.isArray(payload)) return payload.filter(isIgnavOffer);
  const obj = payload as { data?: unknown; offers?: unknown; results?: unknown };
  const data = obj.data ?? obj.offers ?? obj.results ?? [];
  return Array.isArray(data) ? data.filter(isIgnavOffer) : [];
}

function normalizeAirlineCode(code?: string) {
  if (!code) return undefined;
  const t = code.trim().toUpperCase();
  return t.length === 2 || t.length === 3 ? t : undefined;
}

function toIsoDateTime(value: string | undefined, fallback: string) {
  if (!value) return `${fallback}T00:00:00.000Z`;
  return value.includes('T') ? value : `${value}T00:00:00.000Z`;
}

function buildSegments(legs: IgnavLeg[], fallback: string): FlightLeg[] {
  const segments = legs
    .filter((l) => l.from && l.to)
    .map((l) => ({
      origin: l.from,
      destination: l.to,
      departureAt: toIsoDateTime(l.departure, fallback),
      arrivalAt: toIsoDateTime(l.arrival, fallback),
      marketingAirlineCode: normalizeAirlineCode(l.carrier) ?? 'XX',
      flightNumber: l.flight_number?.trim() || 'XX0001',
    }));

  if (segments.length === 0) return [];

  const durationMinutes = legs.reduce((s, l) => s + (typeof l.duration_minutes === 'number' ? l.duration_minutes : 0), 0);
  const stops = legs.reduce((s, l) => s + (typeof l.stops === 'number' ? l.stops : 0), 0);

  return [{ direction: 'outbound', durationMinutes: durationMinutes > 0 ? durationMinutes : 120, stops, segments }];
}

function mapOffer(offer: IgnavOffer, request: FlightSearchRequest, index: number): FlightOffer | null {
  const priceAmount = offer.price;
  if (!Number.isFinite(priceAmount) || priceAmount <= 0) return null;

  const airlineCode = normalizeAirlineCode(offer.airline ?? offer.carrier) ?? 'XX';
  const airline = getAirline(airlineCode);

  const raw = offer.outbound ?? offer.legs ?? offer.segments ?? [];
  const arr = Array.isArray(raw) ? (raw as IgnavLeg[]) : [];
  const out = buildSegments(arr, request.departureDate);
  if (out.length === 0) return null;

  const rraw = offer.return && Array.isArray(offer.return) ? (offer.return as IgnavLeg[]) : [];
  const rleg = rraw.length > 0 ? buildSegments(rraw, request.returnDate ?? request.departureDate) : [];
  const legs = request.returnDate && rleg.length > 0 ? [...out, ...rleg] : out;

  const totalDurationMinutes = legs.reduce((s, l) => s + l.durationMinutes, 0);
  const stops = legs.reduce((s, l) => s + (l.stops ?? 0), 0);

  const deepLink = offer.deep_link ?? offer.book_url ?? offer.link ?? offer.url ?? buildGoogleFlightsUrl(request);
  const fallbackLink = buildGoogleFlightsUrl(request);
  const observedAt = offer.observed_at ?? offer.found_at ?? new Date().toISOString();
  const id = offer.id?.trim() || `${PROVIDER_ID}:${airlineCode}:${request.origin}:${request.destination ?? "ANY"}:${request.departureDate}:${index}`;

  return {
    id,
    provider: PROVIDER_ID,
    airlineCode,
    airlineName: airline?.name ?? airlineCode,
    price: { amount: Math.round(priceAmount * 100) / 100, currency: CURRENCY },
    legs,
    totalDurationMinutes,
    stops,
    deepLink,
    fallbackLink,
    observedAt,
    source: 'ignav-cache',
    requestedDepartureDate: request.departureDate,
    requestedReturnDate: request.returnDate,
  };
}

export class IgnavProvider implements FlightProvider {
  readonly id = PROVIDER_ID;
  private readonly cache: FlightCache;
  private readonly rateLimiter: RateLimiter;
  private readonly ttlMs: number;
  private readonly staleMs: number;
  private readonly timeoutMs: number;

  constructor(options: { cache?: FlightCache } = {}) {
    this.cache = options.cache ?? getFlightCache();
    this.ttlMs = getFlightCacheTtlMs();
    this.staleMs = getFlightCacheStaleMs();
    this.timeoutMs = getTimeoutMs();
    this.rateLimiter = new RateLimiter({ maxRequestsPerMinute: getRateLimitPerMinute('IGNAV_RATE_LIMIT_PER_MINUTE', 30) });
  }

  private async fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get<T>(key);
    if (cached) return cached.value;
    try {
      await this.rateLimiter.acquire();
      const value = await withTimeout(fetcher(), this.timeoutMs);
      if (this.ttlMs > 0) this.cache.set(key, value, this.ttlMs);
      return value;
    } catch (error) {
      if (this.staleMs > 0) {
        const stale = this.cache.getStale<T>(key, this.staleMs);
        if (stale) return stale.value;
      }
      throw error;
    }
  }

  async searchFlights(request: FlightSearchRequest): Promise<FlightOffer[]> {
    const key = buildCacheKey('search', request);
    const payload = await this.fetchWithCache<IgnavResponse>(key, async () => {
      const apiKey = getApiKey();
      const baseUrl = getBaseUrl();
      const url = new URL('/flights/search', baseUrl);
      url.searchParams.set('origin', request.origin);
      if (request.destination) url.searchParams.set('destination', request.destination);
      url.searchParams.set('departure_date', request.departureDate);
      if (request.returnDate) url.searchParams.set('return_date', request.returnDate);
      url.searchParams.set('adults', String(request.passengers));
      if (typeof request.maxStops === 'number') url.searchParams.set('max_stops', String(request.maxStops));
      url.searchParams.set('currency', CURRENCY);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new ProviderError('Autenticaci�n con Ignav fallida.', 'auth');
        if (response.status === 429) throw new ProviderError('L�mite de peticiones de Ignav alcanzado.', 'rate_limit');
        if (response.status >= 500) throw new ProviderError('Error del proveedor Ignav.', 'upstream');
        throw new ProviderError('Respuesta inv�lida de Ignav.', 'invalid_response');
      }
      return (await response.json()) as IgnavResponse;
    });

    return extractOffers(payload)
      .map((offer, index) => mapOffer(offer, request, index))
      .filter((offer): offer is FlightOffer => offer !== null)
      .slice(0, MAX_RESULTS);
  }

  async getPriceCalendar(_request: PriceCalendarRequest): Promise<PriceCalendarEntry[]> {
    return [];
  }

  async getCheapestDestinations(_request: CheapestDestinationsRequest): Promise<CheapestDestination[]> {
    return [];
  }
}
