import { ResultsPageSkeleton } from "@/components/results/results-skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
      <ResultsPageSkeleton />
    </main>
  );
}
