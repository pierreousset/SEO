import { NextResponse } from "next/server";
import { eq, and, gte, desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { authenticateApiRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await authenticateApiRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const keywordId = url.searchParams.get("keywordId");
  const days = parseInt(url.searchParams.get("days") ?? "30", 10);

  if (!keywordId) {
    return NextResponse.json({ error: "keywordId query param is required" }, { status: 400 });
  }

  // Verify keyword belongs to user
  const [kw] = await db
    .select({ id: schema.keywords.id })
    .from(schema.keywords)
    .where(
      and(
        eq(schema.keywords.id, keywordId),
        eq(schema.keywords.userId, userId),
      ),
    )
    .limit(1);

  if (!kw) {
    return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - Math.min(days, 365));
  const sinceStr = since.toISOString().slice(0, 10);

  const positions = await db
    .select({
      date: schema.positions.date,
      position: schema.positions.position,
      url: schema.positions.url,
    })
    .from(schema.positions)
    .where(
      and(
        eq(schema.positions.keywordId, keywordId),
        eq(schema.positions.userId, userId),
        gte(schema.positions.date, sinceStr),
      ),
    )
    .orderBy(desc(schema.positions.date));

  return NextResponse.json({ keywordId, days, positions });
}
