import { inngest } from "./client";
import { db, tenantDb, schema } from "@/db/client";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { postSerpTasks, fetchTaskResultMulti, urlToDomain } from "@/lib/dataforseo";
import { fetchGscHistoryByQuery, fetchGscSiteTotals, fetchGscPagesByDate } from "@/lib/google-oauth";
import { decrypt } from "@/lib/encryption";
import { fetchPage, fetchPagesRendered, discoverUrls } from "@/lib/audit/crawler";
import { runPageChecks, runSiteWideChecks } from "@/lib/audit/checks";
import { synthesizeAudit } from "@/lib/llm/audit-synthesis";
import { sendWeeklyBriefEmail } from "@/lib/email/weekly-brief";
import { getUserPlan } from "@/lib/billing-helpers";
import { getCreditsBalance, debitCredits } from "@/lib/credits";
import { CREDIT_COSTS } from "@/lib/billing-constants";
import { generateBrief } from "@/lib/llm/brief";
import { checkAndFireAlerts } from "@/lib/alerts/check-alerts";
import { randomUUID } from "node:crypto";

// -------------------------------------------------------------------
// Daily SERP fetch — triggered by cron at 06:00 UTC, fans out per-user.
// -------------------------------------------------------------------
export const dailyFetchScheduler = inngest.createFunction(
  { id: "serp-daily-scheduler", triggers: [{ cron: "0 6 * * *" }] },
  async ({ step }) => {
    if (process.env.INNGEST_DEV === "1" || process.env.NODE_ENV !== "production") {
      return { skipped: "dev_mode" };
    }
    const users = await step.run("list-active-users", async () =>
      db.selectDistinct({ userId: schema.keywords.userId }).from(schema.keywords),
    );
    for (const u of users) {
      await step.sendEvent("fanout", {
        name: "serp/fetch.daily",
        data: { userId: u.userId },
      });
    }
    return { fannedOut: users.length };
  },
);

// -------------------------------------------------------------------
// Per-user daily SERP fetch.
// -------------------------------------------------------------------
export const userDailyFetch = inngest.createFunction(
  {
    id: "serp-user-daily-fetch",
    concurrency: { limit: 5 },
    triggers: [{ event: "serp/fetch.daily" }],
  },
  async ({ event, step }) => {
    const userId = event.data.userId;
    if (!userId) throw new Error("userId required");
    const t = tenantDb(userId);

    // Resolve or create the run row this function is processing.
    // Cron events have no runId — create one inline so cron runs are also tracked.
    let runId = event.data.runId as string | undefined;
    if (!runId) {
      runId = randomUUID();
      await step.run("create-cron-run", async () =>
        db.insert(schema.fetchRuns).values({
          id: runId!,
          userId,
          source: "cron",
          status: "queued",
        }),
      );
    }

    await step.run("mark-running", async () =>
      db
        .update(schema.fetchRuns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(schema.fetchRuns.id, runId!)),
    );

    try {
      const sites = await step.run("load-sites", () => t.selectSites());
      const keywords = await step.run("load-keywords", () => t.selectKeywords());

      if (sites.length === 0 || keywords.length === 0) {
        await step.run("mark-skipped", async () =>
          db
            .update(schema.fetchRuns)
            .set({
              status: "skipped",
              finishedAt: new Date(),
              error: "no sites or keywords",
            })
            .where(eq(schema.fetchRuns.id, runId!)),
        );
        return { skipped: true };
      }

      // Group keywords by site (one task batch per site/domain)
      const bySite = new Map<string, typeof keywords>();
      for (const k of keywords) {
        if (!bySite.has(k.siteId)) bySite.set(k.siteId, []);
        bySite.get(k.siteId)!.push(k);
      }

      const date = new Date().toISOString().slice(0, 10);
      const allTaskIds: string[] = [];

      for (const [siteId, kws] of bySite.entries()) {
        const site = sites.find((s) => s.id === siteId);
        if (!site) continue;

        const taskIds = await step.run(`post-${siteId}`, () =>
          postSerpTasks(
            kws.map((k) => ({
              keyword: k.query,
              language_code: k.country,
              device: k.device as "desktop" | "mobile",
            })),
            site.domain,
          ),
        );
        allTaskIds.push(...taskIds);
      }

      await step.run("update-task-count", async () =>
        db
          .update(schema.fetchRuns)
          .set({ taskCount: allTaskIds.length })
          .where(eq(schema.fetchRuns.id, runId!)),
      );

      // Wait 2 minutes for DataForSEO queue, then fetch. Standard tier is ~1-5 min typically.
      await step.sleep("wait-for-queue", "2m");

      // Load competitor domains once so we extract their positions from the same SERPs (free).
      const profile = await step.run("load-profile-for-fetch", () => t.selectBusinessProfile());
      const competitorDomains = (profile?.competitorUrls ?? []).map(urlToDomain);

      let saved = 0;
      for (const tid of allTaskIds) {
        const site = sites[0]; // naive: assume 1 site for now (B1)
        const ownDomain = site.domain.replace(/^www\./, "").toLowerCase();
        const lookups = [ownDomain, ...competitorDomains];
        const r = await step.run(`fetch-${tid}`, () => fetchTaskResultMulti(tid, lookups));
        if (!r) continue;

        const k = keywords.find((kw) => kw.query === r.keyword);
        if (!k) continue;

        const own = r.byDomain[ownDomain];
        await step.run(`save-${tid}`, async () =>
          db
            .insert(schema.positions)
            .values({
              id: randomUUID(),
              userId,
              keywordId: k.id,
              date,
              position: own?.position ?? null,
              url: own?.url ?? null,
            })
            .onConflictDoUpdate({
              target: [schema.positions.keywordId, schema.positions.date],
              set: { position: own?.position ?? null, url: own?.url ?? null, fetchedAt: new Date() },
            }),
        );

        // Persist competitor positions from the same SERP — no extra API cost.
        for (const cdom of competitorDomains) {
          const cp = r.byDomain[cdom];
          if (!cp) continue;
          await step.run(`save-comp-${tid}-${cdom}`, async () =>
            db
              .insert(schema.competitorPositions)
              .values({
                id: randomUUID(),
                userId,
                keywordId: k.id,
                competitorDomain: cdom,
                date,
                position: cp.position,
                url: cp.url,
              })
              .onConflictDoUpdate({
                target: [
                  schema.competitorPositions.keywordId,
                  schema.competitorPositions.competitorDomain,
                  schema.competitorPositions.date,
                ],
                set: { position: cp.position, url: cp.url, fetchedAt: new Date() },
              }),
          );
        }
        saved++;
      }

      // Check position alerts after all positions are saved
      const alertResult = await step.run("check-position-alerts", () =>
        checkAndFireAlerts(userId),
      );

      // Recompute SEO health score after positions are saved
      const scoreResult = await step.run("recompute-seo-score", async () => {
        const { recomputeSeoScore } = await import("@/lib/seo-score-recompute");
        return recomputeSeoScore(userId);
      });

      await step.run("mark-done", async () =>
        db
          .update(schema.fetchRuns)
          .set({
            status: "done",
            finishedAt: new Date(),
            resultCount: saved,
          })
          .where(eq(schema.fetchRuns.id, runId!)),
      );

      return { processed: allTaskIds.length, saved, date, alerts: alertResult, score: scoreResult?.score };
    } catch (err: any) {
      await step.run("mark-failed", async () =>
        db
          .update(schema.fetchRuns)
          .set({
            status: "failed",
            finishedAt: new Date(),
            error: String(err?.message ?? err).slice(0, 500),
          })
          .where(eq(schema.fetchRuns.id, runId!)),
      );
      throw err;
    }
  },
);

