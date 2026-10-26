import Link from "next/link";
import { getDictionary } from "@/i18n";
import { PlaneIcon } from "@/components/ui/icons";
import { CurrencySelector } from "@/components/ui/currency-selector";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function SiteHeader() {
  const t = getDictionary();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-sm">
            <PlaneIcon className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            {t.common.appName}
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden text-xs text-muted md:block">{t.header.search}</span>
          <CurrencySelector />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
