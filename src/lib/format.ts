import type { Locale } from "@/types/db";

const localeTag: Record<Locale, string> = { en: "en-GB", hu: "hu-HU" };

export function formatDateTime(iso: string, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatDate(iso: string, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    dateStyle: "medium",
  }).format(new Date(iso));
}

export function timeAgo(iso: string, locale: Locale = "en"): string {
  const rtf = new Intl.RelativeTimeFormat(localeTag[locale], {
    numeric: "auto",
  });
  const diffSec = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatDate(iso, locale);
}
