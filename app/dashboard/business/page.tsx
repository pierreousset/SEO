import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb, db, schema } from "@/db/client";
import { and, eq, gte } from "drizzle-orm";
import { BusinessProfileForm } from "@/components/business-profile-form";
import { EmailDigestForm } from "@/components/email-digest-form";
import { CompetitorSuggestions } from "@/components/competitor-suggestions";
import { suggestCompetitors } from "@/lib/competitor-discovery";

export const dynamic = "force-dynamic";

const DISCOVERY_WINDOW_DAYS = 28;

export default async function BusinessPage() {
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);
  const [profile, sites] = await Promise.all([t.selectBusinessProfile(), t.selectSites()]);

  // Pull competitor SERP positions from the last 28 days to suggest new ones.
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - DISCOVERY_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const rows = await db
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
    .limit(20000);

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
    <div className="px-8 lg:px-12 py-10 max-w-[1100px] mx-auto space-y-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          Business context
        </p>
        <h1 className="font-display text-[40px] mt-3">Business</h1>
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

      <section>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Email digest</h2>
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
