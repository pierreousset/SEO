import type { AuditLang } from "@/lib/audit/messages";

const STOP = new Set([
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "au", "aux",
  "the", "a", "an", "of", "for", "to", "in", "on", "and", "or", "par", "sur",
  "pour", "avec", "dans",
]);

/** Title stored as `"the title"` in finding.detail. */
export function titleFromDetail(detail: string | null | undefined): string | null {
  if (!detail) return null;
  const m = detail.match(/^"([\s\S]*?)"/);
  return m ? m[1] : null;
}

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

/** Keyword words not already in the title: the actual insert, not a rewrite. */
export function extraWords(keyword: string, title: string | null): string[] {
  const have = new Set(tokenize(title ?? ""));
  return tokenize(keyword).filter((w) => !have.has(w));
}

function pathBlob(url: string): string {
  let path = url.toLowerCase();
  try {
    const u = new URL(url);
    path = `${u.hostname.replace(/^www\./, "")} ${decodeURIComponent(u.pathname)}`.toLowerCase();
  } catch {
    /* keep */
  }
  return `${path} ${path.replace(/[-_/]+/g, " ")}`;
}

/** Page topic = title + URL slugs. Host brand names (short) are ignored. */
export function pageTopicTokens(url: string, title: string | null): string[] {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").split(".")[0] ?? "";
  } catch {
    /* ignore */
  }
  const raw = [...tokenize(title ?? ""), ...tokenize(pathBlob(url))];
  const brand = host.length >= 4 ? host : "";
  return [...new Set(raw.filter((w) => w !== brand && w.length >= 3))];
}

function relatedToken(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

/** How many content words the keyword shares with this page's topic. */
export function topicOverlap(keyword: string, pageTokens: string[]): number {
  const kw = tokenize(keyword);
  let n = 0;
  for (const w of kw) {
    if (pageTokens.some((p) => relatedToken(w, p))) n++;
  }
  return n;
}

/**
 * 1–2 tracked keywords that belong on THIS page.
 * Drops off-topic queries (voiture on a moto page). Among the rest, prefers
 * the fewest new words so the current title barely changes.
 */
export function missingTrackedKeywords(
  url: string,
  title: string | null,
  tracked: string[],
  limit = 2,
): string[] {
  const lcTitle = (title ?? "").toLowerCase();
  const missing = tracked.filter((k) => k.trim() && !lcTitle.includes(k.toLowerCase()));
  const topic = pageTopicTokens(url, title);
  const blob = pathBlob(url);

  const ranked = missing
    .map((k) => {
      const overlap = topicOverlap(k, topic);
      const extra = extraWords(k, title);
      const inPath =
        extra.some((w) => blob.includes(w)) ||
        blob.includes(k.toLowerCase().replace(/\s+/g, "-"));
      return { k, overlap, extra: extra.length, inPath };
    })
    .filter((row) => row.overlap > 0)
    .sort((a, b) => {
      if (a.overlap !== b.overlap) return b.overlap - a.overlap;
      if (a.extra !== b.extra) return a.extra - b.extra;
      if (a.inPath !== b.inPath) return a.inPath ? -1 : 1;
      return a.k.length - b.k.length;
    });

  const picked: string[] = [];
  const used = new Set<string>();
  for (const row of ranked) {
    if (picked.length >= limit) break;
    const key = tokenize(row.k).sort().join(" ");
    if (used.has(key)) continue;
    used.add(key);
    picked.push(row.k);
  }
  return picked;
}

/** Prompt the user pastes into an AI so it outputs only the new title. */
export function titleRewritePrompt(opts: {
  lang: AuditLang;
  url: string;
  title: string | null;
  keywords: string[];
}): string {
  const kws = opts.keywords;
  if (opts.lang === "en") {
    const list = kws.map((k, i) => `${i + 1}. ${k}`).join("\n");
    return [
      "Rewrite this page's HTML title.",
      "Change as little as possible. Keep the current meaning and any brand name.",
      "Insert the keyword(s) below. They match this page's topic. The first one is required.",
      "Do not use keywords about a different topic than this URL.",
      "",
      `URL: ${opts.url}`,
      `Current title: ${opts.title ?? "(none)"}`,
      "Keywords to insert:",
      list || "(none)",
      "",
      "Constraints: 50-60 characters. Do not invent extra keywords. Do not add quotes.",
      "Reply with the new title only.",
    ].join("\n");
  }
  const list = kws.map((k, i) => `${i + 1}. ${k}`).join("\n");
  return [
    "Réécris le title HTML de cette page.",
    "Change le moins possible. Garde le sens actuel et le nom de marque s'il est déjà là.",
    "Insère le ou les mots-clés ci-dessous. Ils correspondent au sujet de cette page. Le premier est obligatoire.",
    "N'utilise pas un mot-clé d'un autre sujet que cette URL.",
    "",
    `URL : ${opts.url}`,
    `Title actuel : ${opts.title ?? "(aucun)"}`,
    "Mots-clés à insérer :",
    list || "(aucun)",
    "",
    "Contraintes : 50-60 caractères. N'invente pas d'autres mots-clés. Pas de guillemets.",
    "Réponds uniquement avec le nouveau title.",
  ].join("\n");
}
