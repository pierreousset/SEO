import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export default async function SharePage({ params }: Props) {
  const { token } = await params;

  const [link] = await db
    .select()
    .from(schema.shareLinks)
    .where(eq(schema.shareLinks.token, token))
    .limit(1);

  if (!link || link.expiresAt < new Date()) {
    notFound();
  }

  if (link.resourceType === "brief") {
    return <SharedBrief resourceId={link.resourceId} expiresAt={link.expiresAt} />;
  }

  if (link.resourceType === "audit") {
    return <SharedAudit resourceId={link.resourceId} expiresAt={link.expiresAt} />;
  }

  notFound();
}

// ---------------------------------------------------------------------------
// Brief view
// ---------------------------------------------------------------------------
async function SharedBrief({
  resourceId,
  expiresAt,
}: {
  resourceId: string;
  expiresAt: Date;
}) {
  const [brief] = await db
    .select()
    .from(schema.briefs)
    .where(eq(schema.briefs.id, resourceId))
    .limit(1);

  if (!brief) notFound();

  const topMovers = brief.topMovers as Array<{
    keyword: string;
    delta: number;
    probable_cause: string;
    confidence: number;
  }>;
  const tickets = brief.tickets as Array<{
    priority: "high" | "medium" | "low";
    action: string;
    target: string;
    why: string;
    estimated_effort_min: number;
  }>;
  const warnings = (brief.warnings as string[]) ?? [];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <ShareBanner expiresAt={expiresAt} />
      <div className="mx-auto max-w-[900px] px-6 py-10 space-y-8">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-neutral-400 font-mono">
            Week of {brief.periodStart} → {brief.periodEnd}
          </p>
          <h1 className="font-display text-[36px] mt-3">Weekly brief</h1>
          <p className="mt-6 text-lg leading-relaxed text-neutral-400">
            {brief.summary}
          </p>
        </header>

        {/* Actions */}
        {tickets.length > 0 && (
          <section className="rounded-2xl bg-[#1A1A1A] p-6 md:p-8">
            <div className="text-xs uppercase tracking-wider text-neutral-400">This week</div>
            <h2 className="font-display text-2xl mt-2">Actions</h2>
            <div className="mt-6 space-y-2">
              {tickets.map((ticket, i) => (
                <div key={i} className="rounded-[12px] bg-[#0A0A0A] p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PriorityPill priority={ticket.priority} />
                    <span className="text-sm font-medium">{ticket.action}</span>
                  </div>
                  <div className="text-xs text-neutral-400 mt-2 font-mono tabular-nums">
                    {ticket.target} · ~{ticket.estimated_effort_min}min
                  </div>
                  <div className="text-sm text-neutral-400 mt-2 leading-relaxed">
                    {ticket.why}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Movers */}
        {topMovers.length > 0 && (
          <section className="rounded-2xl bg-[#1A1A1A] p-6 md:p-8">
            <div className="text-xs uppercase tracking-wider text-neutral-400">This week</div>
            <h2 className="font-display text-2xl mt-2">Top movers</h2>
            <div className="mt-6 space-y-2">
              {topMovers.map((m) => (
                <div
                  key={m.keyword}
                  className="rounded-[12px] bg-[#0A0A0A] p-3 flex items-start gap-3"
                >
                  <div
                    className={`font-mono tabular-nums text-sm w-12 text-right shrink-0 ${
                      m.delta > 0
                        ? "text-emerald-400"
                        : m.delta < 0
                          ? "text-red-400"
                          : "text-neutral-400"
                    }`}
                  >
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{m.keyword}</div>
                    <div className="text-xs text-neutral-400 mt-1 leading-snug">
                      {m.probable_cause}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
            <h2 className="text-xs uppercase tracking-wider text-red-400 mb-3">Warnings</h2>
            <ul className="space-y-2 text-sm text-neutral-400 list-disc pl-5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit view
// ---------------------------------------------------------------------------
const SEVERITY_TONE: Record<string, string> = {
  high: "bg-red-500/10 text-red-400",
  medium: "bg-yellow-500/10 text-yellow-300",
  low: "bg-neutral-800 text-neutral-400",
  info: "bg-purple-500/10 text-purple-400",
};

async function SharedAudit({
  resourceId,
  expiresAt,
}: {
  resourceId: string;
  expiresAt: Date;
}) {
  const [run] = await db
    .select()
    .from(schema.auditRuns)
    .where(eq(schema.auditRuns.id, resourceId))
    .limit(1);

  if (!run) notFound();

  const findings = await db
    .select()
    .from(schema.auditFindings)
    .where(eq(schema.auditFindings.runId, run.id))
    .orderBy(desc(schema.auditFindings.severity));

  // Group by URL
  const byUrl = new Map<string, typeof findings>();
  for (const f of findings) {
    if (!byUrl.has(f.url)) byUrl.set(f.url, []);
    byUrl.get(f.url)!.push(f);
  }

  let synthesis: {
    summary: string;
    top_actions: Array<{
      priority: "high" | "medium" | "low";
      action: string;
      target_url: string | null;
      why: string;
      estimated_effort_min: number;
    }>;
  } | null = null;

  if (run.aiSummary) {
    try {
      synthesis = JSON.parse(run.aiSummary);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <ShareBanner expiresAt={expiresAt} />
      <div className="mx-auto max-w-[900px] px-6 py-10 space-y-8">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-neutral-400">
            Site audit
          </p>
          <h1 className="font-display text-[36px] mt-3">Audit</h1>
          {run.finishedAt && (
            <p className="mt-2 text-sm text-neutral-400 font-mono tabular-nums">
              {run.pagesCrawled ?? 0} pages crawled · {run.findingsCount ?? 0} findings ·{" "}
              {run.highSeverityCount ?? 0} high severity
            </p>
          )}
        </header>

        {/* AI synthesis */}
        {synthesis && (
          <section className="rounded-2xl bg-[#1A1A1A] p-6 md:p-8">
            <div className="font-mono text-[10px] text-neutral-400">ai synthesis</div>
            <h2 className="font-display text-2xl mt-2">Top actions</h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-300">{synthesis.summary}</p>
            <div className="mt-6 space-y-2">
              {synthesis.top_actions.map((a, i) => (
                <div key={i} className="rounded-[12px] bg-[#0A0A0A] p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <AuditPriorityPill priority={a.priority} />
                    <span className="text-sm font-medium">{a.action}</span>
                  </div>
                  <div className="text-xs text-neutral-400 mt-2 font-mono tabular-nums">
                    {a.target_url ?? "site-wide"} · ~{a.estimated_effort_min}min
                  </div>
                  <div className="text-sm text-neutral-400 mt-2 leading-relaxed">{a.why}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Findings grouped by URL */}
        {findings.length > 0 && (
          <section>
            <h2 className="font-mono text-[10px] text-neutral-400 mb-3">
              all findings ({findings.length})
            </h2>
            <div className="space-y-4">
              {Array.from(byUrl.entries()).map(([url, items]) => (
                <div key={url} className="rounded-2xl bg-[#1A1A1A] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#2A2A2A] flex items-center justify-between gap-4 flex-wrap">
                    <div className="font-mono tabular-nums text-xs text-neutral-400 truncate flex-1 min-w-0">
                      {url}
                    </div>
                    <div className="text-xs text-neutral-400 shrink-0">
                      {items.length} finding{items.length > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="divide-y divide-[#2A2A2A]">
                    {items.map((f) => (
                      <div key={f.id} className="px-5 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-block font-mono text-[10px] px-2.5 py-1 rounded-full ${SEVERITY_TONE[f.severity]}`}
                          >
                            {f.severity}
                          </span>
                          <Badge variant="outline" className="text-[10px] uppercase rounded-full">
                            {f.category}
                          </Badge>
                          <span className="text-sm font-medium">{f.message}</span>
                        </div>
                        {f.detail && (
                          <div className="text-xs text-neutral-400 mt-1 font-mono tabular-nums">
                            {f.detail}
                          </div>
                        )}
                        {f.fix && (
                          <div className="text-sm text-neutral-400 mt-2 leading-relaxed">
                            {f.fix}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------
function ShareBanner({ expiresAt }: { expiresAt: Date }) {
  return (
    <div className="border-b border-[#2A2A2A] bg-[#1A1A1A]">
      <div className="mx-auto max-w-[900px] px-6 py-3 flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-300">
          Shared via SEO Dashboard
        </span>
        <span className="text-xs text-neutral-500 font-mono tabular-nums">
          Expires {expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}

function PriorityPill({ priority }: { priority: "high" | "medium" | "low" }) {
  const map: Record<string, string> = {
    high: "bg-red-500/15 text-red-400",
    medium: "bg-neutral-700/50 text-neutral-200",
    low: "bg-neutral-800 text-neutral-400",
  };
  return (
    <span className={`inline-block text-[10px] uppercase font-medium px-2.5 py-1 rounded-full ${map[priority]}`}>
      {priority}
    </span>
  );
}

function AuditPriorityPill({ priority }: { priority: "high" | "medium" | "low" }) {
  const cls =
    priority === "high"
      ? "bg-red-500 text-white"
      : priority === "medium"
        ? "bg-yellow-500 text-black"
        : "bg-neutral-700 text-neutral-300";
  return (
    <span className={`inline-block font-mono text-[10px] px-2.5 py-1 rounded-full ${cls}`}>
      {priority}
    </span>
  );
}
