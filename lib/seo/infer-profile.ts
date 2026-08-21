/**
 * Infer business profile fields from site copy + search queries.
 * Heuristic only — no LLM. Fill empty profile slots, never invent a niche.
 */

import { tokenize } from "@/lib/audit/keyword-context";

export type InferredProfile = {
  businessName: string | null;
  primaryService: string | null;
  secondaryServices: string[];
  targetCities: string[];
  preferredLanguage: "fr" | "en";
};

export type InferProfileInput = {
  domain?: string | null;
  siteName?: string | null;
  homepageTitle?: string | null;
  homepageH1s?: string[];
  homepageDescription?: string | null;
  topQueries?: string[];
  pageTitles?: string[];
};

const CITIES = [
  "paris", "lyon", "marseille", "toulouse", "lille", "bordeaux", "nantes",
  "strasbourg", "nice", "rennes", "montpellier", "grenoble", "toulon",
  "dijon", "angers", "villeurbanne", "le havre", "reims", "saint-etienne",
  "madrid", "barcelone", "barcelona", "valence", "valencia", "malaga",
  "seville", "sevilla", "bilbao", "alicante", "saragosse", "zaragoza",
  "lisbonne", "lisboa", "porto",
  "bruxelles", "brussels", "anvers", "liege",
  "geneve", "lausanne", "zurich",
  "londres", "london", "milan", "rome", "berlin", "amsterdam", "lisbon",
];

const WEAK = new Set([
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "au", "aux",
  "the", "a", "an", "of", "for", "to", "in", "on", "and", "or", "par", "sur",
  "pour", "avec", "dans", "votre", "nos", "notre", "plus", "bien", "biens",
  "france", "french", "francais", "francaise", "official", "accueil", "home",
  "page", "site", "www", "https", "http", "blog", "contact",
]);

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleLead(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.split("|")[0]!.split("–")[0]!.split(" - ")[0]!.trim();
}

function findCities(texts: string[]): string[] {
  const hay = fold(texts.join(" • "));
  const found: string[] = [];
  for (const city of CITIES) {
    const re = new RegExp(`(?:^|[^a-z])${city.replace(" ", "\\s+")}(?:$|[^a-z])`);
    if (re.test(hay) && !found.some((c) => fold(c) === city)) {
      found.push(city.replace(/\b\w/g, (ch) => ch.toUpperCase()).replace("Le Havre", "Le Havre"));
    }
  }
  return found.slice(0, 6);
}

function prettyCity(city: string): string {
  const special: Record<string, string> = {
    "le havre": "Le Havre",
    "saint-etienne": "Saint-Étienne",
    barcelone: "Barcelone",
    barcelona: "Barcelone",
    valence: "Valence",
    valencia: "Valencia",
    seville: "Séville",
    sevilla: "Séville",
    lisbonne: "Lisbonne",
    lisboa: "Lisbonne",
    bruxelles: "Bruxelles",
    brussels: "Bruxelles",
    geneve: "Genève",
    londres: "Londres",
    london: "Londres",
  };
  const key = fold(city);
  if (special[key]) return special[key];
  return key.replace(/(^|\s|-)\S/g, (s) => s.toUpperCase());
}

function stripCitiesAndWeak(phrase: string, cities: string[]): string {
  let s = fold(phrase);
  for (const city of cities) {
    s = s.replace(new RegExp(`\\b${fold(city)}\\b`, "g"), " ");
  }
  s = s
    .replace(/\b(a|à|au|aux|en|in|de|du|des|sur)\b/g, " ")
    .replace(/[^a-z0-9àâäéèêëïîôùûüç\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = s.split(" ").filter((w) => w.length >= 2 && !WEAK.has(fold(w)));
  return words.slice(0, 6).join(" ");
}

function brandFromDomain(domain?: string | null): string | null {
  if (!domain) return null;
  const host = domain.replace(/^www\./, "").split("/")[0]!.split(".")[0] ?? "";
  if (host.length < 3) return null;
  return host.charAt(0).toUpperCase() + host.slice(1);
}

function detectLang(texts: string[]): "fr" | "en" {
  const blob = texts.join(" ").toLowerCase();
  const frHits = (blob.match(/\b(le|la|les|des|une|pour|avec|votre|immobilier|agence)\b/g) ?? []).length
    + (blob.match(/[àâéèêëïîôùûç]/g) ?? []).length;
  const enHits = (blob.match(/\b(the|and|for|with|your|real|estate|agency)\b/g) ?? []).length;
  return frHits >= enHits ? "fr" : "en";
}

/**
 * Build a profile sketch from everything we already crawled or imported.
 */
export function inferBusinessProfile(input: InferProfileInput): InferredProfile {
  const h1s = (input.homepageH1s ?? []).map((h) => h.trim()).filter(Boolean);
  const titles = [
    titleLead(input.homepageTitle),
    ...h1s.slice(0, 3),
    ...(input.pageTitles ?? []).slice(0, 8).map(titleLead),
  ].filter(Boolean);

  const corpus = [
    input.homepageTitle,
    input.homepageDescription,
    ...h1s,
    ...(input.topQueries ?? []).slice(0, 40),
    ...titles,
  ].filter((s): s is string => Boolean(s));

  const rawCities = findCities(corpus);
  const targetCities = rawCities.map(prettyCity);

  const lead = titles[0] ?? "";
  const serviceFromTitle = stripCitiesAndWeak(lead, rawCities);

  const queryNgrams = frequentPhrases(input.topQueries ?? [], rawCities);
  const secondary = queryNgrams
    .filter((p) => p !== serviceFromTitle && !serviceFromTitle.includes(p))
    .slice(0, 4);

  const primaryService = serviceFromTitle.length >= 3 ? serviceFromTitle : queryNgrams[0] ?? null;

  return {
    businessName: (input.siteName && input.siteName.trim()) || brandFromDomain(input.domain),
    primaryService,
    secondaryServices: secondary,
    targetCities,
    preferredLanguage: detectLang(corpus),
  };
}

function frequentPhrases(queries: string[], cities: string[]): string[] {
  const counts = new Map<string, number>();
  for (const q of queries) {
    const cleaned = stripCitiesAndWeak(q, cities);
    const words = tokenize(cleaned).filter((w) => !WEAK.has(w) && w.length >= 3);
    if (words.length === 0) continue;
    const phrase = words.slice(0, 4).join(" ");
    if (phrase.length < 3) continue;
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([p]) => p)
    .slice(0, 6);
}
