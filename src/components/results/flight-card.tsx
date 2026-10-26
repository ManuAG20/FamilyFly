"use client";

import { getAirline } from "@/data/airlines";
import { getDictionary } from "@/i18n";
import { formatCurrency } from "@/lib/currency";
import {
  formatDataAge,
  formatDateShort,
  formatDuration,
  formatTime,
} from "@/lib/dates";
import type { FlightLeg, FlightOfferWithAge } from "@/lib/providers/types";
import { ExternalIcon, PlaneIcon } from "@/components/ui/icons";
import { useCurrency } from "@/components/providers/currency-provider";

type FlightCardProps = {
  offer: FlightOfferWithAge;
  isCheapest: boolean;
  isRecommended: boolean;
};

export function FlightCard({ offer, isCheapest, isRecommended }: FlightCardProps) {
  const t = getDictionary();
  const { currency, format } = useCurrency();
  const airline = getAirline(offer.airlineCode);
  const original =
    currency === offer.price.currency
      ? null
      : formatCurrency(offer.price.amount, offer.price.currency);

  return (
    <article
      className={`rounded-2xl border bg-surface p-4 shadow-sm shadow-black/[0.02] transition hover:shadow-md sm:p-5 ${
        isCheapest ? "border-brand/45 ring-1 ring-brand/15" : "border-border"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-[11px] font-bold text-brand">
              {offer.airlineCode}
              <span
                aria-hidden="true"
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface"
                style={{ backgroundColor: airline.color }}
              />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{offer.airlineName}</p>
              <p className="text-[11px] text-muted">{offer.airlineCode}</p>
            </div>

            {isCheapest ? (
              <span className="rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                {t.results.bestPrice}
              </span>
            ) : null}

            {isRecommended && !isCheapest ? (
              <span className="rounded-full border border-brand/30 bg-brand-soft/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
                {t.results.recommended}
              </span>
            ) : null}
          </div>

          <div className="mt-3 space-y-2.5">
            {offer.legs.map((leg) => (
              <LegRow key={`${offer.id}-${leg.direction}`} leg={leg} />
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-border pt-3 lg:w-48 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 lg:text-right">
          <p className="text-2xl font-bold tracking-tight text-foreground">
            {format(offer.price.amount, offer.price.currency)}
          </p>
          <p className="text-[11px] text-muted">{t.common.perPerson}</p>
          {original ? (
            <p className="mt-0.5 text-[11px] text-muted">
              {t.results.original}: {original}
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-muted">
            {t.results.dataAge} {formatDataAge(offer.dataAgeHours)}
          </p>

          <div className="mt-3 flex flex-col gap-2">
            <a
              href={offer.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {t.results.viewDeal}
              <ExternalIcon className="h-3.5 w-3.5" />
            </a>
            <a
              href={offer.fallbackLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-1 text-[11px] font-medium text-muted transition hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            >
              {t.results.googleFlights}
              <ExternalIcon className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function LegRow({ leg }: { leg: FlightLeg }) {
  const t = getDictionary();
  const first = leg.segments[0];
  const last = leg.segments[leg.segments.length - 1];
  const stops = leg.segments.length - 1;

  return (
    <div className="flex items-start gap-3">
      <div className="w-14 shrink-0 pt-0.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
          {leg.direction === "outbound" ? t.results.outbound : t.results.inbound}
        </p>
        <p className="text-[11px] text-muted">{formatDateShort(first.departureAt.slice(0, 10))}</p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-foreground">{first.origin}</span>
          <div className="relative h-px flex-1 bg-border">
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface px-1 text-muted">
              <PlaneIcon className="h-3.5 w-3.5 rotate-90" />
            </span>
          </div>
          <span className="font-mono text-sm font-bold text-foreground">{last.destination}</span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted">
          <span>
            {formatTime(first.departureAt)} – {formatTime(last.arrivalAt)}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatDuration(leg.durationMinutes)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {stops === 0
              ? t.results.directFlight
              : stops === 1
                ? t.results.oneStop
                : `${stops} ${t.results.stopsCount}`}
          </span>
        </div>
      </div>
    </div>
  );
}