// -------------------------------------------------------------------
// Weekly AI brief — Monday 09:00 UTC, per user.
// -------------------------------------------------------------------
export const weeklyBriefScheduler = inngest.createFunction(
  { id: "brief-weekly-scheduler", triggers: [{ cron: "0 9 * * 1" }] },
  async ({ step }) => {
    const users = await step.run("list", async () =>
      db.selectDistinct({ userId: schema.keywords.userId }).from(schema.keywords),
    );
    for (const u of users) {
      await step.sendEvent("fanout", {
        name: "brief/generate.weekly",
        data: { userId: u.userId },
      });
    }
    return { fannedOut: users.length };
  },
);

export const weeklyBrief = inngest.createFunction(
  {
    id: "brief-weekly-generate",
    concurrency: { limit: 3 },
    triggers: [{ event: "brief/generate.weekly" }],
  },
  async ({ event, step }) => {
    const userId = event.data.userId;
    const t = tenantDb(userId);

    let runId = event.data.runId as string | undefined;
    if (!runId) {
      runId = randomUUID();
      await step.run("create-cron-run", async () =>
        db.insert(schema.briefRuns).values({
          id: runId!,
          userId,
          source: "cron",
          status: "queued",
        }),
      );
    }

    await step.run("mark-running", async () =>
      db
        .update(schema.briefRuns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(schema.briefRuns.id, runId!)),
    );

    try {
      const periodEnd = new Date();
      periodEnd.setUTCHours(0, 0, 0, 0);
      const periodStart = new Date(periodEnd);
      periodStart.setUTCDate(periodStart.getUTCDate() - 7);

      const ps = periodStart.toISOString().slice(0, 10);
      const pe = periodEnd.toISOString().slice(0, 10);

      const keywords = await step.run("load-keywords", () => t.selectKeywords());
      const positions = await step.run("load-positions", async () =>
        db
          .select()
          .from(schema.positions)
          .where(
            and(
              eq(schema.positions.userId, userId),
              gte(schema.positions.date, ps),
              lte(schema.positions.date, pe),
            ),
          ),
      );

      if (keywords.length === 0 || positions.length === 0) {
        await step.run("mark-skipped", async () =>
          db
            .update(schema.briefRuns)
            .set({
              status: "skipped",
              finishedAt: new Date(),
              error: "no keywords or no positions in period",
            })
            .where(eq(schema.briefRuns.id, runId!)),
        );
        return { skipped: true, reason: "no data" };
      }

      // GSC window: pull a wider window than the brief period so the LLM has
      // recent CTR/impressions context (last 30 days), not just the 7-day brief slice.
      const gscFrom = new Date(periodEnd);
      gscFrom.setUTCDate(gscFrom.getUTCDate() - 30);
      const gscFromStr = gscFrom.toISOString().slice(0, 10);

      const [profile, competitorPositions, gscRows] = await Promise.all([
        step.run("load-profile", () => t.selectBusinessProfile()),
        step.run("load-competitor-positions", async () =>
          db
            .select()
            .from(schema.competitorPositions)
            .where(
              and(
                eq(schema.competitorPositions.userId, userId),
                gte(schema.competitorPositions.date, ps),
                lte(schema.competitorPositions.date, pe),
              ),
            ),
        ),
        step.run("load-gsc-metrics", async () =>
          db
            .select()
            .from(schema.gscMetrics)
            .where(
              and(
                eq(schema.gscMetrics.userId, userId),
                gte(schema.gscMetrics.date, gscFromStr),
              ),
            ),
        ),
      ]);

      // Drizzle returns text columns as strings — parse to floats for the brief payload.
      const gscMetrics = gscRows.map((r) => ({
        keywordId: r.keywordId,
        date: r.date,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: parseFloat(r.ctr) || 0,
        gscPosition: parseFloat(r.gscPosition) || 0,
      }));

      const brief = await step.run("generate", () =>
        generateBrief({
          keywords,
          positions,
          competitorPositions,
          gscMetrics,
          periodStart: ps,
          periodEnd: pe,
          profile,
          userId,
        }),
      );

      // Upsert on (userId, periodStart) so "Regenerate" for the same week
      // overwrites instead of throwing a unique-constraint error.
      const briefId = await step.run("save", async () => {
        const newId = randomUUID();
        const result = await db
          .insert(schema.briefs)
          .values({
            id: newId,
            userId,
            periodStart: ps,
            periodEnd: pe,
            summary: brief.summary,
            topMovers: brief.top_movers,
            tickets: brief.tickets,
            warnings: brief.warnings,
            llmModel: brief.model,
          })
          .onConflictDoUpdate({
            target: [schema.briefs.userId, schema.briefs.periodStart],
            set: {
              periodEnd: pe,
              summary: brief.summary,
              topMovers: brief.top_movers,
              tickets: brief.tickets,
              warnings: brief.warnings,
              llmModel: brief.model,
              generatedAt: new Date(),
            },
          })
          .returning({ id: schema.briefs.id });
        return result[0].id;
      });

      await step.run("mark-done", async () =>
        db
          .update(schema.briefRuns)
          .set({ status: "done", finishedAt: new Date(), briefId })
          .where(eq(schema.briefRuns.id, runId!)),
      );

      // Send weekly brief email (opt-out via business profile).
      await step.run("send-email", async () => {
        if (!profile?.weeklyEmailEnabled) return { skipped: "opt_out" };

        // Resolve recipient: profile override first, fall back to login email.
        let recipient = profile?.weeklyEmailRecipient ?? null;
        if (!recipient) {
          const [userRow] = await db
            .select({ email: schema.users.email })
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .limit(1);
          recipient = userRow?.email ?? null;
        }
        if (!recipient) return { skipped: "no_recipient" };

        const dashboardUrl =
          process.env.BETTER_AUTH_URL ?? "http://localhost:3100";
        const lang = (profile?.preferredLanguage === "en" ? "en" : "fr") as
          | "fr"
          | "en";

        const res = await sendWeeklyBriefEmail({
          to: recipient,
          businessName: profile?.businessName ?? null,
          periodStart: ps,
          periodEnd: pe,
          summary: brief.summary,
          topMovers: brief.top_movers,
          tickets: brief.tickets,
          warnings: brief.warnings,
          dashboardUrl: `${dashboardUrl}/dashboard`,
          language: lang,
        });
        return res;
      });

      return { saved: true, periodStart: ps };
    } catch (err: any) {
      await step.run("mark-failed", async () =>
        db
          .update(schema.briefRuns)
          .set({
            status: "failed",
            finishedAt: new Date(),
            error: String(err?.message ?? err).slice(0, 500),
          })
          .where(eq(schema.briefRuns.id, runId!)),
      );
      throw err;
    }
  },
);

