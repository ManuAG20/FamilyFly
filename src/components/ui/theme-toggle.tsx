"use client";

import { getDictionary } from "@/i18n";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

const STORAGE_KEY = "familyfly-theme";

export function ThemeToggle() {
  const t = getDictionary();

  function toggleTheme() {
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";
    root.classList.toggle("dark", next === "dark");
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      return;
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t.header.theme}
      title={t.header.theme}
      className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-muted transition hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <SunIcon className="h-4 w-4 dark:hidden" />
      <MoonIcon className="hidden h-4 w-4 dark:block" />
    </button>
  );
}

export function ThemeScript() {
  const script = `(function(){try{var stored=localStorage.getItem("${STORAGE_KEY}");var dark=stored?stored==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(dark){document.documentElement.classList.add("dark")}}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
