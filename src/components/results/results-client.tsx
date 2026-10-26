"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDictionary } from "@/i18n";
import { buildApiSearchPath, type FlightSearchQuery } from "@/lib/search-params";
import { formatExchangeRate } from "@/lib/currency";
import type { FlightSearchResponse } from "@/lib/providers/types";
import { FlightCard } from "@/components/results/flight-card";
import { ResultsSkeleton } from "@/components/results/results-skeleton";
import { ChevronDownIcon, SearchIcon } from "@/components/ui/icons";
import { useCurrency } from "@/components/providers/currency-provider";

type SortKey = "best" | "price" | "duration";
type StopsFilter = "all" | "direct" | "one";

type AirlineOption = {
  code: string;
  name: string;
  count: number;
};

export function ResultsClient({ query }: { query: FlightSearchQuery }) {
  const t = getDictionary();
  const { usdToEur, rateSource, rateStale } = useCurrency();
  const apiPath = useMemo(() => buildApiSearchPath(query), [query]);
  const [data, setData] = useState<FlightSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [sort, setSort] = useState<SortKey>("best");
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>([]);
  const [stopsFilter, setStopsFilter] = useState<StopsFilter>("all");
  const errorFallback = t.results.errorText;

  useEffect(() => {
    const controller = new AbortController();

    async function loadFlights() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(apiPath, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | (FlightSearchResponse & { error?: string })
          | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? errorFallback);
        }

        if (!payload || !Array.isArray(payload.offers)) {
          throw new Error(errorFallback);
        }

        setData(payload);
        setSelectedAirlines([]);
        setStopsFilter("all");
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : errorFallback);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadFlights();

    return () => controller.abort();
  }, [apiPath, reloadToken, errorFallback]);

  const offers = useMemo(() => data?.offers ?? [], [data]);

  const airlineOptions = useMemo<AirlineOption[]>(() => {
    const map = new Map<string, AirlineOption>();
    for (const offer of offers) {
      const existing = map.get(offer.airlineCode);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(offer.airlineCode, {
          code: offer.airlineCode,
          name: offer.airlineName,
          count: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [offers]);

  const { scoreById, bestId } = useMemo(() => {
    const scores = new Map<string, number>();
    if (offers.length === 0) {
      return { scoreById: scores, bestId: null as string | null };
    }

    const prices = offers.map((offer) => offer.price.amount);
    const durations = offers.map((offer) => offer.totalDurationMinutes);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    const normalize = (value: number, min: number, max: number) =>
      max === min ? 0 : (value - min) / (max - min);

    let best: string | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const offer of offers) {
      const score =
        normalize(offer.price.amount, minPrice, maxPrice) * 0.65 +
        normalize(offer.totalDurationMinutes, minDuration, maxDuration) * 0.35;
      scores.set(offer.id, score);
      if (score < bestScore) {
        bestScore = score;
        best = offer.id;
      }
    }

    return { scoreById: scores, bestId: best };
  }, [offers]);

  const cheapestId = useMemo(() => {
    if (offers.length === 0) return null;
    return offers.reduce((cheapest, offer) =>
      offer.price.amount < cheapest.price.amount ? offer : cheapest,
    ).id;
  }, [offers]);

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      if (selectedAirlines.length > 0 && !selectedAirlines.includes(offer.airlineCode)) {
        return false;
      }
      if (stopsFilter === "direct" && offer.stops !== 0) return false;
      if (stopsFilter === "one" && offer.stops > 1) return false;
      return true;
    });
  }, [offers, selectedAirlines, stopsFilter]);

  const sortedOffers = useMemo(() => {
    const list = [...filteredOffers];
    list.sort((a, b) => {
      if (sort === "price") {
        return a.price.amount - b.price.amount || a.totalDurationMinutes - b.totalDurationMinutes;
      }
      if (sort === "duration") {
        return (
          a.totalDurationMinutes - b.totalDurationMinutes || a.price.amount - b.price.amount
        );
      }
      return (
        (scoreById.get(a.id) ?? 0) - (scoreById.get(b.id) ?? 0) ||
        a.price.amount - b.price.amount
      );
    });
    return list;
  }, [filteredOffers, sort, scoreById]);

  const hasFilters = selectedAirlines.length > 0 || stopsFilter !== "all";

  const toggleAirline = useCallback((code: string) => {
    setSelectedAirlines((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedAirlines([]);
    setStopsFilter("all");
  }, []);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  if (loading) {
    return <ResultsSkeleton />;
  }

  if (error) {
    return (
      <div className="mt-5 rounded-2xl border border-danger/25 bg-danger/5 p-6 text-center">
        <h2 className="text-base font-semibold text-foreground">{t.results.errorTitle}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted">{error}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={retry}
            className="inline-flex h-9 items-center rounded-xl bg-brand px-4 text-xs font-semibold text-white transition hover:bg-brand-strong"
          >
            {t.common.retry}
          </button>
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-xl border border-border bg-surface px-4 text-xs font-semibold text-foreground transition hover:border-brand/40 hover:text-brand"
          >
            {t.results.newSearch}
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mt-5">
      {data.meta.provider === "mock" ? (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] leading-relaxed text-warning">
          <span className="font-semibold">{t.results.demoBanner}:</span>{" "}
          {t.results.demoBannerText}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            <span className="font-semibold text-foreground">{offers.length}</span>{" "}
            {offers.length === 1 ? t.results.countOne : t.results.countMany}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {t.results.exchangeRate}: {formatExchangeRate(usdToEur)}
            {rateSource === "fallback" || rateStale ? ` (${t.results.approx})` : ""}
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted">
          <span className="font-medium">{t.results.sortLabel}</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/25"
          >
            <option value="best">{t.results.sortBest}</option>
            <option value="price">{t.results.sortPrice}</option>
            <option value="duration">{t.results.sortDuration}</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden self-start lg:block">
          <FiltersPanel
            airlines={airlineOptions}
            selectedAirlines={selectedAirlines}
            stops={stopsFilter}
            hasFilters={hasFilters}
            onToggleAirline={toggleAirline}
            onStopsChange={setStopsFilter}
            onClear={clearFilters}
          />
        </aside>

        <div>
          <details className="group rounded-xl border border-border bg-surface lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-semibold text-foreground">
              <span>
                {t.results.filters}
                {hasFilters ? (
                  <span className="ml-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[10px] text-white">
                    {selectedAirlines.length + (stopsFilter !== "all" ? 1 : 0)}
                  </span>
                ) : null}
              </span>
              <ChevronDownIcon className="h-4 w-4 text-muted transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-border p-3">
              <FiltersPanel
                airlines={airlineOptions}
                selectedAirlines={selectedAirlines}
                stops={stopsFilter}
                hasFilters={hasFilters}
                onToggleAirline={toggleAirline}
                onStopsChange={setStopsFilter}
                onClear={clearFilters}
              />
            </div>
          </details>

          {offers.length === 0 ? (
            <EmptyState
              title={t.results.noResultsTitle}
              text={t.results.noResultsText}
              actionLabel={t.results.newSearch}
              actionHref="/"
            />
          ) : sortedOffers.length === 0 ? (
            <EmptyState
              title={t.results.noFilterResultsTitle}
              text={t.results.noFilterResultsText}
              actionLabel={t.results.clearFilters}
              onAction={clearFilters}
            />
          ) : (
            <div className="mt-3 space-y-3 lg:mt-0">
              {sortedOffers.map((offer) => (
                <FlightCard
                  key={offer.id}
                  offer={offer}
                  isCheapest={offer.id === cheapestId}
                  isRecommended={offer.id === bestId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type FiltersPanelProps = {
  airlines: AirlineOption[];
  selectedAirlines: string[];
  stops: StopsFilter;
  hasFilters: boolean;
  onToggleAirline: (code: string) => void;
  onStopsChange: (value: StopsFilter) => void;
  onClear: () => void;
};

function FiltersPanel({
  airlines,
  selectedAirlines,
  stops,
  hasFilters,
  onToggleAirline,
  onStopsChange,
  onClear,
}: FiltersPanelProps) {
  const t = getDictionary();
  const stopOptions: { value: StopsFilter; label: string }[] = [
    { value: "all", label: t.results.all },
    { value: "direct", label: t.results.direct },
    { value: "one", label: t.results.upToOne },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
          {t.results.filters}
        </h2>
        {hasFilters ? (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-semibold text-brand transition hover:text-brand-strong"
          >
            {t.common.clear}
          </button>
        ) : null}
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold text-foreground">{t.results.stops}</legend>
        <div className="mt-2 grid gap-1.5">
          {stopOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-xs text-muted">
              <input
                type="radio"
                name="stops"
                value={option.value}
                checked={stops === option.value}
                onChange={() => onStopsChange(option.value)}
                className="h-4 w-4 accent-brand"
              />
              <span className={stops === option.value ? "font-semibold text-foreground" : ""}>
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {airlines.length > 1 ? (
        <fieldset className="mt-5 border-t border-border pt-4">
          <legend className="text-xs font-semibold text-foreground">
            {t.results.airlines}
          </legend>
          <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {airlines.map((airline) => {
              const checked = selectedAirlines.includes(airline.code);
              return (
                <label
                  key={airline.code}
                  className="flex items-center justify-between gap-2 text-xs text-muted"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleAirline(airline.code)}
                      className="h-4 w-4 shrink-0 accent-brand"
                    />
                    <span className={`truncate ${checked ? "font-semibold text-foreground" : ""}`}>
                      {airline.name}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                    {airline.count}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  text: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
};

function EmptyState({ title, text, actionLabel, actionHref, onAction }: EmptyStateProps) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
        <SearchIcon className="h-5 w-5" />
      </span>
      <h2 className="mt-3 text-sm font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted">{text}</p>
      {actionHref ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex h-9 items-center rounded-xl bg-brand px-4 text-xs font-semibold text-white transition hover:bg-brand-strong"
        >
          {actionLabel}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex h-9 items-center rounded-xl border border-border bg-surface px-4 text-xs font-semibold text-foreground transition hover:border-brand/40 hover:text-brand"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
