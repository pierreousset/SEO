import { NextResponse } from "next/server";
import { eq, desc, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { authenticateApiRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await authenticateApiRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keywords = await db
    .select({
      id: schema.keywords.id,
      query: schema.keywords.query,
      country: schema.keywords.country,
      device: schema.keywords.device,
      intentStage: schema.keywords.intentStage,
      siteId: schema.keywords.siteId,
      createdAt: schema.keywords.createdAt,
    })
    .from(schema.keywords)
    .where(
      eq(schema.keywords.userId, userId),
    );

  // For each keyword, get latest position
  const result = await Promise.all(
    keywords
      .filter((k) => !k.createdAt || true) // all active
      .map(async (kw) => {
        const [latest] = await db
          .select({
            position: schema.positions.position,
            url: schema.positions.url,
            date: schema.positions.date,
          })
          .from(schema.positions)
          .where(eq(schema.positions.keywordId, kw.id))
          .orderBy(desc(schema.positions.date))
          .limit(1);

        return {
          id: kw.id,
          query: kw.query,
          country: kw.country,
          device: kw.device,
          intentStage: kw.intentStage,
          siteId: kw.siteId,
          latestPosition: latest?.position ?? null,
          latestUrl: latest?.url ?? null,
          latestDate: latest?.date ?? null,
        };
      }),
  );

  return NextResponse.json({ keywords: result });
}
