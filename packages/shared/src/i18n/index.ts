import type { Language } from "../types";
import { en, type Dictionary } from "./en";
import { hi } from "./hi";
import { hinglish } from "./hinglish";
import type { DeepPartial, LeafKeys } from "./types";

export type { Dictionary } from "./en";
export type TranslationKey = LeafKeys<Dictionary>;
export type TranslateVars = Record<string, string | number>;
export type Translate = (key: TranslationKey, vars?: TranslateVars) => string;

const dictionaries: Record<Language, DeepPartial<Dictionary>> = { en, hi, hinglish };

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Creates a translator for a language with English fallback for missing keys. */
export function createTranslator(language: Language = "en"): Translate {
  const dict = dictionaries[language] ?? en;
  return (key, vars) => {
    const template = lookup(dict, key) ?? lookup(en, key) ?? key;
    return interpolate(template, vars);
  };
}

/** Translates arbitrary string keys (e.g. Firebase error codes) with a fallback key. */
export function translateDynamic(t: Translate, key: string, fallback: TranslationKey): string {
  const value = t(key as TranslationKey);
  return value === key ? t(fallback) : value;
}

export { en };
