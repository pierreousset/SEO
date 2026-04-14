"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { tenantDb, db, schema } from "@/db/client";
import { inngest } from "@/lib/inngest/client";
import { classifyIntentRule, classifyKeywords } from "@/lib/llm/intent-classifier";

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("unauthorized");
  return session;
}

export async function addKeyword(formData: FormData) {
  const session = await requireSession();
  const t = tenantDb(session.user.id);
  const query = String(formData.get("query") ?? "").trim();
  if (!query) return { error: "Query is required" };

  const sites = await t.selectSites();
  if (sites.length === 0) {
    return { error: "Connect Google Search Console first to register a site." };
  }
  const siteId = sites[0].id;

  // Cheap rule-based intent classification at insert time. LLM fallback would slow
  // form submission, so we only classify with rules here; null stays null.
  const profile = await t.selectBusinessProfile();
  const intentStage = classifyIntentRule(query, profile?.targetCities ?? []);

  try {
    await t.insertKeyword({
      id: randomUUID(),
      siteId,
      query,
      country: "fr",
      device: "desktop",
      intentStage,
    });
  } catch (e: any) {
    if (e?.message?.includes("duplicate") || e?.code === "23505") {
      return { error: "Already tracking this keyword." };
    }
    throw e;
  }
  revalidatePath("/dashboard/keywords");
  return { ok: true };
}

/** One-off backfill: classify all keywords that don't have an intentStage yet. */
export async function classifyUnclassifiedKeywords() {
  const session = await requireSession();
  const t = tenantDb(session.user.id);
  const profile = await t.selectBusinessProfile();
  const cities = profile?.targetCities ?? [];

  const rows = await db
    .select()
    .from(schema.keywords)
    .where(
      and(eq(schema.keywords.userId, session.user.id), isNull(schema.keywords.intentStage)),
    );

  if (rows.length === 0) return { ok: true, classified: 0 };

  const classifications = await classifyKeywords(
    rows.map((r) => r.query),
    cities,
  );

  let count = 0;
  for (const r of rows) {
    const stage = classifications[r.query];
    if (stage == null) continue;
    await db
      .update(schema.keywords)
      .set({ intentStage: stage })
      .where(eq(schema.keywords.id, r.id));
    count++;
  }
  revalidatePath("/dashboard/keywords");
  return { ok: true, classified: count };
}

export async function removeKeyword(keywordId: string) {
  const session = await requireSession();
  await db
    .update(schema.keywords)
    .set({ removedAt: new Date() })
    .where(and(eq(schema.keywords.id, keywordId), eq(schema.keywords.userId, session.user.id)));
  revalidatePath("/dashboard/keywords");
}

export async function triggerGscHistoryPull(days = 90) {
  const session = await requireSession();
  const runId = randomUUID();

  await db.insert(schema.gscRuns).values({
    id: runId,
    userId: session.user.id,
    source: "manual",
    status: "queued",
    daysRequested: days,
  });

  await inngest.send({
    name: "gsc/history.pull",
    data: { userId: session.user.id, runId, days },
  });
  revalidatePath("/dashboard");
  return { ok: true, runId };
}

export async function triggerBriefNow() {
  const session = await requireSession();
  const runId = randomUUID();

  await db.insert(schema.briefRuns).values({
    id: runId,
    userId: session.user.id,
    source: "manual",
    status: "queued",
  });

  await inngest.send({
    name: "brief/generate.weekly",
    data: { userId: session.user.id, runId },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/brief");
  return { ok: true, runId };
}

export async function triggerFetchNow() {
  const session = await requireSession();
  const runId = randomUUID();

  // Persist a queued run so the dashboard can show progress.
  await db.insert(schema.fetchRuns).values({
    id: runId,
    userId: session.user.id,
    source: "manual",
    status: "queued",
  });

  await inngest.send({
    name: "serp/fetch.daily",
    data: { userId: session.user.id, runId },
  });
  revalidatePath("/dashboard");
  return { ok: true, runId };
}
