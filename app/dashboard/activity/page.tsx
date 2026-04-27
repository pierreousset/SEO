import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, tenantDb, schema } from "@/db/client";
import { and, eq, gte } from "drizzle-orm";
import {
  ArrowDown,
  ArrowUp,
  TrendingUp,
  TrendingDown,
  Repeat,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { buildCompetitorFeed, type CompetitorEvent } from "@/lib/competitor-feed";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 7;

export default async function ActivityPage() {
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);

  const keywords = (await t.selectKeywords()).filter((k) => !k.removedAt);
  const keywordById = new Map(keywords.map((k) => [k.id, { id: k.id, query: k.query }]));

  // Pull the window of competitor_positions. Cap to ~10k rows so a long-tail
  // catalog doesn't blow memory — good enough for indie-scale accounts.
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select({
      keywordId: schema.competitorPositions.keywordId,
      competitorDomain: schema.competitorPositions.competitorDomain,
      date: schema.competitorPositions.date,
      position: schema.competitorPositions.position,
      url: schema.competitorPositions.url,
    })
    .from(schema.competitorPositions)
    .where(
      and(
        eq(schema.competitorPositions.userId, ctx.ownerId),
        gte(schema.competitorPositions.date, cutoffStr),
      ),
    )
    .limit(10000);

  const events = buildCompetitorFeed(rows, keywordById, WINDOW_DAYS);

  // Headline stats
  const upCount = events.filter((e) => e.type === "big_up" || e.type === "new_entry").length;
  const downCount = events.filter((e) => e.type === "big_down" || e.type === "lost").length;
  const byCompetitor = new Map<string, number>();
  for (const e of events) {
    byCompetitor.set(e.competitorDomain, (byCompetitor.get(e.competitorDomain) ?? 0) + 1);
  }
  const mostActive = [...byCompetitor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 1)[0];

  return (
    <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto space-y-8">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
            Competitor activity · last {WINDOW_DAYS} days
          </p>
          <h1 className="font-display text-[40px] mt-3">Activity</h1>
        </div>
      </header>

      {keywords.length === 0 ? (
        <div className="rounded-2xl bg-secondary p-8 md:p-10 max-w-2xl">
          <p className="text-lg">
            Track some keywords first — the feed surfaces what your competitors did on
            <strong> your </strong>SERP in the last week.
          </p>
          <Link
            href="/dashboard/keywords"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-85"
          >
            Add keywords <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl bg-secondary p-8 md:p-10 max-w-2xl">
          <p className="text-lg">
            <strong>All quiet on the competitive front.</strong> No big moves detected in the
            last {WINDOW_DAYS} days.
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            The feed needs at least two daily SERP fetches per keyword. If your tracking is
            fresh, check back in a few days.
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatTile
              label="Moves up"
              value={upCount.toString()}
              subtitle="competitors gained rank or entered top 20"
              accent="up"
            />
            <StatTile
              label="Moves down"
              value={downCount.toString()}
              subtitle="competitors lost rank or dropped out"
              accent="down"
            />
            <StatTile
              label="Most active"
              value={mostActive?.[0] ?? "—"}
              subtitle={mostActive ? `${mostActive[1]} event${mostActive[1] > 1 ? "s" : ""}` : "nobody yet"}
              muted={!mostActive}
            />
          </section>

          <section className="space-y-3">
            {events.map((e, i) => (
              <EventCard key={`${e.keywordId}-${e.competitorDomain}-${e.type}-${i}`} event={e} />
            ))}
          </section>

          <Link
            href="/dashboard/chat"
            className="block rounded-2xl bg-primary text-primary-foreground p-6 md:p-8 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="text-xs uppercase tracking-wider opacity-70">Dig deeper</div>
                <p className="mt-3 text-lg leading-snug">
                  Ask the chat <em>"Why did [competitor] jump 10 positions on [keyword] this
                  week?"</em> — it has access to the SERP snapshot, GSC data, and your history
                  to reason about it.
                </p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 mt-1" strokeWidth={1.5} />
            </div>
          </Link>
        </>
      )}
    </div>
  );
}

