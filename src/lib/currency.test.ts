import { describe, expect, it } from "vitest";
import {
  FALLBACK_USD_TO_EUR,
  convertAmount,
  formatExchangeRate,
  isCurrencyCode,
} from "@/lib/currency";

describe("currency", () => {
  it("converts between USD and EUR in both directions", () => {
    expect(convertAmount(100, "USD", "EUR", 0.9)).toBeCloseTo(90);
    expect(convertAmount(90, "EUR", "USD", 0.9)).toBeCloseTo(100);
    expect(convertAmount(100, "USD", "USD", 0.9)).toBe(100);
  });

  it("validates supported currencies", () => {
    expect(isCurrencyCode("USD")).toBe(true);
    expect(isCurrencyCode("EUR")).toBe(true);
    expect(isCurrencyCode("GBP")).toBe(false);
  });

  it("exposes a safe fallback rate", () => {
    expect(FALLBACK_USD_TO_EUR).toBeGreaterThan(0);
    expect(FALLBACK_USD_TO_EUR).toBeLessThan(2);
    expect(formatExchangeRate(FALLBACK_USD_TO_EUR)).toBe("1 USD ≈ 0.920 EUR");
  });
});
