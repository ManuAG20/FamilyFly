import { getDictionary } from "@/i18n";
import { SearchForm } from "@/components/search/search-form";
import { BellIcon, CalendarIcon, PlaneIcon, ShieldIcon } from "@/components/ui/icons";

export default function Home() {
  const t = getDictionary();
  const features = [
    {
      icon: CalendarIcon,
      title: t.home.features.cacheTitle,
      text: t.home.features.cacheText,
    },
    {
      icon: BellIcon,
      title: t.home.features.alertsTitle,
      text: t.home.features.alertsText,
    },
    {
      icon: PlaneIcon,
      title: t.home.features.familyTitle,
      text: t.home.features.familyText,
    },
  ];

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-brand/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-brand-soft/70 blur-3xl dark:bg-brand/5"
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand">
              <PlaneIcon className="h-3.5 w-3.5" />
              {t.home.badge}
            </span>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {t.home.title}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted sm:text-base">
              {t.home.subtitle}
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-4xl">
            <SearchForm />
          </div>

          <div className="mx-auto mt-4 flex max-w-4xl flex-col items-center justify-center gap-2 text-center text-xs text-muted sm:flex-row sm:gap-4">
            <span className="inline-flex items-center gap-1.5">
              <ShieldIcon className="h-3.5 w-3.5 text-brand" />
              {t.home.onlyConsult}
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-border sm:block" />
            <span className="max-w-md text-pretty text-[11px] sm:text-xs">{t.home.demoNotice}</span>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-border bg-surface p-5 shadow-sm shadow-black/[0.02]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-sm font-semibold text-foreground">{feature.title}</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{feature.text}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-surface-2/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t.home.prioritiesTitle}</h2>
            <p className="mt-1 text-xs text-muted">{t.home.prioritiesText}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["LIM", "CUZ", "AQP", "MAD", "BCN"].map((code) => (
              <span
                key={code}
                className="rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-xs font-semibold text-brand"
              >
                {code}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
