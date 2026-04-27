/**
 * Competitor activity feed — detects significant SERP changes by competitor
 * from the existing competitor_positions data. No new tables, no new fetches;
 * we just read what we've already been storing daily.
 *
 * Event types:
 *   big_up       — competitor jumped up N positions (positive delta)
 *   big_down     — competitor lost N positions (negative delta)
 *   new_entry    — wasn't ranking in top N at window start, now is
 *   lost         — was ranking, no longer in top N
 *   url_swap     — same competitor, different URL ranks now (content pivot)
 *
 * Impact score rewards big moves at high ranks (position #2 → #1 beats #45 → #30).
 */

export type CompetitorEventType =
  | "big_up"
  | "big_down"
  | "new_entry"
  | "lost"
  | "url_swap";

export type CompetitorEvent = {
  type: CompetitorEventType;
  keywordId: string;
  keyword: string;
  competitorDomain: string;
  date: string; // YYYY-MM-DD — date the event "happened" (the newer snapshot)
  fromPosition: number | null;
  toPosition: number | null;
  fromUrl: string | null;
  toUrl: string | null;
  impact: number; // sort key; higher = more significant
};

export type PositionRow = {
  keywordId: string;
  competitorDomain: string;
  date: string;
  position: number | null;
  url: string | null;
};

const BIG_MOVE_THRESHOLD = 3; // delta of >= 3 positions counts as "big"
const TOP_N = 20; // we care about top 20 SERP positions

export function buildCompetitorFeed(
  rows: PositionRow[],
  keywordById: Map<string, { id: string; query: string }>,
  windowDays = 7,
): CompetitorEvent[] {
  if (rows.length === 0) return [];

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Group by (keywordId, competitorDomain)
  const groups = new Map<string, PositionRow[]>();
  for (const r of rows) {
    const key = `${r.keywordId}__${r.competitorDomain}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const events: CompetitorEvent[] = [];

  for (const [, rows] of groups) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const recent = rows.filter((r) => r.date >= cutoffStr);
    if (recent.length < 2) continue;

    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    const kw = keywordById.get(newest.keywordId);
    if (!kw) continue;

    const base = {
      keywordId: newest.keywordId,
      keyword: kw.query,
      competitorDomain: newest.competitorDomain,
      date: newest.date,
    } as const;

    const oldPos = oldest.position;
    const newPos = newest.position;

    // Case: was not ranking at window start, now is
    if ((oldPos == null || oldPos > TOP_N) && newPos != null && newPos <= TOP_N) {
      events.push({
        ...base,
        type: "new_entry",
        fromPosition: oldPos,
        toPosition: newPos,
        fromUrl: oldest.url,
        toUrl: newest.url,
        impact: impactScore("new_entry", oldPos, newPos),
      });
      continue;
    }

    // Case: was ranking, now not
    if (oldPos != null && oldPos <= TOP_N && (newPos == null || newPos > TOP_N)) {
      events.push({
        ...base,
        type: "lost",
        fromPosition: oldPos,
        toPosition: newPos,
        fromUrl: oldest.url,
        toUrl: newest.url,
        impact: impactScore("lost", oldPos, newPos),
      });
      continue;
    }

    if (oldPos == null || newPos == null) continue;

    const delta = oldPos - newPos; // positive = moved up the SERP
    if (Math.abs(delta) >= BIG_MOVE_THRESHOLD) {
      events.push({
        ...base,
        type: delta > 0 ? "big_up" : "big_down",
        fromPosition: oldPos,
        toPosition: newPos,
        fromUrl: oldest.url,
        toUrl: newest.url,
        impact: impactScore(delta > 0 ? "big_up" : "big_down", oldPos, newPos),
      });
    }

    // URL swap — same competitor domain, different URL ranking in the window.
    if (
      oldest.url &&
      newest.url &&
      oldest.url !== newest.url &&
      oldPos != null &&
      newPos != null &&
      oldPos <= TOP_N &&
      newPos <= TOP_N
    ) {
      events.push({
        ...base,
        type: "url_swap",
        fromPosition: oldPos,
        toPosition: newPos,
        fromUrl: oldest.url,
        toUrl: newest.url,
        impact: impactScore("url_swap", oldPos, newPos),
      });
    }
  }

  events.sort((a, b) => b.impact - a.impact);
  return events;
}

function impactScore(
  type: CompetitorEventType,
  fromPos: number | null,
  toPos: number | null,
): number {
  const from = fromPos ?? 100;
  const to = toPos ?? 100;
  const magnitude = Math.abs(from - to);
  // Closer to #1 = higher rank weight.
  const rankWeight = 1 + Math.max(0, 20 - Math.min(from, to)) / 5;
  const typeBoost =
    type === "new_entry" ? 1.3 : type === "big_up" ? 1.2 : type === "big_down" ? 1.0 : 0.8;
  return magnitude * rankWeight * typeBoost;
}