// -------------------------------------------------------------------
// GSC history pull — fetch up to 90 days of clicks/impressions/CTR/position
// per tracked keyword from Google Search Console. Manual trigger + daily incremental cron.
// -------------------------------------------------------------------
export const gscHistoryPull = inngest.createFunction(
  {
    id: "gsc-history-pull",
    concurrency: { limit: 2 },
    triggers: [{ event: "gsc/history.pull" }],
    // Hard cap the whole run. Past this Inngest marks as failed instead of hanging.
    timeouts: { start: "1m", finish: "4m" },
  },
  async ({ event, step }) => {
    const userId = event.data.userId;
    const days = event.data.days ?? 90;
    const t = tenantDb(userId);

    let runId = event.data.runId as string | undefined;
    if (!runId) {
      runId = randomUUID();
      await step.run("create-cron-run", async () =>
        db.insert(schema.gscRuns).values({
          id: runId!,
          userId,
          source: "cron",
          status: "queued",
          daysRequested: days,
        }),
      );
    }

    await step.run("mark-running", async () =>
      db
        .update(schema.gscRuns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(schema.gscRuns.id, runId!)),
    );

    try {
      const [gscToken, sites, keywords] = await Promise.all([
        step.run("load-token", () => t.selectGscToken()),
        step.run("load-sites", () => t.selectSites()),
        step.run("load-keywords", () => t.selectKeywords()),
      ]);

      if (gscToken.length === 0) {
        await step.run("skip-no-token", async () =>
          db
            .update(schema.gscRuns)
            .set({ status: "skipped", finishedAt: new Date(), error: "GSC not connected" })
            .where(eq(schema.gscRuns.id, runId!)),
        );
        return { skipped: true };
      }

      const site = sites.find((s) => s.gscPropertyUri);
      if (!site) {
        await step.run("skip-no-site", async () =>
          db
            .update(schema.gscRuns)
            .set({ status: "skipped", finishedAt: new Date(), error: "no GSC site URI" })
            .where(eq(schema.gscRuns.id, runId!)),
        );
        return { skipped: true };
      }

      const activeKeywords = keywords.filter((k) => !k.removedAt);
      if (activeKeywords.length === 0) {
        await step.run("skip-no-keywords", async () =>
          db
            .update(schema.gscRuns)
            .set({ status: "skipped", finishedAt: new Date(), error: "no keywords" })
            .where(eq(schema.gscRuns.id, runId!)),
        );
        return { skipped: true };
      }

      const refreshToken = decrypt(gscToken[0].encryptedRefreshToken);
      const queries = activeKeywords.map((k) => k.query);

      const rows = await step.run("fetch-gsc", () =>
        fetchGscHistoryByQuery(refreshToken, site.gscPropertyUri!, queries, days),
      );

      // Pull site-wide totals for the same period — one extra API call, gives us
      // GSC's default "all site" view of clicks/impressions over time.
      const siteTotals = await step.run("fetch-gsc-site-totals", () =>
        fetchGscSiteTotals(refreshToken, site.gscPropertyUri!, days),
      );

      await step.run("upsert-site-totals", async () => {
        if (siteTotals.length === 0) return;
        const siteValues = siteTotals.map((r) => ({
          id: randomUUID(),
          userId,
          date: r.date,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr.toString(),
          position: r.position.toString(),
        }));
        await db
          .insert(schema.gscSiteMetrics)
          .values(siteValues)
          .onConflictDoUpdate({
            target: [schema.gscSiteMetrics.userId, schema.gscSiteMetrics.date],
            set: {
              clicks: sql`excluded.clicks`,
              impressions: sql`excluded.impressions`,
              ctr: sql`excluded.ctr`,
              position: sql`excluded.position`,
              fetchedAt: new Date(),
            },
          });
      });

      // Pull page × date breakdown — feeds /dashboard/pages (indexed pages) +
      // /dashboard/refresh (content refresh radar). One extra API call per pull,
      // batched upsert. Pages = any URL with >=1 impression in the window.
      const pageRows = await step.run("fetch-gsc-pages", () =>
        fetchGscPagesByDate(refreshToken, site.gscPropertyUri!, days),
      );

      const PAGE_BATCH = 500;
      for (let i = 0; i < pageRows.length; i += PAGE_BATCH) {
        const chunk = pageRows.slice(i, i + PAGE_BATCH);
        await step.run(`upsert-pages-${i}`, async () => {
          if (chunk.length === 0) return;
          const values = chunk.map((r) => ({
            id: randomUUID(),
            userId,
            url: r.url,
            date: r.date,
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: r.ctr.toString(),
            position: r.position.toString(),
          }));
          await db
            .insert(schema.gscPageMetrics)
            .values(values)
            .onConflictDoUpdate({
              target: [
                schema.gscPageMetrics.userId,
                schema.gscPageMetrics.url,
                schema.gscPageMetrics.date,
              ],
              set: {
                clicks: sql`excluded.clicks`,
                impressions: sql`excluded.impressions`,
                ctr: sql`excluded.ctr`,
                position: sql`excluded.position`,
                fetchedAt: new Date(),
              },
            });
        });
      }

      // Build query → keywordId lookup. Normalize on both sides (lowercase + trim +
      // collapse whitespace) so casing/spacing differences don't lose matches.
      const norm = (s: string) =>
        s.toLowerCase().trim().replace(/\s+/g, " ");
      const byQuery = new Map(activeKeywords.map((k) => [norm(k.query), k.id]));

      // Pre-map rows → values in one pass. Skip rows without a matching tracked keyword.
      const values = rows
        .map((r) => {
          const keywordId = byQuery.get(norm(r.query));
          if (!keywordId) return null;
          return {
            id: randomUUID(),
            userId,
            keywordId,
            date: r.date,
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: r.ctr.toString(),
            gscPosition: r.position.toString(),
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      // Batch insert with ON CONFLICT DO UPDATE — ~50x faster than per-row upserts.
      // Postgres accepts ~1000 rows per INSERT comfortably; stay at 500 for margin.
      const BATCH = 500;
      let upserted = 0;
      for (let i = 0; i < values.length; i += BATCH) {
        const chunk = values.slice(i, i + BATCH);
        await step.run(`upsert-batch-${i}`, async () => {
          if (chunk.length === 0) return;
          await db
            .insert(schema.gscMetrics)
            .values(chunk)
            .onConflictDoUpdate({
              target: [schema.gscMetrics.keywordId, schema.gscMetrics.date],
              set: {
                clicks: sql`excluded.clicks`,
                impressions: sql`excluded.impressions`,
                ctr: sql`excluded.ctr`,
                gscPosition: sql`excluded.gsc_position`,
                fetchedAt: new Date(),
              },
            });
          upserted += chunk.length;
        });
      }

      await step.run("mark-done", async () =>
        db
          .update(schema.gscRuns)
          .set({
            status: "done",
            finishedAt: new Date(),
            rowsFetched: rows.length,
            metricsUpserted: upserted,
          })
          .where(eq(schema.gscRuns.id, runId!)),
      );

      return { rows: rows.length, upserted, days };
    } catch (err: any) {
      await step.run("mark-failed", async () =>
        db
          .update(schema.gscRuns)
          .set({
            status: "failed",
            finishedAt: new Date(),
            error: String(err?.message ?? err).slice(0, 500),
          })
          .where(eq(schema.gscRuns.id, runId!)),
      );
      throw err;
    }
  },
);

// Daily incremental GSC pull — runs at 04:00 UTC for all users with GSC connected.
// Skip in dev mode so local experimentation doesn't trigger automatic pulls overnight.
export const gscDailyScheduler = inngest.createFunction(
  { id: "gsc-daily-scheduler", triggers: [{ cron: "0 4 * * *" }] },
  async ({ step }) => {
    if (process.env.INNGEST_DEV === "1" || process.env.NODE_ENV !== "production") {
      return { skipped: "dev_mode" };
    }
    const users = await step.run("list", async () =>
      db.selectDistinct({ userId: schema.gscTokens.userId }).from(schema.gscTokens),
    );
    for (const u of users) {
      await step.sendEvent("fanout", {
        name: "gsc/history.pull",
        data: { userId: u.userId, days: 7 },
      });
    }
    return { fannedOut: users.length };
  },
);

// -------------------------------------------------------------------
// Site audit — crawl homepage + sitemap pages, run on-page checks,
// run site-wide checks, then ask Claude to synthesize prioritized actions.
// -------------------------------------------------------------------
export const siteAudit = inngest.createFunction(
  {
    id: "site-audit",
    concurrency: { limit: 2 },
    triggers: [{ event: "audit/run" }],
  },
  async ({ event, step }) => {
    const userId = event.data.userId;
    const runId = event.data.runId;
    const t = tenantDb(userId);

    await step.run("mark-running", async () =>
      db
        .update(schema.auditRuns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(schema.auditRuns.id, runId)),
    );

    try {
      const sites = await step.run("load-sites", () => t.selectSites());
      const profile = await step.run("load-profile", () => t.selectBusinessProfile());
      const keywords = await step.run("load-keywords", () => t.selectKeywords());

      if (sites.length === 0) {
        await step.run("skip", async () =>
          db
            .update(schema.auditRuns)
            .set({ status: "skipped", finishedAt: new Date(), error: "no site" })
            .where(eq(schema.auditRuns.id, runId)),
        );
        return { skipped: true };
      }

      const site = sites[0];
      const homepageUrl = site.gscPropertyUri?.startsWith("sc-domain:")
        ? `https://${site.domain}/`
        : site.gscPropertyUri ?? `https://${site.domain}/`;

      const urls = await step.run("discover-urls", () => discoverUrls(homepageUrl, 10));

      const trackedQueries = keywords.filter((k) => !k.removedAt).map((k) => k.query);
      const allFindings: Array<ReturnType<typeof runPageChecks>[number]> = [];

      // SSR pass — fast, gives us baseline + tech metrics (response time, status, bytes).
      const ssrPages = await step.run("ssr-fetch-all", async () => {
        const results = [];
        for (const url of urls) {
          try {
            results.push(await fetchPage(url));
          } catch (e: any) {
            results.push({
              url,
              finalUrl: url,
              status: 0,
              responseMs: 0,
              bytes: 0,
              html: "",
              rendered: false as const,
              fetchError: String(e?.message ?? e).slice(0, 200),
            });
          }
        }
        return results;
      });

      // JS-rendered pass — slow (Playwright Chromium, ~5-10s per page) but reflects
      // what Google sees after hydration. Catches client-side schema, dynamic content, etc.
      const renderedPages = await step.run("js-rendered-fetch-all", () =>
        fetchPagesRendered(urls),
      );

      // Run checks on the rendered HTML when available, fall back to SSR.
      // This way schema/microdata injected client-side is correctly detected.
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const ssr = ssrPages[i];
        const rendered = renderedPages[i];
        const source = rendered.html.length > 100 ? rendered : ssr;

        if ((source as any).fetchError) {
          allFindings.push({
            url,
            category: "tech",
            checkKey: "fetch_failed",
            severity: "high",
            message: "Failed to fetch page",
            detail: (source as any).fetchError,
            fix: "Check that the URL is reachable and not blocked by your firewall.",
          });
          continue;
        }

        const findings = await step.run(`checks-${i}`, async () =>
          runPageChecks({
            url: source.finalUrl,
            html: source.html,
            // Tech metrics always come from the SSR pass (real network response, not headless)
            status: ssr.status,
            responseMs: ssr.responseMs,
            bytes: ssr.bytes,
            trackedKeywords: trackedQueries,
          }),
        );
        allFindings.push(...findings);
      }

      // Site-wide checks
      const siteFindings = await step.run("site-wide-checks", () =>
        runSiteWideChecks(homepageUrl),
      );
      allFindings.push(...siteFindings);

      // Persist findings
      await step.run("save-findings", async () => {
        for (const f of allFindings) {
          await db.insert(schema.auditFindings).values({
            id: randomUUID(),
            runId,
            userId,
            url: f.url,
            category: f.category,
            checkKey: f.checkKey,
            severity: f.severity,
            message: f.message,
            detail: f.detail ?? null,
            fix: f.fix ?? null,
          });
        }
      });

      // AI synthesis: BYOK users skip credits, others need enough balance.
      let synthesis: Awaited<ReturnType<typeof synthesizeAudit>> | null = null;
      const synthesisDecision = await step.run("synthesis-eligibility", async () => {
        // Check BYOK — user has their own Anthropic key → skip credit check
        const { getApiKeyStatus } = await import("@/lib/actions/api-keys");
        const keyStatus = await getApiKeyStatus(userId);
        if (keyStatus.anthropic) {
          return { run: true, reason: "byok" };
        }

        const balance = await getCreditsBalance(userId);
        if (balance < CREDIT_COSTS.audit) return { run: false, reason: "insufficient_credits", balance };
        try {
          await debitCredits({
            userId,
            amount: CREDIT_COSTS.audit,
            reason: "audit_synthesis",
            metadata: { runId },
          });
        } catch {
          return { run: false, reason: "debit_failed" };
        }
        return { run: true, reason: "ok" };
      });

      if (synthesisDecision.run) {
        synthesis = await step.run("synthesize", () =>
          synthesizeAudit({
            findings: allFindings,
            profile,
            pagesCrawled: urls.length,
            userId,
          }),
        );
      }

      const high = allFindings.filter((f) => f.severity === "high").length;

      await step.run("mark-done", async () =>
        db
          .update(schema.auditRuns)
          .set({
            status: "done",
            finishedAt: new Date(),
            siteId: site.id,
            pagesCrawled: urls.length,
            findingsCount: allFindings.length,
            highSeverityCount: high,
            aiSummary: synthesis ? JSON.stringify(synthesis) : null,
            error: synthesis
              ? null
              : `synthesis_skipped:${(synthesisDecision as any).reason}`,
          })
          .where(eq(schema.auditRuns.id, runId)),
      );

      return {
        findings: allFindings.length,
        high,
        pages: urls.length,
        synthesisRan: !!synthesis,
      };
    } catch (err: any) {
      await step.run("mark-failed", async () =>
        db
          .update(schema.auditRuns)
          .set({
            status: "failed",
            finishedAt: new Date(),
            error: String(err?.message ?? err).slice(0, 500),
          })
          .where(eq(schema.auditRuns.id, runId)),
      );
      throw err;
    }
  },
);

// -------------------------------------------------------------------
// AEO / LLM visibility check — manual trigger per user.
// Checks each keyword against enabled LLM engines (Perplexity / Claude / OpenAI)
// and records whether the user's domain appears in the citations.
// -------------------------------------------------------------------
export const llmVisibilityCheck = inngest.createFunction(
  {
    id: "llm-visibility-check",
    concurrency: { limit: 3 },
    triggers: [{ event: "aeo/visibility.check" }],
  },
  async ({ event, step }) => {
    const { userId, runId, engines, keywordIds } = event.data as {
      userId: string;
      runId: string;
      engines: Array<"perplexity" | "claude" | "openai">;
      keywordIds?: string[];
    };
    if (!userId || !runId) throw new Error("userId and runId required");
    const t = tenantDb(userId);

    await step.run("mark-running", async () =>
      db
        .update(schema.llmVisibilityRuns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(schema.llmVisibilityRuns.id, runId)),
    );

    try {
      const [sites, allKeywords] = await Promise.all([
        step.run("load-sites", () => t.selectSites()),
        step.run("load-keywords", () => t.selectKeywords()),
      ]);

      const site = sites[0];
      if (!site) {
        await step.run("mark-skipped", async () =>
          db
            .update(schema.llmVisibilityRuns)
            .set({ status: "skipped", finishedAt: new Date(), error: "no site registered" })
            .where(eq(schema.llmVisibilityRuns.id, runId)),
        );
        return { skipped: true };
      }

      const userDomain = site.domain;
      const targetKeywords = (keywordIds && keywordIds.length > 0
        ? allKeywords.filter((k) => keywordIds.includes(k.id))
        : allKeywords.filter((k) => !k.removedAt)
      ).slice(0, 50); // hard cap to keep cost predictable

      if (targetKeywords.length === 0) {
        await step.run("mark-skipped", async () =>
          db
            .update(schema.llmVisibilityRuns)
            .set({ status: "skipped", finishedAt: new Date(), error: "no keywords" })
            .where(eq(schema.llmVisibilityRuns.id, runId)),
        );
        return { skipped: true };
      }

      // Dynamic import — keeps Inngest cold start lean if the engines module grows.
      const { checkAllEngines } = await import("@/lib/llm-visibility/engines");

      let mentionedCount = 0;
      let totalCost = 0;
      let checkCount = 0;

      // Check one keyword at a time, all engines in parallel per keyword.
      // Each keyword is its own Inngest step so retries/resumes are granular.
      for (const kw of targetKeywords) {
        const results = await step.run(`check-${kw.id}`, async () => {
          return checkAllEngines(kw.query, userDomain, engines, userId);
        });

        await step.run(`persist-${kw.id}`, async () => {
          for (const r of results) {
            await db.insert(schema.llmVisibilityResults).values({
              id: randomUUID(),
              runId,
              userId,
              keywordId: kw.id,
              engine: r.engine,
              mentioned: r.mentioned,
              position: r.position,
              citedUrls: r.citedUrls,
              competitorMentions: r.competitorMentions,
              answerSnippet: r.answerSnippet,
              costUsd: r.costUsd.toFixed(6),
              error: r.error,
            });
          }
        });

        for (const r of results) {
          checkCount += 1;
          totalCost += r.costUsd;
          if (r.mentioned) mentionedCount += 1;
        }
      }

      await step.run("mark-done", async () =>
        db
          .update(schema.llmVisibilityRuns)
          .set({
            status: "done",
            finishedAt: new Date(),
            keywordCount: targetKeywords.length,
            checkCount,
            mentionedCount,
            costUsd: totalCost.toFixed(4),
          })
          .where(eq(schema.llmVisibilityRuns.id, runId)),
      );

      return { checks: checkCount, mentioned: mentionedCount, cost: totalCost };
    } catch (err: any) {
      await step.run("mark-failed", async () =>
        db
          .update(schema.llmVisibilityRuns)
          .set({
            status: "failed",
            finishedAt: new Date(),
            error: String(err?.message ?? err).slice(0, 500),
          })
          .where(eq(schema.llmVisibilityRuns.id, runId)),
      );
      throw err;
    }
  },
);

// -------------------------------------------------------------------
// Cannibalization scan — pulls GSC [query × page] for the window and
// stores findings inline on the run row.
// -------------------------------------------------------------------
export const cannibalizationScan = inngest.createFunction(
  {
    id: "cannibalization-scan",
    concurrency: { limit: 3 },
    triggers: [{ event: "cannibalization/scan" }],
  },
  async ({ event, step }) => {
    const { userId, runId, daysWindow } = event.data as {
      userId: string;
      runId: string;
      daysWindow: number;
    };
    if (!userId || !runId) throw new Error("userId and runId required");
    const t = tenantDb(userId);

    await step.run("mark-running", async () =>
      db
        .update(schema.cannibalizationRuns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(schema.cannibalizationRuns.id, runId)),
    );

    try {
      const [sites, gscToken, keywords] = await Promise.all([
        step.run("load-sites", () => t.selectSites()),
        step.run("load-token", () => t.selectGscToken()),
        step.run("load-keywords", () => t.selectKeywords()),
      ]);

      const site = sites[0];
      if (!site || !site.gscPropertyUri || gscToken.length === 0) {
        await step.run("mark-skipped", async () =>
          db
            .update(schema.cannibalizationRuns)
            .set({
              status: "skipped",
              finishedAt: new Date(),
              error: "GSC not connected",
            })
            .where(eq(schema.cannibalizationRuns.id, runId)),
        );
        return { skipped: true };
      }

      const refreshToken = decrypt(gscToken[0].encryptedRefreshToken);

      const rows = await step.run("fetch-gsc-query-page", async () => {
        const { fetchGscQueryPageBreakdown } = await import("@/lib/google-oauth");
        return fetchGscQueryPageBreakdown(refreshToken, site.gscPropertyUri!, daysWindow);
      });

      const findings = await step.run("detect", async () => {
        const { detectCannibalization } = await import("@/lib/cannibalization");
        return detectCannibalization(
          rows,
          keywords.filter((k) => !k.removedAt).map((k) => ({ id: k.id, query: k.query })),
        );
      });

      // Count distinct queries we actually looked at (for UI context).
      const queriesScanned = new Set(rows.map((r) => r.query)).size;

      await step.run("mark-done", async () =>
        db
          .update(schema.cannibalizationRuns)
          .set({
            status: "done",
            finishedAt: new Date(),
            queriesScanned,
            findingsCount: findings.length,
            findings,
          })
          .where(eq(schema.cannibalizationRuns.id, runId)),
      );

      return { findings: findings.length, queries: queriesScanned };
    } catch (err: any) {
      await step.run("mark-failed", async () =>
        db
          .update(schema.cannibalizationRuns)
          .set({
            status: "failed",
            finishedAt: new Date(),
            error: String(err?.message ?? err).slice(0, 500),
          })
          .where(eq(schema.cannibalizationRuns.id, runId)),
      );
      throw err;
    }
  },
);

// -------------------------------------------------------------------
// Content brief generation — one per keyword, on demand.
// Pulls the keyword's SERP neighbours + GSC data + business profile,
// asks Claude for a structured writer brief, stores on contentBriefs row.
// -------------------------------------------------------------------
export const contentBriefGenerate = inngest.createFunction(
  {
    id: "content-brief-generate",
    concurrency: { limit: 5 },
    triggers: [{ event: "content-brief/generate" }],
  },
  async ({ event, step }) => {
    const { userId, briefId, keywordId } = event.data as {
      userId: string;
      briefId: string;
      keywordId: string;
    };
    if (!userId || !briefId || !keywordId) {
      throw new Error("userId, briefId and keywordId required");
    }
    const t = tenantDb(userId);

    await step.run("mark-running", async () =>
      db
        .update(schema.contentBriefs)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(schema.contentBriefs.id, briefId)),
    );

    try {
      const [keyword] = await step.run("load-keyword", async () =>
        db
          .select()
          .from(schema.keywords)
          .where(
            and(eq(schema.keywords.id, keywordId), eq(schema.keywords.userId, userId)),
          )
          .limit(1),
      );
      if (!keyword) throw new Error("keyword not found");

      const profile = await step.run("load-profile", () => t.selectBusinessProfile());

      const [latestPosition] = await step.run("load-latest-pos", async () =>
        db
          .select()
          .from(schema.positions)
          .where(
            and(
              eq(schema.positions.userId, userId),
              eq(schema.positions.keywordId, keywordId),
            ),
          )
          .orderBy(desc(schema.positions.date))
          .limit(1),
      );

      const serpDate = latestPosition?.date;
      const topSerp = serpDate
        ? await step.run("load-serp", async () => {
            const rows = await db
              .select()
              .from(schema.competitorPositions)
              .where(
                and(
                  eq(schema.competitorPositions.userId, userId),
                  eq(schema.competitorPositions.keywordId, keywordId),
                  eq(schema.competitorPositions.date, serpDate),
                ),
              )
              .orderBy(schema.competitorPositions.position)
              .limit(10);
            return rows
              .filter((r) => r.position !== null && r.url)
              .map((r) => ({
                position: r.position as number,
                url: r.url as string,
                domain: r.competitorDomain,
              }));
          })
        : [];

      const gscAgg = await step.run("load-gsc", async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 28);
        const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);
        const rows = await db
          .select()
          .from(schema.gscMetrics)
          .where(
            and(
              eq(schema.gscMetrics.userId, userId),
              eq(schema.gscMetrics.keywordId, keywordId),
              gte(schema.gscMetrics.date, cutoff),
            ),
          );
        if (rows.length === 0) return null;
        const clicks = rows.reduce((s, r) => s + r.clicks, 0);
        const impressions = rows.reduce((s, r) => s + r.impressions, 0);
        const avgPosition =
          rows.reduce((s, r) => s + Number(r.gscPosition), 0) / rows.length;
        return {
          clicks,
          impressions,
          ctr: impressions > 0 ? clicks / impressions : 0,
          avgPosition,
        };
      });

      const { content, model, costUsd } = await step.run("llm-generate", async () => {
        const { generateContentBrief } = await import("@/lib/llm/content-brief");
        return generateContentBrief({
          keyword: keyword.query,
          intentStage: keyword.intentStage,
          country: keyword.country,
          currentPosition: latestPosition?.position ?? null,
          currentUrl: latestPosition?.url ?? null,
          topSerp,
          gscMetrics: gscAgg,
          profile: profile
            ? {
                businessName: profile.businessName,
                primaryService: profile.primaryService,
                secondaryServices: profile.secondaryServices,
                targetCities: profile.targetCities,
                targetCustomer: profile.targetCustomer,
                averageCustomerValueEur: profile.averageCustomerValueEur,
                competitorUrls: profile.competitorUrls,
                biggestSeoProblem: profile.biggestSeoProblem,
                preferredLanguage: profile.preferredLanguage,
              }
            : null,
          userId,
        });
      });

      await step.run("mark-done", async () =>
        db
          .update(schema.contentBriefs)
          .set({
            status: "done",
            finishedAt: new Date(),
            content,
            llmModel: model,
            costUsd: costUsd.toFixed(6),
          })
          .where(eq(schema.contentBriefs.id, briefId)),
      );

      return { done: true, cost: costUsd };
    } catch (err: any) {
      await step.run("mark-failed", async () =>
        db
          .update(schema.contentBriefs)
          .set({
            status: "failed",
            finishedAt: new Date(),
            error: String(err?.message ?? err).slice(0, 500),
          })
          .where(eq(schema.contentBriefs.id, briefId)),
      );
      throw err;
    }
  },
);

