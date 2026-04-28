import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb, db, schema } from "@/db/client";
import { and, eq, gte, sql } from "drizzle-orm";
import { BusinessProfileForm } from "@/components/business-profile-form";
import { EmailDigestForm } from "@/components/email-digest-form";
import { CompetitorSuggestions } from "@/components/competitor-suggestions";
import { suggestCompetitors } from "@/lib/competitor-discovery";

export const dynamic = "force-dynamic";

const DISCOVERY_WINDOW_DAYS = 28;

export default async function BusinessPage() {
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);
  const [profile, sites, keywords] = await Promise.all([
    t.selectBusinessProfile(),
    t.selectSites(),
    t.selectKeywords(),
  ]);

  // Pull competitor SERP positions from the last 28 days to suggest new ones.
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - DISCOVERY_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const [rows, kwAgg] = await Promise.all([
    db
      .select({
        keywordId: schema.competitorPositions.keywordId,
        competitorDomain: schema.competitorPositions.competitorDomain,
        date: schema.competitorPositions.date,
        position: schema.competitorPositions.position,
        url: schema.competitorPositions.url,
      })
      .from(schema.competitorPositions)
      .where(
        and(
          eq(schema.competitorPositions.userId, ctx.ownerId),
          gte(schema.competitorPositions.date, cutoffStr),
        ),
      )
      .limit(20000),
    db
      .select({
        keywordId: schema.gscMetrics.keywordId,
        clicks: sql<number>`sum(${schema.gscMetrics.clicks})::int`,
        impressions: sql<number>`sum(${schema.gscMetrics.impressions})::int`,
      })
      .from(schema.gscMetrics)
      .where(
        and(
          eq(schema.gscMetrics.userId, ctx.ownerId),
          gte(schema.gscMetrics.date, cutoffStr),
        ),
      )
      .groupBy(schema.gscMetrics.keywordId),
  ]);

  // Branded vs non-branded split — match keyword query against businessName tokens.
  const brandTokens = (() => {
    const name = profile?.businessName?.trim().toLowerCase() ?? "";
    if (!name) return [] as string[];
    return name.split(/[\s,.\-_]+/).filter((t) => t.length >= 3);
  })();
  const brand = { clicks: 0, impressions: 0, count: 0 };
  const nonBrand = { clicks: 0, impressions: 0, count: 0 };
  if (brandTokens.length > 0) {
    const kwById = new Map(keywords.map((k) => [k.id, k.query.toLowerCase()]));
    for (const m of kwAgg) {
      const q = kwById.get(m.keywordId);
      if (!q) continue;
      const isBranded = brandTokens.some((t) => q.includes(t));
      const bucket = isBranded ? brand : nonBrand;
      bucket.clicks += m.clicks;
      bucket.impressions += m.impressions;
      bucket.count += 1;
    }
  }
  const brandedTotal = brand.clicks + nonBrand.clicks;
  const brandedPct = brandedTotal > 0 ? Math.round((brand.clicks / brandedTotal) * 100) : 0;

  // Exclude the user's own domain + already-declared competitors.
  const excluded = new Set<string>();
  const userDomain = (sites[0]?.domain ?? "").replace(/^www\./, "").toLowerCase();
  if (userDomain) excluded.add(userDomain);
  for (const u of profile?.competitorUrls ?? []) {
    try {
      excluded.add(new URL(u).hostname.replace(/^www\./, "").toLowerCase());
    } catch {
      excluded.add(
        u
          .trim()
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0]
          .toLowerCase(),
      );
    }
  }

  const suggestions = suggestCompetitors(rows, excluded, 8);
  const currentCount = (profile?.competitorUrls ?? []).length;
  const remainingSlots = Math.max(0, 5 - currentCount);

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1100px] mx-auto space-y-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          Business context
        </p>
        <h1 className="font-display text-[40px] mt-2">Business</h1>
        <p className="mt-4 text-base text-muted-foreground max-w-2xl">
          Fill this once. Every AI brief uses it as system context, so recommendations are
          specific to your business instead of generic SEO advice. Declared competitors also
          power Gap, AEO showdown, and Backlinks link-gap.
        </p>
      </header>

      <BusinessProfileForm
        initial={
          profile
            ? {
                businessName: profile.businessName ?? "",
                primaryService: profile.primaryService ?? "",
                secondaryServices: profile.secondaryServices.join(", "),
                targetCities: profile.targetCities.join(", "),
                targetCustomer: profile.targetCustomer ?? "",
                averageCustomerValueEur: profile.averageCustomerValueEur ?? "",
                competitorUrls: profile.competitorUrls.join("\n"),
                biggestSeoProblem: profile.biggestSeoProblem ?? "",
                preferredLanguage: profile.preferredLanguage ?? "fr",
                weeklyEmailEnabled: profile.weeklyEmailEnabled,
                weeklyEmailRecipient: profile.weeklyEmailRecipient ?? "",
              }
            : {
                businessName: "",
                primaryService: "",
                secondaryServices: "",
                targetCities: "",
                targetCustomer: "",
                averageCustomerValueEur: "",
                competitorUrls: "",
                biggestSeoProblem: "",
                preferredLanguage: "fr",
                weeklyEmailEnabled: true,
                weeklyEmailRecipient: "",
              }
        }
      />

      {/* Brand visibility — branded vs non-branded GSC traffic split */}
      {profile?.businessName && (
        <section>
          <h2 className="font-mono text-[10px] text-muted-foreground mb-3">brand visibility</h2>
          <div className="bg-card rounded-2xl p-5">
            {brandedTotal === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                No GSC keyword data yet for &ldquo;{profile.businessName}&rdquo;. Pull GSC from the dashboard to populate this.
              </p>
            ) : (
              <>
                <div className="flex items-end justify-between gap-3 mb-4">
                  <div>
                    <p className="text-[13px] text-muted-foreground">
                      Detected brand: <span className="font-mono text-foreground">&ldquo;{profile.businessName}&rdquo;</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {brand.count} branded · {nonBrand.count} non-branded keywords (28d)
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-2xl font-semibold tabular-nums" style={{ color: "#A855F7" }}>
                      {brandedPct}%
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">branded share</div>
                  </div>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-background mb-3">
                  <div style={{ width: `${brandedPct}%`, backgroundColor: "#A855F7" }} />
                  <div style={{ width: `${100 - brandedPct}%`, backgroundColor: "#34D399" }} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <div className="font-mono text-base font-semibold tabular-nums" style={{ color: "#A855F7" }}>
                      {brand.clicks.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">branded clicks</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-base font-semibold tabular-nums" style={{ color: "#34D399" }}>
                      {nonBrand.clicks.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">non-branded clicks</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-mono text-[10px] text-muted-foreground mb-3">email digest</h2>
        <div className="border border-border rounded-md bg-card p-5">
          <EmailDigestForm
            currentFrequency={profile?.emailDigestFrequency ?? "weekly"}
            currentSections={(profile?.emailDigestSections as string[] | undefined) ?? ["health_score", "top_issues", "position_changes", "brief_summary"]}
          />
        </div>
      </section>

      {suggestions.length > 0 && (
        <CompetitorSuggestions
          suggestions={suggestions.map((s) => ({
            domain: s.domain,
            keywordCount: s.keywordCount,
            avgPosition: s.avgPosition,
            bestPosition: s.bestPosition,
          }))}
          remainingSlots={remainingSlots}
        />
      )}
    </div>
  );
}
