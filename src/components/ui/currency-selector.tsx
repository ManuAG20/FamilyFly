"use client";

import { currencies, formatExchangeRate } from "@/lib/currency";
import { getDictionary } from "@/i18n";
import { useCurrency } from "@/components/providers/currency-provider";

export function CurrencySelector() {
  const t = getDictionary();
  const { currency, setCurrency, usdToEur, rateSource } = useCurrency();

  return (
    <div className="flex items-center gap-2">
      <div
        role="group"
        aria-label={t.header.currency}
        title={`${
          rateSource === "frankfurter" ? t.header.rateFrankfurter : t.header.rateApprox
        }: ${formatExchangeRate(usdToEur)}`}
        className="inline-flex rounded-full border border-border bg-surface p-0.5"
      >
        {currencies.map((code) => {
          const active = currency === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setCurrency(code)}
              aria-pressed={active}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                active
                  ? "bg-brand text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {code}
            </button>
          );
        })}
      </div>
    </div>
  );
}
