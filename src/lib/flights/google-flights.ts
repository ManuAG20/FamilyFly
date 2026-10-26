import type { FlightSearchRequest } from "@/lib/providers/types";

export function buildGoogleFlightsUrl(request: FlightSearchRequest): string {
  const destination = request.destination ?? "anywhere";
  const parts = [
    `Flights from ${request.origin} to ${destination}`,
    `on ${request.departureDate}`,
  ];

  if (request.returnDate) {
    parts.push(`through ${request.returnDate}`);
  }

  const query = parts.join(" ");
  const params = new URLSearchParams({
    q: query,
    curr: "USD",
    hl: "es",
    gl: "ES",
  });

  return `https://www.google.com/travel/flights?${params.toString()}`;
}
