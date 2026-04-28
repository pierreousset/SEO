/**
 * Single source of truth for plans, credit costs, and free-tier quotas.
 * Edit here, all guards / UI / billing math follow.
 */

export type Plan = "free" | "pro";

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
};

/** Free tier limits — enforced in server actions before mutating data. */
export const FREE_LIMITS = {
  maxKeywords: 10,
  maxSites: 1,
  weeklyBriefEnabled: false,
  auditEnabled: false,
  competitorDiscoveryEnabled: false,
  aiSuggestionsEnabled: false,
  gscHistoryDaysMax: 30, // free tier capped at 30d history pull
};

/** Pro plan included quotas. Beyond these, user spends credits. */
export const PRO_LIMITS = {
  maxKeywordsIncluded: 100,
  maxSitesIncluded: 1,
  weeklyBriefEnabled: true,
  auditEnabled: true, // costs credits per audit
  competitorDiscoveryEnabled: true,
  aiSuggestionsEnabled: true,
  gscHistoryDaysMax: 90,
};

/**
 * Credit costs for metered actions.
 * Designed at ~2.5x markup over real cost (per pricing design doc).
 */
export const CREDIT_COSTS = {
  audit: 4, // ~$0.15 cost → 0.40€ retail
  competitorDiscovery: 20, // ~$0.75 cost → 2€ retail
  aiSuggestions: 2, // ~$0.05 cost → 0.20€ retail
  // Manual brief regeneration. Weekly cron brief is FREE (included in Pro sub).
  briefManual: 2, // ~$0.08 cost → 0.20€ retail
  contentBrief: 3, // per-keyword content brief generation (~$0.10 LLM)
  competitorGap: 15, // gap scan via DataForSEO Labs ($0.50-1)
  cannibalization: 1, // GSC fetch is free, just billing signal
  backlinks: 30, // DataForSEO Backlinks ($$$)
  aeoCheck: 10, // Perplexity/Claude/OpenAI x N keywords (~$0.30/run)
  extraSitePerMonth: 50, // 5€/mo extra site
  chatMessageOverage: 1, // per message beyond PRO_CHAT_MONTHLY_INCLUDED
  articleGeneration: 5, // full SEO article generation (~$0.15 LLM)
} as const;

/**
 * BYOK (Bring Your Own Key) mode.
 * When enabled, AI actions are free (user pays the provider directly).
 * User gets monthly DataForSEO credits included so they can still use
 * competitor discovery, gap scans, etc.
 */
export const BYOK_LIMITS = {
  monthlyDataForSeoCredits: 30, // enough for 1 competitor discovery + 1 gap scan
};

/** Chat (Haiku 4.5) quotas. Free gets a lifetime trial, Pro a monthly cap. */
export const CHAT_LIMITS = {
  freeLifetimeMessages: 10, // freemium hook — taste the feature then upgrade
  proMonthlyIncluded: 500, // ~$2.50 max API cost per Pro user per month
};

/** Stripe price IDs from env. Filled per environment. */
export const STRIPE_PRICES = {
  baseMonthly: process.env.STRIPE_PRICE_BASE_MONTHLY ?? "",
  credits50: process.env.STRIPE_PRICE_CREDITS_50 ?? "",
  credits200: process.env.STRIPE_PRICE_CREDITS_200 ?? "",
  credits500: process.env.STRIPE_PRICE_CREDITS_500 ?? "",
};

/** When user buys a credit pack, how many credits land in the wallet. */
export const CREDIT_PACK_AMOUNTS: Record<string, number> = {
  [STRIPE_PRICES.credits50]: 50,
  [STRIPE_PRICES.credits200]: 200, // +0% bonus, just bulk discount built into price
  [STRIPE_PRICES.credits500]: 500,
};
