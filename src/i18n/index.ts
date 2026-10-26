import { es, type Dictionary } from "@/i18n/es";

export const locales = ["es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "es";

const dictionaries: Record<Locale, Dictionary> = {
  es,
};

export function getDictionary(locale: Locale = defaultLocale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