// -------------------------------------------------------------------
// Competitor keyword gap scan — pulls ranked keywords per declared
// competitor, diffs against user's tracked + GSC queries, stores gaps.
// -------------------------------------------------------------------
export const competitorGapScan = inngest.createFunction(
  {
    id: "competitor-gap-scan",
    concurrency: { limit: 2 },
    triggers: [{ event: "competitor-gap/scan" }],
  },
  async ({ event, step }) => {
    const { userId, runId } = event.data as { userId: string; runId: string };
    if (!userId || !runId) throw new Error("userId and runId required");
    const t = tenantDb(userId);

    await step.run("mark-running", async () =>
      db
        .update(schema.competitorGapRuns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(schema.competitorGapRuns.id, runId)),
    );

    try {
      const [profile, keywords, sites] = await Promise.all([
        step.run("load-profile", () => t.selectBusinessProfile()),
        step.run("load-keywords", () => t.selectKeywords()),
        step.run("load-sites", () => t.selectSites()),
      ]);

      const competitorDomains = (profile?.competitorUrls ?? [])
        .map((u) => {
          try {
            return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
          } catch {
            return u.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
          }
        })
        .filter(Boolean);

      if (competitorDomains.length === 0) {
        await step.run("mark-skipped", async () =>
          db
            .update(schema.competitorGapRuns)
            .set({
              status: "skipped",
              finishedAt: new Date(),
              error: "No competitors declared in business profile.",
            })
            .where(eq(schema.competitorGapRuns.id, runId)),
        );
        return { skipped: true };
      }

      // Build "already covered" set — queries we track OR that show up in GSC.
      const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
      const covered = new Set<string>();
      for (const k of keywords) {
        if (!k.removedAt) covered.add(norm(k.query));
      }
      await step.run("load-gsc-queries", async () => {
        const rows = await db
          .select({ q: schema.gscMetrics.keywordId })
          .from(schema.gscMetrics)
          .where(eq(schema.gscMetrics.userId, userId))
          .limit(5000);
        return rows.length;
      });

      const profileCities = profile?.targetCities ?? [];

      // Pull ranked keywords per competitor (sequential to stay under rate limits)
      type Row = {
        keyword: string;
        competitorDomain: string;
        competitorPosition: number;
        competitorUrl: string | null;
        searchVolume: number | null;
        cpc: number | null;
        keywordDifficulty: number | null;
      };
      const allRows: Row[] = [];

      for (const comp of competitorDomains) {
        const rows = await step.run(`pull-${comp}`, async () => {
          const { fetchCompetitorRankedKeywords } = await import("@/lib/dataforseo");
          const items = await fetchCompetitorRankedKeywords(comp, { limit: 500 });
          return items
            .filter((x) => x.keyword && x.competitorPosition !== null)
            .map((x) => ({
              keyword: x.keyword,
              competitorDomain: comp,
              competitorPosition: x.competitorPosition as number,
              competitorUrl: x.competitorUrl,
              searchVolume: x.searchVolume,
              cpc: x.cpc,
              keywordDifficulty: x.keywordDifficulty,
            }));
        });
        allRows.push(...rows);
      }

      // Aggregate: one row per unique keyword. Pick the best competitor position;
      // also track the other competitor domains that rank (alsoOn).
      const byKeyword = new Map<
        string,
        {
          keyword: string;
          best: Row;
          alsoOn: Set<string>;
          volume: number | null;
          difficulty: number | null;
          cpc: number | null;
        }
      >();
      for (const r of allRows) {
        const key = norm(r.keyword);
        const existing = byKeyword.get(key);
        if (!existing) {
          byKeyword.set(key, {
            keyword: r.keyword,
            best: r,
            alsoOn: new Set<string>(),
            volume: r.searchVolume,
            difficulty: r.keywordDifficulty,
            cpc: r.cpc,
          });
        } else {
          if (r.competitorPosition < existing.best.competitorPosition) {
            existing.alsoOn.add(existing.best.competitorDomain);
            existing.best = r;
          } else {
            existing.alsoOn.add(r.competitorDomain);
          }
        }
      }

      // Filter out already-covered queries and cap per competitor.
      const { classifyIntentRule } = await import("@/lib/llm/intent-classifier");
      const candidates = [...byKeyword.values()].filter((c) => !covered.has(norm(c.keyword)));

      // Enrich with intent + build final finding shape.
      type Finding = NonNullable<
        typeof schema.competitorGapRuns.$inferSelect["findings"]
      >[number];
      const enriched: Finding[] = candidates.map((c) => ({
        keyword: c.keyword,
        competitorDomain: c.best.competitorDomain,
        competitorPosition: c.best.competitorPosition,
        competitorUrl: c.best.competitorUrl,
        searchVolume: c.volume,
        cpc: c.cpc,
        keywordDifficulty: c.difficulty,
        intentStage: classifyIntentRule(c.keyword, profileCities),
        alsoOn: [...c.alsoOn],
      }));

      // Ranking score: prioritise commercial intent + volume, penalise difficulty.
      function score(f: Finding): number {
        const vol = f.searchVolume ?? 10;
        const diff = f.keywordDifficulty ?? 40;
        const stage = f.intentStage ?? 2;
        return Math.log(vol + 10) * (stage + 1) - diff / 20;
      }
      enriched.sort((a, b) => score(b) - score(a));

      // Cap: 200 per competitor-declared × number of competitors (realistic ceiling).
      const CAP = 200 * competitorDomains.length;
      const findings = enriched.slice(0, CAP);

      // Rough cost: ~$0.01 per ranked_keywords call. 3 competitors ≈ $0.03.
      const costUsd = (competitorDomains.length * 0.01).toFixed(4);

      await step.run("mark-done", async () =>
        db
          .update(schema.competitorGapRuns)
          .set({
            status: "done",
            finishedAt: new Date(),
            competitorsScanned: competitorDomains.length,
            keywordsInspected: allRows.length,
            gapsFound: findings.length,
            costUsd,
            findings,
          })
          .where(eq(schema.competitorGapRuns.id, runId)),
      );

      return {
        competitors: competitorDomains.length,
        inspected: allRows.length,
        gaps: findings.length,
      };
    } catch (err: any) {
      await step.run("mark-failed", async () =>
        db
          .update(schema.competitorGapRuns)
          .set({
            status: "failed",
            finishedAt: new Date(),
            error: String(err?.message ?? err).slice(0, 500),
          })
          .where(eq(schema.competitorGapRuns.id, runId)),
      );
      throw err;
    }
  },
);

