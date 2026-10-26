export function ResultsSkeleton() {
  return (
    <div className="mt-5 space-y-3" aria-hidden="true">
      <div className="h-11 w-full animate-pulse rounded-xl border border-border bg-surface" />

      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border bg-surface p-4 sm:p-5"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-surface-2" />
            <div className="space-y-1.5">
              <div className="h-3 w-28 animate-pulse rounded bg-surface-2" />
              <div className="h-2.5 w-12 animate-pulse rounded bg-surface-2" />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {Array.from({ length: 2 }, (_, legIndex) => (
              <div key={legIndex} className="flex items-center gap-3">
                <div className="h-3 w-12 animate-pulse rounded bg-surface-2" />
                <div className="h-3 flex-1 animate-pulse rounded bg-surface-2" />
                <div className="h-3 w-14 animate-pulse rounded bg-surface-2" />
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="h-3 w-32 animate-pulse rounded bg-surface-2" />
            <div className="h-9 w-28 animate-pulse rounded-xl bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResultsPageSkeleton() {
  return (
    <div className="mt-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2.5">
        <div className="h-6 w-52 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-72 animate-pulse rounded bg-surface-2" />
      </div>
      <ResultsSkeleton />
    </div>
  );
}
