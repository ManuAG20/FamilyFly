"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  convertAmount,
  FALLBACK_USD_TO_EUR,
  formatCurrency,
  isCurrencyCode,
  type CurrencyCode,
} from "@/lib/currency";

const STORAGE_KEY = "familyfly-currency";

let currencyListeners: Array<() => void> = [];

function subscribeToCurrency(listener: () => void) {
  currencyListeners.push(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    currencyListeners = currencyListeners.filter((item) => item !== listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getCurrencySnapshot(): CurrencyCode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && isCurrencyCode(stored) ? stored : "USD";
  } catch {
    return "USD";
  }
}

function getCurrencyServerSnapshot(): CurrencyCode {
  return "USD";
}

function persistCurrency(currency: CurrencyCode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, currency);
  } catch {
    return;
  }
  for (const listener of currencyListeners) listener();
}

type RateSource = "frankfurter" | "fallback";

type CurrencyContextValue = {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  usdToEur: number;
  rateSource: RateSource;
  rateStale: boolean;
  rateDate: string | null;
  convert: (amount: number, from: CurrencyCode) => number;
  format: (amount: number, from: CurrencyCode) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

type RatesResponse = {
  rates?: { EUR?: number };
  source?: RateSource;
  stale?: boolean;
  rateDate?: string;
};

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const currency = useSyncExternalStore(
    subscribeToCurrency,
    getCurrencySnapshot,
    getCurrencyServerSnapshot,
  );
  const [usdToEur, setUsdToEur] = useState(FALLBACK_USD_TO_EUR);
  const [rateSource, setRateSource] = useState<RateSource>("fallback");
  const [rateStale, setRateStale] = useState(true);
  const [rateDate, setRateDate] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRates() {
      try {
        const response = await fetch("/api/exchange-rates", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = (await response.json()) as RatesResponse;
        const rate = Number(data.rates?.EUR);

        if (Number.isFinite(rate) && rate > 0) {
          setUsdToEur(rate);
          setRateSource(data.source === "frankfurter" ? "frankfurter" : "fallback");
          setRateStale(Boolean(data.stale));
          setRateDate(data.rateDate ?? null);
        }
      } catch {
        return;
      }
    }

    void loadRates();

    return () => controller.abort();
  }, []);

  const setCurrency = useCallback((next: CurrencyCode) => {
    persistCurrency(next);
  }, []);

  const convert = useCallback(
    (amount: number, from: CurrencyCode) => convertAmount(amount, from, currency, usdToEur),
    [currency, usdToEur],
  );

  const format = useCallback(
    (amount: number, from: CurrencyCode) => {
      const converted = convertAmount(amount, from, currency, usdToEur);
      return formatCurrency(converted, currency);
    },
    [currency, usdToEur],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      usdToEur,
      rateSource,
      rateStale,
      rateDate,
      convert,
      format,
    }),
    [currency, setCurrency, usdToEur, rateSource, rateStale, rateDate, convert, format],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency debe usarse dentro de CurrencyProvider");
  }
  return context;
}
