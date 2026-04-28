import { getUserPlan } from "@/lib/billing-helpers";
import { debitCredits, InsufficientCreditsError } from "@/lib/credits";
import { getApiKeyStatus } from "@/lib/actions/api-keys";

export type GuardResult =
  | { ok: true; byok?: boolean }
  | { ok: false; error: string };

/**
 * Which AI provider an action depends on.
 * When the user has their own key for this provider, credits are skipped (BYOK).
 * Actions that use DataForSEO (not AI) should NOT pass aiProvider — they always cost credits.
 */
export type AiProvider = "anthropic" | "googleGemini" | "huggingface" | "nvidia" | "ollama" | "lmStudio";

/**
 * Standard guard for any metered action. Debits credits atomically.
 *
 * BYOK (Bring Your Own Key) policy:
 * If the user has configured their own API key for the AI provider this
 * action uses, credits are NOT debited. They pay for tokens directly to
 * the provider. Only the subscription (15€/mo) is required.
 *
 * Actions that use DataForSEO or other non-AI paid APIs should NOT pass
 * aiProvider — those always cost credits regardless of BYOK.
 */
export async function guardMeteredAction(opts: {
  userId: string;
  credits: number;
  reason: string;
  metadata?: Record<string, unknown>;
  /** Block even free users holding credits. Defaults false. */
  strictProOnly?: boolean;
  /** If set, skip credits when user has their own key for this provider. */
  aiProvider?: AiProvider;
}): Promise<GuardResult> {
  if (opts.strictProOnly) {
    const plan = await getUserPlan(opts.userId);
    if (plan === "free") {
      return {
        ok: false,
        error: "Pro subscription required. Upgrade on /dashboard/billing.",
      };
    }
  }

  // BYOK: user enabled "use my own keys" mode AND has a key for this provider → skip credits
  if (opts.aiProvider) {
    const keyStatus = await getApiKeyStatus(opts.userId);
    if (keyStatus.byokEnabled) {
      const providerMap: Record<AiProvider, boolean> = {
        anthropic: keyStatus.anthropic,
        googleGemini: keyStatus.googleGemini,
        huggingface: keyStatus.huggingface,
        nvidia: keyStatus.nvidia,
        ollama: keyStatus.ollama,
        lmStudio: keyStatus.lmStudio,
      };
      if (providerMap[opts.aiProvider]) {
        return { ok: true, byok: true };
      }
    }
  }

  if (opts.credits === 0) return { ok: true };

  try {
    await debitCredits({
      userId: opts.userId,
      amount: opts.credits,
      reason: opts.reason,
      metadata: opts.metadata,
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      const plan = await getUserPlan(opts.userId);
      const msg =
        plan === "free"
          ? `Need ${e.required} credits, you have ${e.available}. Subscribe to Pro to buy credit packs, or add your own API key in Settings.`
          : `Need ${e.required} credits, you have ${e.available}. Buy a pack on /dashboard/billing, or add your own API key in Settings.`;
      return { ok: false, error: msg };
    }
    throw e;
  }
}
