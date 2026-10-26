import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDictionary } from "@/i18n";
import { getAirport } from "@/lib/airports";
import { formatDate } from "@/lib/dates";
import {
  parseFlightQuery,
  SearchQueryError,
  type FlightSearchQuery,
} from "@/lib/search-params";
import { ResultsClient } from "@/components/results/results-client";
import { ResultsPageSkeleton } from "@/components/results/results-skeleton";
import { SearchIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Resultados",
};

export default function ResultsPage(props: PageProps<"/results">) {
  const t = getDictionary();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-brand"
      >
        <span aria-hidden="true">←</span>
        {t.results.newSearch}
      </Link>

      <Suspense fallback={<ResultsPageSkeleton />}>
        <ResultsContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

type ResultsContentProps = Pick<PageProps<"/results">, "searchParams">;

async function ResultsContent({ searchParams }: ResultsContentProps) {
  const params = await searchParams;
  const t = getDictionary();

  let query: FlightSearchQuery;
  try {
    query = parseFlightQuery(params);
  } catch (error) {
    const message = error instanceof SearchQueryError ? error.message : t.results.invalidSearchText;

    return (
      <div className="mt-6 rounded-2xl border border-danger/25 bg-danger/5 p-8 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-surface text-danger">
          <SearchIcon className="h-5 w-5" />
        </span>
        <h1 className="mt-3 text-base font-semibold text-foreground">
          {t.results.invalidSearchTitle}
        </h1>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted">{message}</p>
        <Link
          href="/"
          className="mt-4 inline-flex h-9 items-center rounded-xl bg-brand px-4 text-xs font-semibold text-white transition hover:bg-brand-strong"
        >
          {t.results.newSearch}
        </Link>
      </div>
    );
  }

  return (
    <>
      <SearchSummary query={query} />
      <ResultsClient query={query} />
    </>
  );
}

function SearchSummary({ query }: { query: FlightSearchQuery }) {
  const t = getDictionary();
  const origin = getAirport(query.origin);
  const destination = query.destination ? getAirport(query.destination) : null;
  const originLabel = origin ? `${origin.city} (${origin.iata})` : query.origin;
  const destinationLabel = query.anyDestination
    ? t.search.anyDestination
    : destination
      ? `${destination.city} (${destination.iata})`
      : (query.destination ?? "");
  const passengerLabel =
    query.passengers === 1 ? t.search.passengerOne : t.search.passengerMany;

  return (
    <div className="mt-4">
      <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        <span>{originLabel}</span>
        <span className="text-muted" aria-hidden="true">
          →
        </span>
        <span>{destinationLabel}</span>
      </h1>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span>{query.tripType === "oneway" ? t.search.tripOneway : t.search.tripRoundtrip}</span>
        <span aria-hidden="true">·</span>
        <span>
          {formatDate(query.departureDate)}
          {query.returnDate ? ` – ${formatDate(query.returnDate)}` : ""}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {query.passengers} {passengerLabel}
        </span>
        {query.flexible ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="rounded-full bg-brand-soft/70 px-2 py-0.5 text-[10px] font-semibold text-brand">
              {t.search.flexible}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
