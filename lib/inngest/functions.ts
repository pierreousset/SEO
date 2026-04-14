import { inngest } from "./client";
import { db, tenantDb, schema } from "@/db/client";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { postSerpTasks, fetchTaskResultMulti, urlToDomain } from "@/lib/dataforseo";
import { fetchGscHistoryByQuery, fetchGscSiteTotals } from "@/lib/google-oauth";
import { decrypt } from "@/lib/encryption";
import { fetchPage, fetchPagesRendered, discoverUrls } from "@/lib/audit/crawler";
import { runPageChecks, runSiteWideChecks } from "@/lib/audit/checks";
import { synthesizeAudit } from "@/lib/llm/audit-synthesis";
import { generateBrief } from "@/lib/llm/brief";
import { randomUUID } from "node:crypto";

// -------------------------------------------------------------------
// Daily SERP fetch — triggered by cron at 06:00 UTC, fans out per-user.
// -------------------------------------------------------------------
export const dailyFetchScheduler = inngest.createFunction(
  { id: "serp-daily-scheduler", triggers: [{ cron: "0 6 * * *" }] },
  async ({ step }) => {
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

      return { processed: allTaskIds.length, saved, date };
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

      // TODO: send email via Resend with the brief
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
        for (const r of siteTotals) {
          await db
            .insert(schema.gscSiteMetrics)
            .values({
              id: randomUUID(),
              userId,
              date: r.date,
              clicks: r.clicks,
              impressions: r.impressions,
              ctr: r.ctr.toString(),
              position: r.position.toString(),
            })
            .onConflictDoUpdate({
              target: [schema.gscSiteMetrics.userId, schema.gscSiteMetrics.date],
              set: {
                clicks: r.clicks,
                impressions: r.impressions,
                ctr: r.ctr.toString(),
                position: r.position.toString(),
                fetchedAt: new Date(),
              },
            });
        }
      });

      // Build query → keywordId lookup. Normalize on both sides (lowercase + trim +
      // collapse whitespace) so casing/spacing differences don't lose matches.
      const norm = (s: string) =>
        s.toLowerCase().trim().replace(/\s+/g, " ");
      const byQuery = new Map(activeKeywords.map((k) => [norm(k.query), k.id]));

      let upserted = 0;
      // Batch upserts — can be large with 90d * many keywords
      for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200);
        await step.run(`upsert-batch-${i}`, async () => {
          for (const r of batch) {
            const keywordId = byQuery.get(norm(r.query));
            if (!keywordId) continue;
            await db
              .insert(schema.gscMetrics)
              .values({
                id: randomUUID(),
                userId,
                keywordId,
                date: r.date,
                clicks: r.clicks,
                impressions: r.impressions,
                ctr: r.ctr.toString(),
                gscPosition: r.position.toString(),
              })
              .onConflictDoUpdate({
                target: [schema.gscMetrics.keywordId, schema.gscMetrics.date],
                set: {
                  clicks: r.clicks,
                  impressions: r.impressions,
                  ctr: r.ctr.toString(),
                  gscPosition: r.position.toString(),
                  fetchedAt: new Date(),
                },
              });
            upserted++;
          }
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
export const gscDailyScheduler = inngest.createFunction(
  { id: "gsc-daily-scheduler", triggers: [{ cron: "0 4 * * *" }] },
  async ({ step }) => {
    const users = await step.run("list", async () =>
      db.selectDistinct({ userId: schema.gscTokens.userId }).from(schema.gscTokens),
    );
    for (const u of users) {
      await step.sendEvent("fanout", {
        name: "gsc/history.pull",
        data: { userId: u.userId, days: 7 }, // daily incremental — only last week
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

      // AI synthesis
      const synthesis = await step.run("synthesize", () =>
        synthesizeAudit({
          findings: allFindings,
          profile,
          pagesCrawled: urls.length,
        }),
      );

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
            aiSummary: JSON.stringify(synthesis),
          })
          .where(eq(schema.auditRuns.id, runId)),
      );

      return { findings: allFindings.length, high, pages: urls.length };
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

export const functions = [
  dailyFetchScheduler,
  userDailyFetch,
  weeklyBriefScheduler,
  weeklyBrief,
  gscHistoryPull,
  gscDailyScheduler,
  siteAudit,
];
