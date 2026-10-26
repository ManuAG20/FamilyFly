import { airports, type Airport } from "@/data/airports";

export const airportsByIata = new Map(airports.map((airport) => [airport.iata, airport]));

const searchIndex = airports.map((airport) => ({
  airport,
  haystack: normalize(
    `${airport.iata} ${airport.city} ${airport.name} ${airport.country} ${airport.countryCode}`,
  ),
}));

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getAirport(iata: string): Airport | undefined {
  return airportsByIata.get(iata.toUpperCase());
}

export function getAirportLabel(iata: string): string {
  const airport = getAirport(iata);
  return airport ? `${airport.city} (${airport.iata})` : iata;
}

export function searchAirports(query: string, limit = 8): Airport[] {
  const term = normalize(query);
  if (!term) {
    return airports.slice(0, limit);
  }

  return searchIndex
    .filter((entry) => entry.haystack.includes(term))
    .sort((a, b) => scoreAirport(a.airport, term) - scoreAirport(b.airport, term))
    .slice(0, limit)
    .map((entry) => entry.airport);
}

function scoreAirport(airport: Airport, term: string): number {
  const iata = airport.iata.toLowerCase();
  const city = normalize(airport.city);
  if (iata === term) return 0;
  if (iata.startsWith(term)) return 1;
  if (city.startsWith(term)) return 2;
  if (city.includes(term)) return 3;
  return 4;
}
