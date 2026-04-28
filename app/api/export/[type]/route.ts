import { NextRequest, NextResponse } from "next/server";
import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb, db, schema } from "@/db/client";
import { eq, desc, and, gte } from "drizzle-orm";
import { computeDiagnostic } from "@/lib/diagnostics";
import { rateLimit } from "@/lib/rate-limit";

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const ctx = await resolveAccountContext();

  const rl = rateLimit(`export:${ctx.ownerId}`, 10, 60_000); // 10 exports per minute
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limited. Max 10 exports per minute." },
      { status: 429 },
    );
  }

  const { type } = await params;

  if (type === "keywords") {
    const t = tenantDb(ctx.ownerId);
    const keywords = await t.selectKeywords();
    const sites = await t.selectSites();
    const siteMap = new Map(sites.map((s) => [s.id, s.domain]));

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 30);
    const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

    const positions = await db
      .select()
      .from(schema.positions)
      .where(and(eq(schema.positions.userId, ctx.ownerId), gte(schema.positions.date, cutoff)));

    const headers = ["keyword", "position", "previous_position", "7d_delta", "intent_stage", "diagnostic", "site"];
    const rows = keywords
      .filter((k) => !k.removedAt)
      .map((k) => {
        const kPos = positions
          .filter((p) => p.keywordId === k.id)
          .sort((a, b) => a.date.localeCompare(b.date));
        const latest = kPos.at(-1);
        const prev = kPos.at(-2);
        const weekAgo = kPos.at(-8);
        const delta7d =
          latest && weekAgo && latest.position && weekAgo.position
            ? weekAgo.position - latest.position
            : null;
        const diagnostic = computeDiagnostic(
          kPos.map((p) => ({ date: p.date, position: p.position })),
        );
        const intentLabels: Record<number, string> = {
          1: "problem-unaware",
          2: "problem-aware",
          3: "solution-aware",
          4: "ready-to-hire",
        };
        return [
          k.query,
          latest?.position ?? null,
          prev?.position ?? null,
          delta7d,
          k.intentStage ? intentLabels[k.intentStage] ?? k.intentStage : null,
          diagnostic,
          siteMap.get(k.siteId) ?? null,
        ];
      });

    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="keywords-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  if (type === "metas") {
    const [latestRun] = await db
      .select()
      .from(schema.metaCrawlRuns)
      .where(eq(schema.metaCrawlRuns.userId, ctx.ownerId))
      .orderBy(desc(schema.metaCrawlRuns.queuedAt))
      .limit(1);

    const pages =
      latestRun?.status === "done"
        ? await db
            .select()
            .from(schema.metaCrawlPages)
            .where(eq(schema.metaCrawlPages.runId, latestRun.id))
        : [];

    const headers = ["url", "title", "title_length", "meta_description", "description_length", "h1", "in_sitemap", "indexable"];
    const rows = pages.map((p) => [
      p.url,
      p.title,
      p.titleLength,
      p.metaDescription,
      p.metaDescriptionLength,
      p.h1,
      p.inSitemap,
      p.indexable,
    ]);

    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="metas-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  if (type === "audit") {
    const [latestRun] = await db
      .select()
      .from(schema.auditRuns)
      .where(eq(schema.auditRuns.userId, ctx.ownerId))
      .orderBy(desc(schema.auditRuns.queuedAt))
      .limit(1);

    const findings = latestRun
      ? await db
          .select()
          .from(schema.auditFindings)
          .where(eq(schema.auditFindings.runId, latestRun.id))
          .orderBy(desc(schema.auditFindings.severity))
      : [];

    const headers = ["url", "category", "severity", "check_key", "message", "detail", "fix"];
    const rows = findings.map((f) => [
      f.url,
      f.category,
      f.severity,
      f.checkKey,
      f.message,
      f.detail,
      f.fix,
    ]);

    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
}
