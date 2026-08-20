import { Check, CreditCard, Sparkles, Gift } from "lucide-react";
import { resolveAccountContext } from "@/lib/account-context";
import { getUserPlan, getActiveSubscription } from "@/lib/billing-helpers";
import { getReferralLink, getReferralStats } from "@/lib/actions/referrals";
import { PRO_LIMITS, FREE_LIMITS, PLAN_PRICE_EUR } from "@/lib/billing-constants";
import {
  SubscribeButton,
  ManageBillingButton,
  ProPlanCard,
  ReferralSection,
} from "@/components/billing-actions";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await resolveAccountContext();
  const sp = await searchParams;

  const [plan, sub, referralLink, referralStats] = await Promise.all([
    getUserPlan(ctx.ownerId),
    getActiveSubscription(ctx.ownerId),
    getReferralLink().catch(() => ({ url: "", code: "" })),
    getReferralStats().catch(() => ({ referrals: [], totalRewards: 0 })),
  ]);

  const flash = sp.status;

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      <header>
        <p className="text-caption text-ash-gray">Billing</p>
        <h1 className="text-heading-lg mt-2">Plan</h1>
      </header>

      {flash === "success" && (
        <div className="rounded-md border border-[var(--up)]/30 bg-[var(--up)]/10 text-[var(--up)] px-3 py-2 text-sm">
          Subscription active. Welcome to Pro.
        </div>
      )}
      {flash === "cancelled" && (
        <div className="rounded-md border border-yellow-500/30 bg-vivid-violet/10 text-vivid-violet dark:text-vivid-violet px-3 py-2 text-sm">
          Checkout cancelled. No charge.
        </div>
      )}

      {/* Current state */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="sheet p-6">
          <div className="flex items-center gap-2 text-caption text-ash-gray">
            <CreditCard className="h-3.5 w-3.5" strokeWidth={1.5} />
            current plan
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <h2 className="text-heading">{plan === "pro" ? "Pro" : "Free"}</h2>
            {sub?.cancelAtPeriodEnd && plan === "pro" && (
              <Badge variant="outline" className="text-[10px]">cancels at period end</Badge>
            )}
          </div>
          {sub?.currentPeriodEnd && plan === "pro" && (
            <p className="mt-2 text-xs text-muted-foreground font-mono tabular">
              Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
            </p>
          )}
          <div className="mt-4">
            {plan === "pro" ? (
              <ManageBillingButton />
            ) : (
              <SubscribeButton label={`Upgrade to Pro — ${PLAN_PRICE_EUR}€/mo`} />
            )}
          </div>
        </div>

        <div className="sheet p-6">
          <div className="flex items-center gap-2 text-caption text-ash-gray">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
            what you get
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h2 className="text-heading tabular">{PLAN_PRICE_EUR}€</h2>
            <span className="text-sm text-muted-foreground">/ month, everything included</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            No credits, no counting. Every feature is included in the flat plan —
            just fair monthly limits on the most expensive external scans.
          </p>
        </div>
      </section>

      {/* Pro plan */}
      {plan === "free" && (
        <section className="sheet p-6 md:p-8">
          <h2 className="text-heading">Pro — {PLAN_PRICE_EUR}€/mo</h2>
          <ul className="mt-6 space-y-2 text-sm">
            {[
              `${PRO_LIMITS.maxKeywordsIncluded} keywords tracked daily`,
              "Weekly AI brief auto-generated + emailed",
              "Full GSC dashboard with 90-day history",
              "Intent classification + diagnostic tags",
              "Site audit — included",
              "Competitor discovery — included",
              "AI keyword & meta suggestions — included",
              "No credits to count. Cancel anytime.",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-[var(--up)] mt-0.5 shrink-0" strokeWidth={2} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <ProPlanCard />
          </div>
        </section>
      )}

      {/* Referral program */}
      <section>
        <h2 className="text-caption text-ash-gray mb-4 flex items-center gap-2">
          <Gift className="h-3.5 w-3.5" strokeWidth={1.5} />
          referrals
        </h2>
        <div className="sheet p-6">
          <ReferralSection
            referralUrl={referralLink.url}
            referrals={referralStats.referrals}
            totalRewards={referralStats.totalRewards}
          />
        </div>
      </section>

      {/* Free tier reminder */}
      {plan === "free" && (
        <section className="rounded-2xl border border-dashed border-border p-6">
          <h2 className="text-sm font-semibold">You are on Free</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Free includes {FREE_LIMITS.maxKeywords} keywords, 1 site, GSC dashboard read-only.
            No AI brief, no audit, no competitor discovery.
          </p>
        </section>
      )}
    </div>
  );
}
