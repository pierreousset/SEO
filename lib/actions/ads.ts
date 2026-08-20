"use server";

import { revalidatePath } from "next/cache";
import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb } from "@/db/client";
import { decrypt } from "@/lib/encryption";
import { bootstrapAdsForUser } from "@/lib/ads-bootstrap";

export async function retryAdsImport(): Promise<{ ok: boolean; error?: string }> {
  const ctx = await resolveAccountContext();
  if (!ctx.isOwner) return { ok: false, error: "owner_only" };

  const t = tenantDb(ctx.ownerId);
  const [token] = await t.selectAdsToken();
  if (!token) return { ok: false, error: "not_connected" };

  try {
    const refreshToken = decrypt(token.encryptedRefreshToken);
    const result = await bootstrapAdsForUser(ctx.ownerId, refreshToken);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    if (result.warning === "token_test_only") {
      return {
        ok: false,
        error:
          "Le token Ads est encore en mode test. Demande l'accès Basic sur ads.google.com/aw/apicenter.",
      };
    }
    if (result.warning) return { ok: false, error: result.warning };
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "import_failed";
    console.warn("[ads] retry import failed:", err);
    return { ok: false, error: message };
  }
}
