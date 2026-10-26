import { getDictionary } from "@/i18n";

export function SiteFooter() {
  const t = getDictionary();

  return (
    <footer className="border-t border-border bg-surface/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-xs leading-relaxed text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
        <p className="max-w-xl">{t.footer.disclaimer}</p>
        <p className="max-w-xl md:text-right">{t.footer.dataNote}</p>
      </div>
    </footer>
  );
}