// -------------------------------------------------------------------
// Backlink pull — hits DataForSEO's 3 backlinks endpoints in parallel,
// persists summary + top N links + top N referring domains.
// -------------------------------------------------------------------
export const backlinkPull = inngest.createFunction(
  {
    id: "backlink-pull",
    concurrency: { limit: 2 },
    triggers: [{ event: "backlinks/pull" }],
  },
  async ({ event, step }) => {
    const { userId, runId } = event.data as { userId: string; runId: string };
    if (!userId || !runId) throw new Error("userId and runId required");
    const t = tenantDb(userId);

    await step.run("mark-running", async () =>
      db
        .update(schema.backlinkRuns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(schema.backlinkRuns.id, runId)),
    );

    try {
      const sites = await step.run("load-sites", () => t.selectSites());
      const site = sites[0];
      if (!site) {
        await step.run("mark-skipped", async () =>
          db
            .update(schema.backlinkRuns)
            .set({
              status: "skipped",
              finishedAt: new Date(),
              error: "no site registered",
            })
            .where(eq(schema.backlinkRuns.id, runId)),
        );
        return { skipped: true };
      }

      const domain = site.domain;

      // Three endpoints — fire in parallel, each as its own step for retries.
      const [summary, links, refDomains] = await Promise.all([
        step.run("summary", async () => {
          const { fetchBacklinkSummary } = await import("@/lib/dataforseo-backlinks");
          return fetchBacklinkSummary(domain);
        }),
        step.run("backlinks", async () => {
          const { fetchBacklinks } = await import("@/lib/dataforseo-backlinks");
          return fetchBacklinks(domain, 100);
        }),
        step.run("ref-domains", async () => {
          const { fetchReferringDomains } = await import("@/lib/dataforseo-backlinks");
          return fetchReferringDomains(domain, 100);
        }),
      ]);

      // Persist top backlinks.
      await step.run("persist-backlinks", async () => {
        if (links.length === 0) return;
        const rows = links.map((l) => ({
          id: randomUUID(),
          runId,
          userId,
          sourceUrl: l.sourceUrl,
          sourceDomain: l.sourceDomain,
          targetUrl: l.targetUrl,
          anchor: l.anchor,
          dofollow: l.dofollow,
          firstSeen: l.firstSeen,
          lastSeen: l.lastSeen,
          domainRank: l.domainRank,
          pageRank: l.pageRank,
          isNew: l.isNew,
          isLost: l.isLost,
        }));
        // Insert in chunks to avoid single-statement size limits.
        for (let i = 0; i < rows.length; i += 100) {
          await db.insert(schema.backlinks).values(rows.slice(i, i + 100));
        }
      });

      await step.run("persist-ref-domains", async () => {
        if (refDomains.length === 0) return;
        const rows = refDomains.map((d) => ({
          id: randomUUID(),
          runId,
          userId,
          domain: d.domain,
          backlinks: d.backlinks,
          dofollowBacklinks: d.dofollowBacklinks,
          rank: d.rank,
          firstSeen: d.firstSeen,
          lastSeen: d.lastSeen,
          isNew: d.isNew,
          isLost: d.isLost,
        }));
        for (let i = 0; i < rows.length; i += 100) {
          await db.insert(schema.backlinkRefDomains).values(rows.slice(i, i + 100));
        }
      });

      // Pull competitor profiles (summary + top 30 ref domains) so the UI can
      // show a side-by-side and surface link-gap outreach targets.
      const profile = await step.run("load-profile", () => t.selectBusinessProfile());
      const competitorDomains = (profile?.competitorUrls ?? [])
        .map((u) => {
          try {
            return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
          } catch {
            return u.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
          }
        })
        .filter(Boolean)
        .filter((d) => d !== domain.replace(/^www\./, "").toLowerCase());

      type CompSummary = NonNullable<
        typeof schema.backlinkRuns.$inferSelect["competitorSummaries"]
      >[number];
      const competitorSummaries: CompSummary[] = [];

      for (const comp of competitorDomains) {
        const compData = await step.run(`comp-${comp}`, async (): Promise<CompSummary> => {
          try {
            const { fetchBacklinkSummary, fetchReferringDomains } = await import(
              "@/lib/dataforseo-backlinks"
            );
            const [sum, refs] = await Promise.all([
              fetchBacklinkSummary(comp),
              fetchReferringDomains(comp, 30),
            ]);
            return {
              domain: comp,
              totalBacklinks: sum.totalBacklinks,
              referringDomains: sum.referringDomains,
              dofollowBacklinks: sum.dofollowBacklinks,
              avgRefDomainRank: sum.avgRefDomainRank,
              topRefDomains: refs.map((r) => ({
                domain: r.domain,
                rank: r.rank,
                backlinks: r.backlinks,
              })),
            };
          } catch (err: any) {
            return {
              domain: comp,
              totalBacklinks: 0,
              referringDomains: 0,
              dofollowBacklinks: 0,
              avgRefDomainRank: null,
              topRefDomains: [] as Array<{ domain: string; rank: number | null; backlinks: number }>,
              error: String(err?.message ?? err).slice(0, 200),
            };
          }
        });
        competitorSummaries.push(compData as CompSummary);
      }

      // Rough cost: $0.03 for user + $0.02 per competitor profile.
      const totalCost = 0.03 + competitorSummaries.length * 0.02;

      await step.run("mark-done", async () =>
        db
          .update(schema.backlinkRuns)
          .set({
            status: "done",
            finishedAt: new Date(),
            totalBacklinks: summary.totalBacklinks,
            referringDomains: summary.referringDomains,
            referringPages: summary.referringPages,
            dofollowBacklinks: summary.dofollowBacklinks,
            nofollowBacklinks: summary.nofollowBacklinks,
            avgRefDomainRank: summary.avgRefDomainRank,
            brokenBacklinks: summary.brokenBacklinks,
            competitorSummaries,
            costUsd: totalCost.toFixed(4),
          })
          .where(eq(schema.backlinkRuns.id, runId)),
      );

      return {
        backlinks: summary.totalBacklinks,
        refDomains: summary.referringDomains,
        sampled: links.length,
      };
    } catch (err: any) {
      await step.run("mark-failed", async () =>
        db
          .update(schema.backlinkRuns)
          .set({
            status: "failed",
            finishedAt: new Date(),
            error: String(err?.message ?? err).slice(0, 500),
          })
          .where(eq(schema.backlinkRuns.id, runId)),
      );
      throw err;
    }
  },
);

