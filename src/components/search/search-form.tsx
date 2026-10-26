"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { todayIso } from "@/lib/dates";
import { flightQueryToSearchParams, type TripType } from "@/lib/search-params";
import { getDictionary } from "@/i18n";
import { AirportCombobox } from "@/components/search/airport-combobox";
import { SearchIcon, SwapIcon } from "@/components/ui/icons";

type FormErrors = {
  origin?: string;
  destination?: string;
  dates?: string;
};

const QUICK_ROUTES = [
  { origin: "LIM", destination: "MAD" },
  { origin: "MAD", destination: "LIM" },
  { origin: "MAD", destination: "BCN" },
  { origin: "LIM", destination: "CUZ" },
];

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-60";

const subscribeToNothing = () => () => {};

function useClientToday(): string {
  return useSyncExternalStore(subscribeToNothing, todayIso, () => "");
}

export function SearchForm() {
  const t = getDictionary();
  const router = useRouter();
  const [origin, setOrigin] = useState("LIM");
  const [destination, setDestination] = useState("MAD");
  const [tripType, setTripType] = useState<TripType>("roundtrip");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [flexible, setFlexible] = useState(false);
  const [passengers, setPassengers] = useState(1);
  const [maxStops, setMaxStops] = useState("");
  const [anyDestination, setAnyDestination] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const minDate = useClientToday();

  function handleOriginChange(nextOrigin: string) {
    setOrigin(nextOrigin);
    if (nextOrigin !== "MAD") {
      setAnyDestination(false);
    }
  }

  function handleAnyDestination(checked: boolean) {
    setAnyDestination(checked);
    if (checked) {
      setDestination("");
    }
  }

  function swapAirports() {
    setOrigin(destination);
    setDestination(origin);
    setAnyDestination(false);
    setErrors({});
  }

  function selectQuickRoute(nextOrigin: string, nextDestination: string) {
    setOrigin(nextOrigin);
    setDestination(nextDestination);
    setAnyDestination(false);
    setErrors({});
  }

  function validate(): FormErrors {
    const next: FormErrors = {};

    if (!origin) {
      next.origin = t.search.errors.origin;
    }

    if (!anyDestination && !destination) {
      next.destination = t.search.errors.destination;
    }

    if (!anyDestination && destination && origin === destination) {
      next.destination = t.search.errors.sameAirport;
    }

    if (!departureDate || (tripType === "roundtrip" && !returnDate)) {
      next.dates = t.search.errors.dates;
    } else if (tripType === "roundtrip" && returnDate < departureDate) {
      next.dates = t.search.errors.returnBeforeDeparture;
    }

    return next;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const params = flightQueryToSearchParams({
      origin,
      destination: anyDestination ? null : destination || null,
      tripType,
      departureDate,
      returnDate: tripType === "roundtrip" ? returnDate : null,
      passengers,
      maxStops: maxStops === "" ? null : Number(maxStops),
      flexible,
      anyDestination,
    });

    router.push(`/results?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-3xl border border-border bg-surface/95 p-4 shadow-xl shadow-black/5 backdrop-blur sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label={t.search.tripType}
          className="inline-flex rounded-full bg-surface-2 p-1"
        >
          <button
            type="button"
            onClick={() => setTripType("oneway")}
            aria-pressed={tripType === "oneway"}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              tripType === "oneway"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.search.tripOneway}
          </button>
          <button
            type="button"
            onClick={() => setTripType("roundtrip")}
            aria-pressed={tripType === "roundtrip"}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              tripType === "roundtrip"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.search.tripRoundtrip}
          </button>
        </div>

        <label
          className={`flex items-center gap-2 text-xs font-medium ${
            origin === "MAD" ? "text-foreground" : "text-muted opacity-60"
          }`}
        >
          <input
            type="checkbox"
            checked={anyDestination}
            disabled={origin !== "MAD"}
            onChange={(event) => handleAnyDestination(event.target.checked)}
            className="h-4 w-4 rounded accent-brand"
          />
          <span>{t.search.anyDestination}</span>
          <span className="hidden text-[11px] font-normal text-muted sm:inline">
            {t.search.anyDestinationHint}
          </span>
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <AirportCombobox
          id="origin"
          label={t.search.origin}
          value={origin}
          placeholder={t.search.placeholder}
          onChange={handleOriginChange}
          invalid={Boolean(errors.origin) || Boolean(errors.destination)}
        />

        <button
          type="button"
          onClick={swapAirports}
          disabled={anyDestination}
          aria-label={t.search.swap}
          title={t.search.swap}
          className="hidden h-[46px] w-10 place-items-center rounded-xl border border-border bg-surface text-muted transition hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40 sm:grid"
        >
          <SwapIcon className="h-4 w-4" />
        </button>

        <AirportCombobox
          id="destination"
          label={t.search.destination}
          value={destination}
          placeholder={
            anyDestination ? t.results.anyDestinationLabel : t.search.placeholder
          }
          onChange={setDestination}
          exclude={origin}
          invalid={Boolean(errors.destination) || Boolean(errors.origin)}
          disabled={anyDestination}
        />
      </div>

      <button
        type="button"
        onClick={swapAirports}
        disabled={anyDestination}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand disabled:opacity-40 sm:hidden"
      >
        <SwapIcon className="h-3.5 w-3.5" />
        {t.search.swap}
      </button>

      {errors.origin || errors.destination ? (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {errors.origin ?? errors.destination}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="departureDate" className="mb-1.5 block text-xs font-medium text-muted">
            {t.search.departure}
          </label>
          <input
            id="departureDate"
            type="date"
            min={minDate}
            value={departureDate}
            onChange={(event) => setDepartureDate(event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="returnDate" className="mb-1.5 block text-xs font-medium text-muted">
            {t.search.return}
          </label>
          <input
            id="returnDate"
            type="date"
            min={departureDate || minDate}
            value={tripType === "oneway" ? "" : returnDate}
            disabled={tripType === "oneway"}
            onChange={(event) => setReturnDate(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-foreground">
          <input
            type="checkbox"
            checked={flexible}
            onChange={(event) => setFlexible(event.target.checked)}
            className="h-4 w-4 rounded accent-brand"
          />
          {t.search.flexible}
        </label>

        {errors.dates ? (
          <p role="alert" className="text-xs font-medium text-danger">
            {errors.dates}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="passengers" className="mb-1.5 block text-xs font-medium text-muted">
            {t.search.passengers}
          </label>
          <select
            id="passengers"
            value={passengers}
            onChange={(event) => setPassengers(Number(event.target.value))}
            className={inputClass}
          >
            {Array.from({ length: 9 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? t.search.passengerOne : t.search.passengerMany}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="maxStops" className="mb-1.5 block text-xs font-medium text-muted">
            {t.search.maxStops}
          </label>
          <select
            id="maxStops"
            value={maxStops}
            onChange={(event) => setMaxStops(event.target.value)}
            className={inputClass}
          >
            <option value="">{t.search.stopsAny}</option>
            <option value="0">{t.search.stopsDirect}</option>
            <option value="1">{t.search.stopsOne}</option>
            <option value="2">{t.search.stopsTwo}</option>
          </select>
        </div>

        <button
          type="submit"
          className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <SearchIcon className="h-4 w-4" />
          {t.search.submit}
        </button>
      </div>

      {submitted && Object.keys(errors).length > 0 ? (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
          {t.search.fixErrors}
        </p>
      ) : null}

      <div className="mt-5 border-t border-border/80 pt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          {t.home.quickRoutes}
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_ROUTES.map((route) => (
            <button
              key={`${route.origin}-${route.destination}`}
              type="button"
              onClick={() => selectQuickRoute(route.origin, route.destination)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-brand/40 hover:bg-brand-soft/60 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            >
              {route.origin}
              <span className="text-muted">→</span>
              {route.destination}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