function EventCard({ event }: { event: CompetitorEvent }) {
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  return (
    <div className="rounded-2xl bg-secondary p-5 md:p-6 flex items-start gap-4">
      <div
        className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${config.iconBg}`}
      >
        <Icon className={`h-5 w-5 ${config.iconColor}`} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-block text-[10px] uppercase font-semibold px-2.5 py-1 rounded-full ${config.pillClass}`}
          >
            {config.label}
          </span>
          <span className="font-mono tabular text-xs text-muted-foreground">
            {event.competitorDomain}
          </span>
          <span className="text-xs text-muted-foreground">· {event.date}</span>
        </div>
        <h3 className="font-display text-lg md:text-xl mt-2 break-words">{event.keyword}</h3>
        <div className="mt-3 flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
          <PositionBadge position={event.fromPosition} />
          <span>→</span>
          <PositionBadge position={event.toPosition} highlight />
          {event.type === "url_swap" && event.toUrl && event.fromUrl && (
            <span className="text-xs font-mono tabular">
              pivoted URL
            </span>
          )}
        </div>
        {event.toUrl && (
          <a
            href={event.toUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono tabular text-muted-foreground hover:text-foreground hover:underline truncate max-w-full"
            title={event.toUrl}
          >
            <span className="truncate">{safePath(event.toUrl)}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-50" strokeWidth={1.5} />
          </a>
        )}
      </div>
    </div>
  );
}

function PositionBadge({
  position,
  highlight,
}: {
  position: number | null;
  highlight?: boolean;
}) {
  if (position == null) {
    return <span className="text-xs font-mono tabular text-muted-foreground">not in top 100</span>;
  }
  return (
    <span
      className={`inline-block text-sm font-mono tabular px-2.5 py-1 rounded-full ${
        highlight
          ? "bg-foreground/10 text-foreground font-semibold"
          : "bg-muted text-muted-foreground"
      }`}
    >
      #{position}
    </span>
  );
}

function StatTile({
  label,
  value,
  subtitle,
  muted,
  accent,
}: {
  label: string;
  value: string;
  subtitle?: string;
  muted?: boolean;
  accent?: "up" | "down";
}) {
  const valueColor = muted
    ? "text-muted-foreground"
    : accent === "down"
      ? "text-[var(--down)]"
      : accent === "up"
        ? "text-[var(--up)]"
        : "text-foreground";
  return (
    <div className="rounded-2xl bg-secondary p-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-4 font-display text-3xl md:text-4xl ${valueColor} truncate`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-muted-foreground mt-2 font-mono tabular">{subtitle}</div>
      )}
    </div>
  );
}

function safePath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
}

const EVENT_CONFIG: Record<
  CompetitorEvent["type"],
  {
    label: string;
    icon: typeof ArrowUp;
    iconBg: string;
    iconColor: string;
    pillClass: string;
  }
> = {
  big_up: {
    label: "Big move up",
    icon: TrendingUp,
    iconBg: "bg-[var(--up)]/15",
    iconColor: "text-[var(--up)]",
    pillClass: "bg-[var(--up)]/15 text-[var(--up)]",
  },
  big_down: {
    label: "Big drop",
    icon: TrendingDown,
    iconBg: "bg-[var(--down)]/15",
    iconColor: "text-[var(--down)]",
    pillClass: "bg-[var(--down)]/15 text-[var(--down)]",
  },
  new_entry: {
    label: "New entry",
    icon: ArrowUp,
    iconBg: "bg-[var(--up)]/15",
    iconColor: "text-[var(--up)]",
    pillClass: "bg-[var(--up)]/15 text-[var(--up)]",
  },
  lost: {
    label: "Lost rank",
    icon: ArrowDown,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    pillClass: "bg-muted text-muted-foreground",
  },
  url_swap: {
    label: "URL pivot",
    icon: Repeat,
    iconBg: "bg-foreground/10",
    iconColor: "text-foreground",
    pillClass: "bg-foreground/10 text-foreground",
  },
};
