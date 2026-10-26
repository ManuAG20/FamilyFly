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

const timeZoneByCountry: Record<string, string> = {
  PE: "America/Lima",
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
  FR: "Europe/Paris",
  NL: "Europe/Amsterdam",
  BE: "Europe/Brussels",
  IT: "Europe/Rome",
  DE: "Europe/Berlin",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  CH: "Europe/Zurich",
  AT: "Europe/Vienna",
  DK: "Europe/Copenhagen",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  FI: "Europe/Helsinki",
  PL: "Europe/Warsaw",
  CZ: "Europe/Prague",
  HU: "Europe/Budapest",
  GR: "Europe/Athens",
  TR: "Europe/Istanbul",
  IS: "Atlantic/Reykjavik",
  MA: "Africa/Casablanca",
  TN: "Africa/Tunis",
  MT: "Europe/Malta",
  LU: "Europe/Luxembourg",
  RS: "Europe/Belgrade",
  CO: "America/Bogota",
  PA: "America/Panama",
  MX: "America/Mexico_City",
  US: "America/New_York",
  BR: "America/Sao_Paulo",
  AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago",
  HR: "Europe/Zagreb",
  SI: "Europe/Ljubljana",
  SK: "Europe/Bratislava",
  BG: "Europe/Sofia",
  RO: "Europe/Bucharest",
  EE: "Europe/Tallinn",
  LV: "Europe/Riga",
  LT: "Europe/Vilnius",
  UA: "Europe/Kyiv",
  MD: "Europe/Chisinau",
  AL: "Europe/Tirane",
  MK: "Europe/Skopje",
  BA: "Europe/Sarajevo",
  ME: "Europe/Podgorica",
  CY: "Asia/Nicosia",
};

export function getAirport(iata: string): Airport | undefined {
  return airportsByIata.get(iata.toUpperCase());
}

export function getAirportTimeZone(iata: string): string | null {
  const airport = getAirport(iata);
  if (!airport) return null;

  if (airport.countryCode === "ES" && airport.lon < -12) return "Atlantic/Canary";
  if (airport.countryCode === "PT" && airport.lon < -20) return "Atlantic/Azores";
  if (airport.countryCode === "US") {
    if (airport.lon < -115) return "America/Los_Angeles";
    if (airport.lon < -100) return "America/Denver";
    if (airport.lon < -87) return "America/Chicago";
    return "America/New_York";
  }

  return timeZoneByCountry[airport.countryCode] ?? null;
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