// -------------------------------------------------------------------
// Full-site meta crawl — parses sitemap (no limit), crawls every page,
// extracts metas + internal links, discovers orphan pages.
// -------------------------------------------------------------------
export const fullMetaCrawl = inngest.createFunction(
  {
    id: "meta-crawl",
    concurrency: { limit: 1 },
    triggers: [{ event: "meta-crawl/run" }],
  },
  async ({ event, step }) => {
    const { runFullMetaCrawl } = await import("@/lib/audit/meta-crawler");
    const userId = event.data.userId;
    const runId = event.data.runId;
    const t = tenantDb(userId);

    await step.run("mark-running", async () =>
      db
        .update(schema.metaCrawlRuns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(schema.metaCrawlRuns.id, runId)),
    );

    try {
      const sites = await step.run("load-sites", () => t.selectSites());

      if (sites.length === 0) {
        await step.run("skip", async () =>
          db
            .update(schema.metaCrawlRuns)
            .set({ status: "failed", finishedAt: new Date(), error: "No site configured." })
            .where(eq(schema.metaCrawlRuns.id, runId)),
        );
        return { failed: true, reason: "no_site" };
      }

      const site = sites[0];
      const homepageUrl = site.gscPropertyUri?.startsWith("sc-domain:")
        ? `https://${site.domain}/`
        : site.gscPropertyUri ?? `https://${site.domain}/`;

      const result = await step.run("crawl-all", () => runFullMetaCrawl(homepageUrl));

      await step.run("save-pages", async () => {
        for (const p of result.pages) {
          await db.insert(schema.metaCrawlPages).values({
            id: randomUUID(),
            runId,
            userId,
            url: p.url,
            title: p.title,
            titleLength: p.titleLength,
            metaDescription: p.metaDescription,
            metaDescriptionLength: p.metaDescriptionLength,
            h1: p.h1,
            canonical: p.canonical,
            ogTitle: p.ogTitle,
            ogDescription: p.ogDescription,
            ogImage: p.ogImage,
            wordCount: p.wordCount,
            httpStatus: p.httpStatus,
            responseMs: p.responseMs,
            indexable: p.indexable,
            inSitemap: p.inSitemap,
            internalLinksOut: p.internalLinksOut.length,
            linkedFrom: JSON.stringify((p as any).linkedFrom ?? []),
          });
        }
      });

      await step.run("mark-done", async () =>
        db
          .update(schema.metaCrawlRuns)
          .set({
            status: "done",
            finishedAt: new Date(),
            siteId: site.id,
            pagesCrawled: result.pages.length,
            sitemapUrls: result.sitemapUrlCount,
            orphanPages: result.orphanCount,
          })
          .where(eq(schema.metaCrawlRuns.id, runId)),
      );

      return {
        pages: result.pages.length,
        sitemapUrls: result.sitemapUrlCount,
        orphans: result.orphanCount,
      };
    } catch (err: any) {
      await step.run("mark-failed", async () =>
        db
          .update(schema.metaCrawlRuns)
          .set({
            status: "failed",
            finishedAt: new Date(),
            error: String(err?.message ?? err).slice(0, 500),
          })
          .where(eq(schema.metaCrawlRuns.id, runId)),
      );
      throw err;
    }
  },
);

