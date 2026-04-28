import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb, db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function BriefPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);

  let brief: typeof schema.briefs.$inferSelect | undefined;

  if (params.id) {
    const [row] = await db
      .select()
      .from(schema.briefs)
      .where(eq(schema.briefs.id, params.id))
      .limit(1);
    // Ensure the brief belongs to the current user
    if (row && row.userId === ctx.ownerId) {
      brief = row;
    }
  } else {
    const [row] = await t.selectLatestBrief();
    brief = row;
  }

  if (!brief) {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", padding: "4rem", textAlign: "center" }}>
        <p>No brief found.</p>
      </div>
    );
  }

  const [profile] = await db
    .select()
    .from(schema.businessProfiles)
    .where(eq(schema.businessProfiles.userId, ctx.ownerId))
    .limit(1);

  const businessName = profile?.businessName ?? "Your Business";

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

  const priorityColor = (p: string) => {
    if (p === "high") return "#dc2626";
    if (p === "medium") return "#ea580c";
    return "#6b7280";
  };

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- standalone print page */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { margin: 2cm; }
            @media print { .no-print { display: none !important; } }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body {
              color: #1a1a1a !important;
              background: #fff !important;
            }
            body {
              font-family: "Geist", system-ui, -apple-system, sans-serif;
              max-width: 700px;
              margin: 0 auto !important;
              padding: 2rem 1.5rem !important;
              font-size: 14px;
              line-height: 1.6;
              display: block !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-btn {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 8px 20px;
              border: 1.5px solid #d4d4d8;
              border-radius: 9999px;
              background: #fff;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              margin-bottom: 2rem;
              transition: background 0.15s;
            }
            .print-btn:hover { background: #f4f4f5; }
            .header { margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #e4e4e7; }
            .header .biz-name { font-size: 13px; color: #71717a; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
            .header h1 { font-size: 24px; font-weight: 600; margin-top: 6px; }
            .header .period { font-size: 13px; color: #71717a; margin-top: 4px; font-variant-numeric: tabular-nums; }
            .section { margin-bottom: 2rem; }
            .section h2 { font-size: 18px; font-weight: 600; margin-bottom: 0.75rem; }
            .section p { color: #3f3f46; }
            ul { padding-left: 1.25rem; }
            ul li { margin-bottom: 0.5rem; color: #3f3f46; }
            .warning-list li { color: #dc2626; }
            .action-item { padding: 0.75rem 0; border-bottom: 1px solid #f4f4f5; }
            .action-item:last-child { border-bottom: none; }
            .action-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
            .priority-badge {
              display: inline-block;
              font-size: 10px;
              text-transform: uppercase;
              font-weight: 600;
              padding: 2px 8px;
              border-radius: 9999px;
              letter-spacing: 0.5px;
            }
            .action-title { font-weight: 500; font-size: 14px; }
            .action-meta { font-size: 12px; color: #71717a; margin-top: 4px; font-variant-numeric: tabular-nums; }
            .action-why { font-size: 13px; color: #52525b; margin-top: 4px; }
            .mover-item { padding: 0.5rem 0; display: flex; gap: 12px; align-items: flex-start; }
            .mover-delta { font-variant-numeric: tabular-nums; font-size: 13px; min-width: 40px; text-align: right; font-weight: 600; }
            .mover-delta.up { color: #16a34a; }
            .mover-delta.down { color: #dc2626; }
            .mover-keyword { font-weight: 500; font-size: 14px; }
            .mover-cause { font-size: 12px; color: #71717a; margin-top: 2px; }
            .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e4e4e7; font-size: 11px; color: #a1a1aa; }
          `,
        }}
      />

      <PrintButton />

      <div className="header">
        <div className="biz-name">{businessName}</div>
        <h1>Weekly SEO Brief</h1>
        <div className="period">{brief.periodStart} &mdash; {brief.periodEnd}</div>
      </div>

      {/* Summary */}
      <div className="section">
        <h2>Summary</h2>
        <p>{brief.summary}</p>
      </div>

      {/* Top Movers */}
      {topMovers.length > 0 && (
        <div className="section">
          <h2>Top Movers</h2>
          {topMovers.map((m) => (
            <div key={m.keyword} className="mover-item">
              <div className={`mover-delta ${m.delta > 0 ? "up" : m.delta < 0 ? "down" : ""}`}>
                {m.delta > 0 ? `+${m.delta}` : m.delta}
              </div>
              <div>
                <div className="mover-keyword">{m.keyword}</div>
                <div className="mover-cause">{m.probable_cause}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="section">
          <h2>Warnings</h2>
          <ul className="warning-list">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {tickets.length > 0 && (
        <div className="section">
          <h2>Actions</h2>
          {tickets.map((ticket, i) => (
            <div key={i} className="action-item">
              <div className="action-header">
                <span
                  className="priority-badge"
                  style={{
                    color: priorityColor(ticket.priority),
                    backgroundColor: `${priorityColor(ticket.priority)}15`,
                  }}
                >
                  {ticket.priority}
                </span>
                <span className="action-title">{ticket.action}</span>
              </div>
              <div className="action-meta">
                {ticket.target} &middot; ~{ticket.estimated_effort_min}min
              </div>
              <div className="action-why">{ticket.why}</div>
            </div>
          ))}
        </div>
      )}

      <div className="footer">
        Generated {brief.generatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      </div>
    </>
  );
}
