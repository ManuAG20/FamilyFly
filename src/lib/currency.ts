export const currencies = ["USD", "EUR"] as const;

export type CurrencyCode = (typeof currencies)[number];

export const FALLBACK_USD_TO_EUR = 0.92;

export function isCurrencyCode(value: string): value is CurrencyCode {
  return currencies.includes(value as CurrencyCode);
}

export function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  usdToEur: number,
): number {
  if (from === to) return amount;
  if (from === "USD" && to === "EUR") return amount * usdToEur;
  return amount / usdToEur;
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatExchangeRate(usdToEur: number): string {
  return `1 USD ≈ ${usdToEur.toFixed(3)} EUR`;
}
