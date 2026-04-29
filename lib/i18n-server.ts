import "server-only";
import { cookies } from "next/headers";
import type { Locale } from "./i18n";

const VALID: ReadonlySet<Locale> = new Set(["fr", "en"]);

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get("locale")?.value;
  return v && (VALID as Set<string>).has(v) ? (v as Locale) : "en";
}
