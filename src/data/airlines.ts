export type Airline = {
  code: string;
  name: string;
  color: string;
  hubs: string[];
};

export const airlines: Airline[] = [
  { code: "IB", name: "Iberia", color: "#c8102e", hubs: ["MAD"] },
  { code: "UX", name: "Air Europa", color: "#00539f", hubs: ["MAD"] },
  { code: "PU", name: "Plus Ultra", color: "#173f6b", hubs: ["MAD"] },
  { code: "LA", name: "LATAM", color: "#e4002b", hubs: ["LIM", "SCL", "GRU"] },
  { code: "VY", name: "Vueling", color: "#f7b500", hubs: ["BCN"] },
  { code: "FR", name: "Ryanair", color: "#073590", hubs: ["DUB", "STN", "BCN"] },
  { code: "U2", name: "easyJet", color: "#ff6600", hubs: ["LGW", "MAN", "CDG"] },
  { code: "KL", name: "KLM", color: "#00a1de", hubs: ["AMS"] },
  { code: "AF", name: "Air France", color: "#002157", hubs: ["CDG", "ORY"] },
  { code: "LH", name: "Lufthansa", color: "#05164d", hubs: ["FRA", "MUC"] },
  { code: "LX", name: "Swiss", color: "#d81e05", hubs: ["ZRH", "GVA"] },
  { code: "TP", name: "TAP Air Portugal", color: "#006b3f", hubs: ["LIS", "OPO"] },
  { code: "AZ", name: "ITA Airways", color: "#0066cc", hubs: ["FCO", "LIN"] },
  { code: "TK", name: "Turkish Airlines", color: "#c8102e", hubs: ["IST", "SAW"] },
  { code: "AV", name: "Avianca", color: "#d71920", hubs: ["BOG", "LIM"] },
  { code: "CM", name: "Copa Airlines", color: "#003da5", hubs: ["PTY"] },
  { code: "AA", name: "American Airlines", color: "#0078d2", hubs: ["MIA", "JFK"] },
  { code: "AC", name: "Air Canada", color: "#d22630", hubs: ["JFK"] },
  { code: "EK", name: "Emirates", color: "#d71921", hubs: ["IST"] },
  { code: "W6", name: "Wizz Air", color: "#c6007e", hubs: ["BUD", "WAW"] },
  { code: "EW", name: "Eurowings", color: "#6a1b9a", hubs: ["DUS", "HAM", "BER"] },
  { code: "SK", name: "SAS", color: "#002664", hubs: ["CPH", "ARN", "OSL"] },
  { code: "AY", name: "Finnair", color: "#0b1560", hubs: ["HEL"] },
  { code: "LO", name: "LOT", color: "#005a9c", hubs: ["WAW"] },
  { code: "OS", name: "Austrian", color: "#c8102e", hubs: ["VIE"] },
  { code: "SN", name: "Brussels Airlines", color: "#0033a0", hubs: ["BRU"] },
  { code: "EI", name: "Aer Lingus", color: "#00a65a", hubs: ["DUB"] },
  { code: "BT", name: "airBaltic", color: "#00a19a", hubs: ["WAW"] },
  { code: "H2", name: "Sky Airline", color: "#6f2c91", hubs: ["LIM"] },
  { code: "JA", name: "JetSMART", color: "#ff4f00", hubs: ["LIM", "SCL"] },
  { code: "AT", name: "Royal Air Maroc", color: "#c1272d", hubs: ["CMN"] },
  { code: "TU", name: "Tunisair", color: "#b01f24", hubs: ["TUN"] },
];

export const airlinesByCode = new Map(airlines.map((airline) => [airline.code, airline]));

export function getAirline(code: string): Airline {
  return (
    airlinesByCode.get(code) ?? {
      code,
      name: code,
      color: "#475569",
      hubs: [],
    }
  );
}
