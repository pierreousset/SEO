import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, tenantDb, schema } from "@/db/client";
import { and, eq, gte, desc } from "drizzle-orm";
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
import { getLocale } from "@/lib/i18n-server";
import { locale, type PageLocale } from "./locale";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 7;

export default async function ActivityPage() {
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);
  const lng = await getLocale();
  const i = locale[lng];

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

  // Audit log — last 50 actions
  const auditRows = await db
    .select({
      id: schema.auditLog.id,
      action: schema.auditLog.action,
      detail: schema.auditLog.detail,
      createdAt: schema.auditLog.createdAt,
      actorEmail: schema.users.email,
    })
    .from(schema.auditLog)
    .innerJoin(schema.users, eq(schema.auditLog.actorId, schema.users.id))
    .where(eq(schema.auditLog.userId, ctx.ownerId))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(50);

  // Headline stats
  const upCount = events.filter((e) => e.type === "big_up" || e.type === "new_entry").length;
  const downCount = events.filter((e) => e.type === "big_down" || e.type === "lost").length;
  const byCompetitor = new Map<string, number>();
  for (const e of events) {
    byCompetitor.set(e.competitorDomain, (byCompetitor.get(e.competitorDomain) ?? 0) + 1);
  }
  const mostActive = [...byCompetitor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 1)[0];

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
            {i.headerKicker(WINDOW_DAYS)}
          </p>
          <h1 className="font-display text-[40px] mt-2">{i.title}</h1>
        </div>
      </header>

      {keywords.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl">
          <p className="text-lg">
            {i.emptyKeywordsTitle}
            <strong> {i.emptyKeywordsTitleEmphasis} </strong>
            {i.emptyKeywordsTitleSuffix}
          </p>
          <Link
            href="/dashboard/keywords"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-85"
          >
            {i.emptyKeywordsCta} <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl">
          <p className="text-lg">
            <strong>{i.emptyEventsTitle}</strong> {i.emptyEventsBody(WINDOW_DAYS)}
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            {i.emptyEventsHint}
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatTile
              label={i.statMovesUp}
              value={upCount.toString()}
              subtitle={i.statMovesUpSubtitle}
              accent="up"
            />
            <StatTile
              label={i.statMovesDown}
              value={downCount.toString()}
              subtitle={i.statMovesDownSubtitle}
              accent="down"
            />
            <StatTile
              label={i.statMostActive}
              value={mostActive?.[0] ?? "—"}
              subtitle={mostActive ? i.statEventCount(mostActive[1]) : i.statNobody}
              muted={!mostActive}
            />
          </section>

          <section className="space-y-3">
            {events.map((e, idx) => (
              <EventCard key={`${e.keywordId}-${e.competitorDomain}-${e.type}-${idx}`} event={e} i={i} />
            ))}
          </section>

          <Link
            href="/dashboard/chat"
            className="block rounded-2xl bg-primary text-primary-foreground p-6 md:p-8 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="font-mono text-[10px] opacity-70">{i.ctaKicker}</div>
                <p className="mt-3 text-lg leading-snug">
                  {i.ctaText}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 mt-1" strokeWidth={1.5} />
            </div>
          </Link>
        </>
      )}

      {/* Audit log timeline */}
      {auditRows.length > 0 && (
        <section className="space-y-0">
          <h2 className="font-display text-xl mb-4">{i.auditLogTitle}</h2>
          <div className="rounded-2xl bg-card overflow-hidden">
            {auditRows.map((row, idx) => (
              <div
                key={row.id}
                className={`flex items-start gap-4 px-5 py-3 ${idx < auditRows.length - 1 ? "border-b border-border" : ""}`}
              >
                <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap tabular-nums pt-0.5">
                  {row.createdAt ? formatAuditDate(row.createdAt) : "—"}
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {row.actorEmail}
                </span>
                <span className="text-sm flex-1">
                  {i.actionLabels[row.action] ?? row.action}
                  {row.detail && (
                    <span className="text-muted-foreground ml-1.5 text-xs font-mono">
                      {formatDetail(row.detail)}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EventCard({ event, i }: { event: CompetitorEvent; i: PageLocale }) {
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  return (
    <div className="rounded-2xl bg-card p-5 md:p-6 flex items-start gap-4">
      <div
        className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${config.iconBg}`}
      >
        <Icon className={`h-5 w-5 ${config.iconColor}`} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-block font-mono text-[10px] px-2.5 py-1 rounded-full ${config.pillClass}`}
          >
            {i.eventLabels[event.type]}
          </span>
          <span className="font-mono tabular text-xs text-muted-foreground">
            {event.competitorDomain}
          </span>
          <span className="text-xs text-muted-foreground">· {event.date}</span>
        </div>
        <h3 className="font-display text-lg md:text-xl mt-2 break-words">{event.keyword}</h3>
        <div className="mt-3 flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
          <PositionBadge position={event.fromPosition} notInTop100Label={i.notInTop100} />
          <span>→</span>
          <PositionBadge position={event.toPosition} highlight notInTop100Label={i.notInTop100} />
          {event.type === "url_swap" && event.toUrl && event.fromUrl && (
            <span className="text-xs font-mono tabular">
              {i.pivotedUrl}
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
  notInTop100Label,
}: {
  position: number | null;
  highlight?: boolean;
  notInTop100Label: string;
}) {
  if (position == null) {
    return <span className="text-xs font-mono tabular text-muted-foreground">{notInTop100Label}</span>;
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
    <div className="rounded-2xl bg-card p-6">
      <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
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

function formatAuditDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDetail(raw: string): string {
  try {
    const obj = JSON.parse(raw);
    const parts: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v != null && v !== "") parts.push(`${k}: ${String(v)}`);
    }
    return parts.join(", ");
  } catch {
    return raw;
  }
}

const EVENT_CONFIG: Record<
  CompetitorEvent["type"],
  {
    icon: typeof ArrowUp;
    iconBg: string;
    iconColor: string;
    pillClass: string;
  }
> = {
  big_up: {
    icon: TrendingUp,
    iconBg: "bg-[var(--up)]/15",
    iconColor: "text-[var(--up)]",
    pillClass: "bg-[var(--up)]/15 text-[var(--up)]",
  },
  big_down: {
    icon: TrendingDown,
    iconBg: "bg-[var(--down)]/15",
    iconColor: "text-[var(--down)]",
    pillClass: "bg-[var(--down)]/15 text-[var(--down)]",
  },
  new_entry: {
    icon: ArrowUp,
    iconBg: "bg-[var(--up)]/15",
    iconColor: "text-[var(--up)]",
    pillClass: "bg-[var(--up)]/15 text-[var(--up)]",
  },
  lost: {
    icon: ArrowDown,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    pillClass: "bg-muted text-muted-foreground",
  },
  url_swap: {
    icon: Repeat,
    iconBg: "bg-foreground/10",
    iconColor: "text-foreground",
    pillClass: "bg-foreground/10 text-foreground",
  },
};
