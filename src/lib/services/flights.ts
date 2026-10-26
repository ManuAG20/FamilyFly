import { addDays, enumerateDateWindow } from "@/lib/dates";
import { getFlightProvider } from "@/lib/providers";
import type {
  FlightOfferWithAge,
  FlightSearchRequest,
  FlightSearchResponse,
} from "@/lib/providers/types";
import type { FlightSearchQuery } from "@/lib/search-params";

const FLEXIBLE_DAYS = 3;

type DatePair = {
  departureDate: string;
  returnDate: string | null;
};

export async function searchFlights(query: FlightSearchQuery): Promise<FlightSearchResponse> {
  const provider = getFlightProvider();
  const datePairs = buildDatePairs(query);

  const results = await Promise.allSettled(
    datePairs.map((pair) => {
      const request: FlightSearchRequest = {
        origin: query.origin,
        destination: query.destination,
        departureDate: pair.departureDate,
        returnDate: pair.returnDate,
        passengers: query.passengers,
        maxStops: query.maxStops,
      };
      return provider.searchFlights(request);
    }),
  );

  const offers: FlightOfferWithAge[] = [];
  const failures: unknown[] = [];
  const now = Date.now();

  for (const result of results) {
    if (result.status === "rejected") {
      failures.push(result.reason);
      continue;
    }

    for (const offer of result.value) {
      const observedAt = new Date(offer.observedAt).getTime();
      const dataAgeHours = Number.isFinite(observedAt)
        ? Math.max(0, Math.round((now - observedAt) / 3_600_000))
        : 0;

      offers.push({ ...offer, dataAgeHours });
    }
  }

  if (offers.length === 0 && failures.length === datePairs.length) {
    const first = failures[0];
    throw first instanceof Error ? first : new Error("No se pudo consultar el proveedor de vuelos.");
  }

  const deduped = dedupeOffers(offers).sort((a, b) => a.price.amount - b.price.amount);
  const providerId = provider.id;

  return {
    offers: deduped,
    meta: {
      provider: providerId,
      generatedAt: new Date(now).toISOString(),
      offersCount: deduped.length,
      flexibleDates: datePairs.map((pair) => pair.departureDate),
      anyDestination: query.anyDestination,
    },
  };
}

export function buildDatePairs(query: FlightSearchQuery): DatePair[] {
  if (!query.flexible) {
    return [{ departureDate: query.departureDate, returnDate: query.returnDate }];
  }

  return enumerateDateWindow(query.departureDate, FLEXIBLE_DAYS).map((departureDate) => {
    const offset = daysBetween(query.departureDate, departureDate);
    return {
      departureDate,
      returnDate: query.returnDate ? addDays(query.returnDate, offset) : null,
    };
  });
}

function daysBetween(start: string, end: string): number {
  const startTime = new Date(`${start}T00:00:00Z`).getTime();
  const endTime = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((endTime - startTime) / 86_400_000);
}

function dedupeOffers(offers: FlightOfferWithAge[]): FlightOfferWithAge[] {
  const seen = new Set<string>();
  return offers.filter((offer) => {
    if (seen.has(offer.id)) return false;
    seen.add(offer.id);
    return true;
  });
}
