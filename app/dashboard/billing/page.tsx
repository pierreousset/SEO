import { Check, CreditCard, Coins, Gift, BellRing } from "lucide-react";
import { resolveAccountContext } from "@/lib/account-context";
import { getUserPlan, getActiveSubscription } from "@/lib/billing-helpers";
import { getCreditsBalance } from "@/lib/credits";
import { getAutoRefillSettings } from "@/lib/actions/billing";
import { getReferralLink, getReferralStats } from "@/lib/actions/referrals";
import {
  STRIPE_PRICES,
  PRO_LIMITS,
  FREE_LIMITS,
  CREDIT_COSTS,
} from "@/lib/billing-constants";
import {
  SubscribeButton,
  BuyCreditsButton,
  ManageBillingButton,
  ProPlanCard,
  AutoRefillForm,
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

  const [plan, sub, balance, autoRefill, referralLink, referralStats] = await Promise.all([
    getUserPlan(ctx.ownerId),
    getActiveSubscription(ctx.ownerId),
    getCreditsBalance(ctx.ownerId),
    getAutoRefillSettings().catch(() => ({ enabled: false, threshold: 10, packPriceId: null })),
    getReferralLink().catch(() => ({ url: "", code: "" })),
    getReferralStats().catch(() => ({ referrals: [], totalRewards: 0 })),
  ]);

  const flash = sp.status;

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">Billing</p>
        <h1 className="font-display text-[40px] mt-2">Plan & credits</h1>
      </header>

      {flash === "success" && (
        <div className="rounded-md border border-[var(--up)]/30 bg-[var(--up)]/10 text-[var(--up)] px-3 py-2 text-sm">
          Subscription active. Welcome to Pro.
        </div>
      )}
      {flash === "credits_added" && (
        <div className="rounded-md border border-[var(--up)]/30 bg-[var(--up)]/10 text-[var(--up)] px-3 py-2 text-sm">
          Credits added to your wallet.
        </div>
      )}
      {flash === "cancelled" && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 px-3 py-2 text-sm">
          Checkout cancelled. No charge.
        </div>
      )}

      {/* Current state */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-card p-6">
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" strokeWidth={1.5} />
            current plan
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <h2 className="font-display text-3xl">{plan === "pro" ? "Pro" : "Free"}</h2>
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
              <SubscribeButton label="Upgrade to Pro — 15€/mo" />
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-card p-6">
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <Coins className="h-3.5 w-3.5" strokeWidth={1.5} />
            credits balance
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h2 className="font-display text-3xl tabular">{balance}</h2>
            <span className="text-sm text-muted-foreground">credits</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Audit = {CREDIT_COSTS.audit}c · Competitor sync = {CREDIT_COSTS.competitorDiscovery}c ·
            AI suggestions = {CREDIT_COSTS.aiSuggestions}c
          </p>
        </div>
      </section>

      {/* Pro plan */}
      {plan === "free" && (
        <section className="rounded-2xl bg-card border border-border p-6 md:p-8">
          <h2 className="font-display text-3xl">Pro</h2>
          <ul className="mt-6 space-y-2 text-sm">
            {[
              `${PRO_LIMITS.maxKeywordsIncluded} keywords tracked daily`,
              "1 site (extra sites with credits)",
              "Weekly AI brief auto-generated + emailed",
              "Full GSC dashboard with 90-day history",
              "Intent classification + diagnostic tags",
              "Site audit (4 credits each)",
              "Competitor discovery (20 credits per sync)",
              "AI keyword suggestions (2 credits per generation)",
              "Cancel anytime",
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

      {/* Credit packs — Pro-only add-on. Free users can still spend any balance
          they already hold, but must subscribe before buying new packs. */}
      <section>
        <h2 className="font-mono text-[10px] text-muted-foreground mb-4">
          credit packs
        </h2>
        {plan === "free" && (
          <div className="mb-4 rounded-[12px] border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
            Credit packs are a Pro add-on. Your current balance stays usable, but you'll
            need to subscribe to Pro before buying new packs.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CreditPack
            credits={50}
            price="5€"
            perCredit="0.10€"
            priceId={STRIPE_PRICES.credits50}
            disabled={plan === "free"}
          />
          <CreditPack
            credits={200}
            price="18€"
            perCredit="0.09€"
            badge="-10%"
            priceId={STRIPE_PRICES.credits200}
            disabled={plan === "free"}
          />
          <CreditPack
            credits={500}
            price="40€"
            perCredit="0.08€"
            badge="-20%"
            priceId={STRIPE_PRICES.credits500}
            disabled={plan === "free"}
          />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Credits never expire. Use them for audits, competitor discovery, AI suggestions, or
          extra sites.
        </p>
      </section>

      {/* Auto-refill settings — Pro only */}
      {plan === "pro" && (
        <section>
          <h2 className="font-mono text-[10px] text-muted-foreground mb-4 flex items-center gap-2">
            <BellRing className="h-3.5 w-3.5" strokeWidth={1.5} />
            auto-refill
          </h2>
          <div className="rounded-2xl bg-card p-6">
            <AutoRefillForm
              initialEnabled={autoRefill.enabled}
              initialThreshold={autoRefill.threshold}
              initialPackPriceId={autoRefill.packPriceId}
              creditPacks={[
                { label: "50 credits (5€)", priceId: STRIPE_PRICES.credits50 },
                { label: "200 credits (18€)", priceId: STRIPE_PRICES.credits200 },
                { label: "500 credits (40€)", priceId: STRIPE_PRICES.credits500 },
              ]}
            />
          </div>
        </section>
      )}

      {/* Referral program */}
      <section>
        <h2 className="font-mono text-[10px] text-muted-foreground mb-4 flex items-center gap-2">
          <Gift className="h-3.5 w-3.5" strokeWidth={1.5} />
          referrals
        </h2>
        <div className="rounded-2xl bg-card p-6">
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
          <h2 className="text-sm font-semibold">You're on Free</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Free includes {FREE_LIMITS.maxKeywords} keywords, 1 site, GSC dashboard read-only.
            No AI brief, no audit, no competitor discovery.
          </p>
        </section>
      )}
    </div>
  );
}

function CreditPack({
  credits,
  price,
  perCredit,
  badge,
  priceId,
  disabled,
}: {
  credits: number;
  price: string;
  perCredit: string;
  badge?: string;
  priceId: string;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card p-6 flex flex-col">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="font-display text-3xl tabular">{credits}</div>
          <div className="text-xs text-muted-foreground">credits</div>
        </div>
        {badge && (
          <span className="bg-[var(--up)]/10 text-[var(--up)] text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-6">
        <div className="font-display text-2xl">{price}</div>
        <div className="text-xs text-muted-foreground mt-0.5 font-mono tabular">
          {perCredit} / credit
        </div>
      </div>
      <div className="mt-6">
        <BuyCreditsButton priceId={priceId} label={`Buy ${credits} credits`} disabled={disabled} />
      </div>
    </div>
  );
}
