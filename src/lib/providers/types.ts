import type { CurrencyCode } from "@/lib/currency";

export type FlightProviderId = "mock" | "travelpayouts" | "ignav";

export type FlightSearchRequest = {
  origin: string;
  destination: string | null;
  departureDate: string;
  returnDate: string | null;
  passengers: number;
  maxStops: number | null;
};

export type FlightSegment = {
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
  marketingAirlineCode: string;
  flightNumber: string;
};

export type FlightLeg = {
  direction: "outbound" | "return";
  durationMinutes: number;
  segments: FlightSegment[];
};

export type FlightOffer = {
  id: string;
  provider: FlightProviderId;
  airlineCode: string;
  airlineName: string;
  price: {
    amount: number;
    currency: CurrencyCode;
  };
  legs: FlightLeg[];
  totalDurationMinutes: number;
  stops: number;
  deepLink: string;
  fallbackLink: string;
  observedAt: string;
  source: string;
  requestedDepartureDate: string;
  requestedReturnDate: string | null;
};

export type FlightOfferWithAge = FlightOffer & {
  dataAgeHours: number;
};

export type PriceCalendarEntry = {
  date: string;
  price: number;
  currency: CurrencyCode;
};

export type CheapestDestination = {
  origin: string;
  destination: string;
  city: string;
  country: string;
  departureDate: string;
  returnDate: string | null;
  price: number;
  currency: CurrencyCode;
  airlineCode: string;
  deepLink: string;
  fallbackLink: string;
};

export type PriceCalendarRequest = {
  origin: string;
  destination: string;
  startDate: string;
  days: number;
  returnDate?: string | null;
  passengers: number;
};

export type CheapestDestinationsRequest = {
  origin: string;
  departureDate: string;
  returnDate?: string | null;
  passengers: number;
  limit?: number;
};

export interface FlightProvider {
  readonly id: FlightProviderId;
  searchFlights(request: FlightSearchRequest): Promise<FlightOffer[]>;
  getPriceCalendar(request: PriceCalendarRequest): Promise<PriceCalendarEntry[]>;
  getCheapestDestinations(request: CheapestDestinationsRequest): Promise<CheapestDestination[]>;
}

export type SearchMeta = {
  provider: FlightProviderId;
  generatedAt: string;
  offersCount: number;
  flexibleDates: string[];
  anyDestination: boolean;
};

export type FlightSearchResponse = {
  offers: FlightOfferWithAge[];
  meta: SearchMeta;
};
