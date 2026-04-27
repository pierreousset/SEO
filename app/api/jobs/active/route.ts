import { NextResponse } from "next/server";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { and, eq, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// All run tables with queued/running statuses to check.
const RUN_TABLES = [
  { table: schema.fetchRuns, label: "SERP fetch" },
  { table: schema.gscRuns, label: "GSC sync" },
  { table: schema.auditRuns, label: "Site audit" },
  { table: schema.metaCrawlRuns, label: "Meta crawl" },
  { table: schema.briefRuns, label: "AI brief" },
  { table: schema.cannibalizationRuns, label: "Cannibalization" },
  { table: schema.competitorGapRuns, label: "Gap scan" },
  { table: schema.llmVisibilityRuns, label: "AEO check" },
] as const;

export async function GET() {
  let ctx: Awaited<ReturnType<typeof resolveAccountContext>>;
  try {
    ctx = await resolveAccountContext();
  } catch {
    return NextResponse.json({ jobs: [] }, { status: 401 });
  }

  const active: Array<{ label: string; status: string }> = [];

  for (const { table, label } of RUN_TABLES) {
    const [row] = await db
      .select({ status: table.status })
      .from(table)
      .where(
        and(
          eq(table.userId, ctx.ownerId),
          inArray(table.status, ["queued", "running"]),
        ),
      )
      .limit(1);
    if (row) {
      active.push({ label, status: row.status });
    }
  }

  return NextResponse.json({ jobs: active });
}
