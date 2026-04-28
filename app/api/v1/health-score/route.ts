import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { authenticateApiRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await authenticateApiRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [score] = await db
    .select()
    .from(schema.seoScores)
    .where(eq(schema.seoScores.userId, userId))
    .orderBy(desc(schema.seoScores.computedAt))
    .limit(1);

  if (!score) {
    return NextResponse.json({ score: null, message: "No health score computed yet" });
  }

  return NextResponse.json({
    score: score.score,
    breakdown: score.breakdown,
    issues: score.issues,
    computedAt: score.computedAt,
  });
}
