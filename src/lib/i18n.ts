import en from "../../messages/en.json";
import hu from "../../messages/hu.json";
import type { Locale } from "@/types/db";

const dictionaries: Record<Locale, unknown> = { en, hu };

export type Translator = (
  key: string,
  vars?: Record<string, string | number>
) => string;

function lookup(dict: unknown, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as object)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return node;
}

function interpolate(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}

/** Returns a translator for the locale; falls back to English, then the key. */
export function getT(locale: Locale = "en"): Translator {
  const dict = dictionaries[locale] ?? en;
  return (key, vars) => {
    const value = lookup(dict, key) ?? lookup(en, key);
    if (typeof value !== "string") return key;
    return interpolate(value, vars);
  };
}

/** For array-valued entries (e.g. privacy paragraphs). */
export function getList(locale: Locale, key: string): string[] {
  const value = lookup(dictionaries[locale] ?? en, key) ?? lookup(en, key);
  return Array.isArray(value) ? (value as string[]) : [];
}
