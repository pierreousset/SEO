import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { tenantDb, db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { GenerateBriefButton } from "@/components/generate-brief-button";
import { BriefStatusBanner } from "@/components/brief-status-banner";

export const dynamic = "force-dynamic";

export default async function BriefPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const t = tenantDb(session.user.id);
  const [latest] = await t.selectLatestBrief();
  const positionsCount = await db
    .select({ c: schema.positions.id })
    .from(schema.positions)
    .where(eq(schema.positions.userId, session.user.id))
    .limit(1);
  const hasData = positionsCount.length > 0;

  const [latestBriefRun] = await db
    .select()
    .from(schema.briefRuns)
    .where(eq(schema.briefRuns.userId, session.user.id))
    .orderBy(desc(schema.briefRuns.queuedAt))
    .limit(1);

  const briefRunBanner = latestBriefRun
    ? {
        id: latestBriefRun.id,
        source: latestBriefRun.source,
        status: latestBriefRun.status as
          | "queued"
          | "running"
          | "done"
          | "failed"
          | "skipped",
        queuedAt: latestBriefRun.queuedAt.toISOString(),
        startedAt: latestBriefRun.startedAt?.toISOString() ?? null,
        finishedAt: latestBriefRun.finishedAt?.toISOString() ?? null,
        error: latestBriefRun.error,
      }
    : null;

  if (!latest) {
    return (
      <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto space-y-8">
        <BriefStatusBanner run={briefRunBanner} />
        <header>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Weekly</p>
          <h1 className="font-display text-5xl md:text-6xl mt-3">Brief</h1>
        </header>
        <div className="rounded-[20px] bg-secondary p-8 md:p-10 max-w-2xl">
          <p className="text-lg text-muted-foreground">
            {hasData
              ? "You have data — generate the first brief now, or wait for Monday 09:00 UTC."
              : "No data yet. Run a SERP fetch first, then generate the brief."}
          </p>
          {hasData && (
            <div className="mt-6">
              <GenerateBriefButton variant="default" />
            </div>
          )}
        </div>
      </div>
    );
  }

  const topMovers = latest.topMovers as Array<{
    keyword: string;
    delta: number;
    probable_cause: string;
    confidence: number;
  }>;
  const tickets = latest.tickets as Array<{
    priority: "high" | "medium" | "low";
    action: string;
    target: string;
    why: string;
    estimated_effort_min: number;
  }>;
  const warnings = (latest.warnings as string[]) ?? [];

  const highPriorityCount = tickets.filter((t) => t.priority === "high").length;

  return (
    <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto space-y-8">
      <BriefStatusBanner run={briefRunBanner} />

      {/* Hero header */}
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono tabular">
            Week of {latest.periodStart} → {latest.periodEnd}
          </p>
          <h1 className="font-display text-5xl md:text-6xl mt-3">Weekly brief</h1>
          <p className="mt-6 text-lg md:text-xl leading-relaxed text-muted-foreground">
            {latest.summary}
          </p>
        </div>
        <div className="shrink-0">
          <GenerateBriefButton label="Regenerate" />
        </div>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile label="Movers analysed" value={topMovers.length.toString()} />
        <StatTile label="Actions queued" value={tickets.length.toString()} />
        <StatTile
          label="High priority"
          value={highPriorityCount.toString()}
          muted={highPriorityCount === 0}
        />
      </section>

      {/* Main grid: 2/3 actions + 1/3 movers */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actions — primary column */}
        <div className="lg:col-span-2">
          <div className="rounded-[20px] bg-secondary p-6 md:p-8">
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                This week
              </div>
              <h2 className="font-display text-2xl md:text-3xl mt-2">Actions</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {tickets.length} ticket{tickets.length > 1 ? "s" : ""} generated from the movers
                above.
              </p>
            </div>
            <div className="space-y-2">
              {tickets.map((ticket, i) => (
                <div key={i} className="rounded-[12px] bg-background p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 accent-foreground"
                      aria-label={`Mark ticket as done: ${ticket.action}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PriorityPill priority={ticket.priority} />
                        <span className="text-sm font-medium">{ticket.action}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 font-mono tabular">
                        {ticket.target} · ~{ticket.estimated_effort_min}min
                      </div>
                      <div className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        {ticket.why}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Movers — side column */}
        <div className="space-y-6">
          <div className="rounded-[20px] bg-secondary p-6 md:p-8">
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                This week
              </div>
              <h2 className="font-display text-2xl md:text-3xl mt-2">Top movers</h2>
            </div>
            <div className="space-y-2">
              {topMovers.map((m) => (
                <div
                  key={m.keyword}
                  className="rounded-[12px] bg-background p-3 flex items-start gap-3"
                >
                  <div
                    className={`font-mono tabular text-sm w-12 text-right shrink-0 ${
                      m.delta > 0
                        ? "text-[var(--up)]"
                        : m.delta < 0
                          ? "text-[var(--down)]"
                          : "text-muted-foreground"
                    }`}
                  >
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate" title={m.keyword}>
                      {m.keyword}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 leading-snug">
                      {m.probable_cause}
                    </div>
                  </div>
                  {m.confidence < 0.5 && (
                    <Badge variant="outline" className="shrink-0 text-[10px] rounded-full">
                      hypothèse
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-[20px] border border-[var(--down)]/30 bg-[var(--down)]/5 p-6">
              <h2 className="text-xs uppercase tracking-wider text-[var(--down)] mb-3">
                Warnings
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-[20px] bg-secondary p-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-4 font-display text-4xl md:text-5xl ${
          muted ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function PriorityPill({ priority }: { priority: "high" | "medium" | "low" }) {
  const map = {
    high: "bg-[var(--down)]/15 text-[var(--down)]",
    medium: "bg-foreground/10 text-foreground",
    low: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-block text-[10px] uppercase font-medium px-2.5 py-1 rounded-full ${map[priority]}`}
    >
      {priority}
    </span>
  );
}
