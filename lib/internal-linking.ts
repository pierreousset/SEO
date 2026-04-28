/**
 * Pure algorithmic internal linking suggestions.
 * No AI — based on keyword/topic overlap, orphan detection, and low-outlink pages.
 */

export type CrawlPage = {
  url: string;
  title: string | null;
  h1: string | null;
  wordCount: number | null;
  internalLinksOut: number | null;
  linkedFrom: string | null; // JSON array of URLs
};

export type Keyword = {
  query: string;
  intentStage: number | null;
};

export type LinkSuggestion = {
  fromUrl: string;
  fromTitle: string | null;
  toUrl: string;
  toTitle: string | null;
  reason: string;
  impact: "high" | "medium" | "low";
};

/**
 * Normalize text for keyword matching: lowercase, trim, collapse whitespace.
 */
function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Parse the linkedFrom JSON text field into a Set of URLs.
 */
function parseLinkedFrom(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.map(String));
  } catch {
    // ignore malformed JSON
  }
  return new Set();
}

/**
 * Check whether page A already links to page B.
 * We consider A links to B if B appears in the outgoing links of A.
 * Since we don't have per-page outgoing link targets, we approximate:
 * B's linkedFrom includes A's URL.
 */
function alreadyLinked(
  fromUrl: string,
  toUrl: string,
  linkedFromMap: Map<string, Set<string>>,
): boolean {
  const incomingOfTarget = linkedFromMap.get(toUrl);
  return incomingOfTarget ? incomingOfTarget.has(fromUrl) : false;
}

export function suggestInternalLinks(
  pages: CrawlPage[],
  keywords: Keyword[],
): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = [];
  const seen = new Set<string>(); // "fromUrl->toUrl" dedup key

  // Pre-compute linkedFrom map: url -> set of URLs that link to it
  const linkedFromMap = new Map<string, Set<string>>();
  for (const page of pages) {
    linkedFromMap.set(page.url, parseLinkedFrom(page.linkedFrom));
  }

  // Helper to add a suggestion with dedup
  function add(s: LinkSuggestion) {
    const key = `${s.fromUrl}->${s.toUrl}`;
    if (seen.has(key)) return;
    if (s.fromUrl === s.toUrl) return;
    seen.add(key);
    suggestions.push(s);
  }

  // ---------------------------------------------------------------
  // 1. Keyword-to-page map: which pages mention which tracked keywords
  // ---------------------------------------------------------------
  const keywordQueries = keywords.map((k) => normalize(k.query));
  const keywordToPages = new Map<string, CrawlPage[]>();

  for (const page of pages) {
    const haystack = normalize(
      [page.title ?? "", page.h1 ?? ""].join(" "),
    );
    for (const kw of keywordQueries) {
      if (!kw) continue;
      if (haystack.includes(kw)) {
        let arr = keywordToPages.get(kw);
        if (!arr) {
          arr = [];
          keywordToPages.set(kw, arr);
        }
        arr.push(page);
      }
    }
  }

  // For each keyword group with 2+ pages, suggest cross-links between pages
  // that don't already link to each other.
  for (const [kw, group] of keywordToPages) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        // Suggest A -> B if not already linked
        if (!alreadyLinked(a.url, b.url, linkedFromMap)) {
          add({
            fromUrl: a.url,
            fromTitle: a.title,
            toUrl: b.url,
            toTitle: b.title,
            reason: `Both pages target "${kw}"`,
            impact: "high",
          });
        }
        // Suggest B -> A if not already linked
        if (!alreadyLinked(b.url, a.url, linkedFromMap)) {
          add({
            fromUrl: b.url,
            fromTitle: b.title,
            toUrl: a.url,
            toTitle: a.title,
            reason: `Both pages target "${kw}"`,
            impact: "high",
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------
  // 2. Orphan pages: linkedFrom empty/zero → find a relevant popular page to link from
  // ---------------------------------------------------------------
  const orphanPages = pages.filter((p) => {
    const incoming = linkedFromMap.get(p.url);
    return !incoming || incoming.size === 0;
  });

  // Rank pages by incoming links (most popular first) for orphan matching
  const pagesByPopularity = [...pages]
    .map((p) => ({
      page: p,
      incomingCount: linkedFromMap.get(p.url)?.size ?? 0,
    }))
    .sort((a, b) => b.incomingCount - a.incomingCount);

  for (const orphan of orphanPages) {
    const orphanText = normalize(
      [orphan.title ?? "", orphan.h1 ?? ""].join(" "),
    );
    if (!orphanText.trim()) continue;

    // Find the most popular page that shares at least one word (>3 chars) with the orphan
    const orphanWords = orphanText
      .split(" ")
      .filter((w) => w.length > 3);

    for (const { page: candidate } of pagesByPopularity) {
      if (candidate.url === orphan.url) continue;
      if (alreadyLinked(candidate.url, orphan.url, linkedFromMap)) continue;

      const candidateText = normalize(
        [candidate.title ?? "", candidate.h1 ?? ""].join(" "),
      );
      const hasOverlap = orphanWords.some((w) => candidateText.includes(w));
      if (hasOverlap) {
        add({
          fromUrl: candidate.url,
          fromTitle: candidate.title,
          toUrl: orphan.url,
          toTitle: orphan.title,
          reason: "Orphan page needs incoming links",
          impact: "high",
        });
        break; // one suggestion per orphan
      }
    }
  }

  // ---------------------------------------------------------------
  // 3. Pages with few outgoing links (<3) → suggest they link to relevant pages
  // ---------------------------------------------------------------
  const lowOutlinkPages = pages.filter(
    (p) => (p.internalLinksOut ?? 0) < 3,
  );

  for (const page of lowOutlinkPages) {
    const pageText = normalize(
      [page.title ?? "", page.h1 ?? ""].join(" "),
    );
    const pageWords = pageText.split(" ").filter((w) => w.length > 3);
    if (pageWords.length === 0) continue;

    let added = 0;
    for (const candidate of pages) {
      if (candidate.url === page.url) continue;
      if (alreadyLinked(page.url, candidate.url, linkedFromMap)) continue;

      const candidateText = normalize(
        [candidate.title ?? "", candidate.h1 ?? ""].join(" "),
      );
      const overlap = pageWords.filter((w) => candidateText.includes(w));
      if (overlap.length > 0) {
        add({
          fromUrl: page.url,
          fromTitle: page.title,
          toUrl: candidate.url,
          toTitle: candidate.title,
          reason: `Page has few outgoing links (${page.internalLinksOut ?? 0})`,
          impact: "medium",
        });
        added++;
        if (added >= 2) break; // max 2 suggestions per low-outlink page
      }
    }
  }

  // ---------------------------------------------------------------
  // Sort by impact priority and return top 20
  // ---------------------------------------------------------------
  const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  suggestions.sort(
    (a, b) => (impactOrder[a.impact] ?? 2) - (impactOrder[b.impact] ?? 2),
  );

  return suggestions.slice(0, 20);
}