// -------------------------------------------------------------------
// Article generation — produces a full SEO-optimized article via Claude.
// -------------------------------------------------------------------
export const generateArticle = inngest.createFunction(
  {
    id: "content-generate-article",
    concurrency: { limit: 3 },
    triggers: [{ event: "content/generate.article" }],
  },
  async ({ event, step }) => {
    const { userId, articleId, keywordId, topic } = event.data as {
      userId: string;
      articleId: string;
      keywordId?: string;
      topic?: string;
    };
    if (!userId || !articleId) throw new Error("userId and articleId required");
    const t = tenantDb(userId);

    await step.run("mark-generating", async () =>
      db
        .update(schema.generatedArticles)
        .set({ status: "generating" })
        .where(eq(schema.generatedArticles.id, articleId)),
    );

    try {
      // Load keyword if provided
      const keyword = keywordId
        ? await step.run("load-keyword", async () => {
            const [kw] = await db
              .select()
              .from(schema.keywords)
              .where(and(eq(schema.keywords.id, keywordId), eq(schema.keywords.userId, userId)))
              .limit(1);
            return kw ?? null;
          })
        : null;

      // Load business profile for context
      const profile = await step.run("load-profile", () => t.selectBusinessProfile());

      // Load latest SERP data if keyword exists
      const serpContext = keyword
        ? await step.run("load-serp-context", async () => {
            const positions = await db
              .select()
              .from(schema.positions)
              .where(
                and(
                  eq(schema.positions.userId, userId),
                  eq(schema.positions.keywordId, keyword.id),
                ),
              )
              .orderBy(desc(schema.positions.date))
              .limit(1);
            return positions[0] ?? null;
          })
        : null;

      const targetTopic = keyword?.query ?? topic ?? "general SEO topic";
      const lang = profile?.preferredLanguage ?? "fr";
      const MODEL = "claude-haiku-4-5-20251001";

      const result = await step.run("call-claude", async () => {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic();

        const systemPrompt = `You are an expert SEO content writer. You produce full, publication-ready articles optimized for search engines.

Rules:
- Write the article in ${lang === "en" ? "English" : "French"}.
- The article MUST be between 800 and 1500 words.
- Use proper markdown formatting with H2 (##) and H3 (###) headings.
- Include a compelling introduction and conclusion.
- Naturally incorporate the target keyword and semantic variations throughout.
- Write for humans first, search engines second — no keyword stuffing.
- Use short paragraphs (2-3 sentences max) for readability.
- Include actionable advice, examples, or data points where relevant.
${profile ? `
Business context:
- Business: ${profile.businessName ?? "Unknown"}
- Primary service: ${profile.primaryService ?? "Unknown"}
- Target customer: ${profile.targetCustomer ?? "Unknown"}
- Target cities: ${profile.targetCities?.join(", ") ?? "Unknown"}
- Biggest SEO problem: ${profile.biggestSeoProblem ?? "Not specified"}
` : ""}
${serpContext ? `Current SERP position: #${serpContext.position ?? "not ranked"}` : ""}

You MUST respond using the provided tool to structure your output.`;

        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          tools: [
            {
              name: "save_article",
              description: "Save the generated SEO article",
              input_schema: {
                type: "object" as const,
                properties: {
                  title: { type: "string", description: "SEO-optimized title (50-65 chars)" },
                  meta_description: { type: "string", description: "Meta description (140-155 chars)" },
                  slug: { type: "string", description: "URL-friendly slug (lowercase, hyphens)" },
                  content: { type: "string", description: "Full article in markdown with ## and ### headings" },
                },
                required: ["title", "meta_description", "slug", "content"],
              },
            },
          ],
          tool_choice: { type: "tool", name: "save_article" },
          messages: [
            {
              role: "user",
              content: `Write a comprehensive, SEO-optimized article targeting the keyword/topic: "${targetTopic}".

The article should:
1. Have a compelling title optimized for the target keyword
2. Include a meta description
3. Have a URL-friendly slug
4. Be structured with H2 and H3 headings
5. Be 800-1500 words
6. Be engaging and actionable`,
            },
          ],
        });

        const toolBlock = response.content.find((b) => b.type === "tool_use");
        if (!toolBlock || toolBlock.type !== "tool_use") {
          throw new Error("No tool_use block in response");
        }
        const input = toolBlock.input as {
          title: string;
          meta_description: string;
          slug: string;
          content: string;
        };
        return {
          title: input.title,
          metaDescription: input.meta_description,
          slug: input.slug,
          content: input.content,
          model: MODEL,
        };
      });

      const wordCount = result.content
        .replace(/[#*_\[\]()>-]/g, "")
        .split(/\s+/)
        .filter(Boolean).length;

      await step.run("save-article", async () =>
        db
          .update(schema.generatedArticles)
          .set({
            title: result.title,
            metaDescription: result.metaDescription,
            slug: result.slug,
            content: result.content,
            wordCount,
            model: result.model,
            status: "done",
          })
          .where(eq(schema.generatedArticles.id, articleId)),
      );

      return { articleId, wordCount, status: "done" };
    } catch (err: any) {
      await step.run("mark-failed", async () =>
        db
          .update(schema.generatedArticles)
          .set({ status: "failed" })
          .where(eq(schema.generatedArticles.id, articleId)),
      );
      throw err;
    }
  },
);

export const functions = [
  dailyFetchScheduler,
  userDailyFetch,
  weeklyBriefScheduler,
  weeklyBrief,
  gscHistoryPull,
  gscDailyScheduler,
  siteAudit,
  fullMetaCrawl,
  llmVisibilityCheck,
  cannibalizationScan,
  contentBriefGenerate,
  competitorGapScan,
  backlinkPull,
  generateArticle,
];
