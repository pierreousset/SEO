import { getUserPlan } from "@/lib/billing-helpers";
import { guardMonthlyUsage } from "@/lib/usage";
import type { MeteredAction } from "@/lib/billing-constants";
import { getApiKeyStatus } from "@/lib/api-key-status";

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
 * Standard guard for any metered action. Enforces the flat-99€/mo fair-use
 * monthly limit for the action (no credits).
 *
 * BYOK (Bring Your Own Key) policy:
 * If the user has configured their own API key for the AI provider this action
 * uses, the fair-use limit is skipped — they pay the provider directly, so the
 * action costs us nothing. Only the subscription is required.
 *
 * Actions that use DataForSEO or other non-AI paid APIs should NOT pass
 * aiProvider — those always count against the fair-use limit regardless of BYOK.
 *
 * `credits` and `reason` are retained for backward-compatible call sites; only
 * `action` drives gating now (`credits` is ignored).
 */
export async function guardMeteredAction(opts: {
  userId: string;
  /** The metered action — drives the fair-use monthly limit. */
  action: MeteredAction;
  /** @deprecated no longer used for gating (credits removed). */
  credits?: number;
  /** @deprecated retained for call-site compatibility. */
  reason?: string;
  metadata?: Record<string, unknown>;
  /** Block free users from this action entirely. Defaults false. */
  strictProOnly?: boolean;
  /** If set, skip the fair-use limit when the user has their own key here. */
  aiProvider?: AiProvider;
}): Promise<GuardResult> {
  if (opts.strictProOnly) {
    const plan = await getUserPlan(opts.userId);
    if (plan === "free") {
      return {
        ok: false,
        error: "Abonnement requis. Passe au plan 99€/mois sur /dashboard/billing.",
      };
    }
  }

  // BYOK: user enabled "use my own keys" AND has a key for this provider → free, no limit.
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

  const usage = await guardMonthlyUsage(opts.userId, opts.action);
  if (!usage.ok) return { ok: false, error: usage.error };
  return { ok: true };
}
