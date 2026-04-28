"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAccountContext } from "@/lib/account-context";
import { encrypt, decrypt } from "@/lib/encryption";

/**
 * Upsert user-provided API keys. Only the account owner may call this.
 * Empty strings are treated as "remove this key" (set to null).
 */
export async function saveApiKeys(formData: FormData) {
  const ctx = await requireAccountContext();
  if (!ctx.isOwner) redirect("/dashboard");

  const encryptedFields = ["anthropicKey", "googleGeminiKey", "huggingfaceKey", "nvidiaKey", "ollamaKey"] as const;

  const values: Record<string, string | null> = {};
  for (const field of encryptedFields) {
    const raw = (formData.get(field) ?? "").toString().trim();
    values[field] = raw.length > 0 ? encrypt(raw) : null;
  }

  // Plain text fields (URLs + model names — not secrets)
  const ollamaUrl = (formData.get("ollamaUrl") ?? "").toString().trim() || null;
  const ollamaModel = (formData.get("ollamaModel") ?? "").toString().trim() || null;
  const lmStudioUrl = (formData.get("lmStudioUrl") ?? "").toString().trim() || null;
  const lmStudioModel = (formData.get("lmStudioModel") ?? "").toString().trim() || null;
  const byokEnabled = formData.get("byokEnabled") === "on";

  await db
    .insert(schema.userApiKeys)
    .values({
      userId: ctx.ownerId,
      anthropicKey: values.anthropicKey,
      googleGeminiKey: values.googleGeminiKey,
      huggingfaceKey: values.huggingfaceKey,
      nvidiaKey: values.nvidiaKey,
      ollamaKey: values.ollamaKey,
      ollamaUrl,
      ollamaModel,
      lmStudioUrl,
      lmStudioModel,
      byokEnabled,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.userApiKeys.userId,
      set: {
        anthropicKey: values.anthropicKey,
        googleGeminiKey: values.googleGeminiKey,
        huggingfaceKey: values.huggingfaceKey,
        nvidiaKey: values.nvidiaKey,
        ollamaKey: values.ollamaKey,
        ollamaUrl,
        ollamaModel,
        lmStudioUrl,
        lmStudioModel,
        byokEnabled,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/settings/api-keys");
}

/**
 * Decrypt and return all keys for a user. INTERNAL USE ONLY — never
 * expose to client components.
 */
export async function getDecryptedApiKeys(userId: string) {
  const [row] = await db
    .select()
    .from(schema.userApiKeys)
    .where(eq(schema.userApiKeys.userId, userId))
    .limit(1);

  if (!row) {
    return {
      anthropicKey: null as string | null,
      googleGeminiKey: null as string | null,
      huggingfaceKey: null as string | null,
      nvidiaKey: null as string | null,
      ollamaKey: null as string | null,
      ollamaUrl: null as string | null,
      ollamaModel: null as string | null,
      lmStudioUrl: null as string | null,
      lmStudioModel: null as string | null,
    };
  }

  return {
    anthropicKey: row.anthropicKey ? decrypt(row.anthropicKey) : null,
    googleGeminiKey: row.googleGeminiKey ? decrypt(row.googleGeminiKey) : null,
    huggingfaceKey: row.huggingfaceKey ? decrypt(row.huggingfaceKey) : null,
    nvidiaKey: row.nvidiaKey ? decrypt(row.nvidiaKey) : null,
    ollamaKey: row.ollamaKey ? decrypt(row.ollamaKey) : null,
    ollamaUrl: row.ollamaUrl,
    ollamaModel: row.ollamaModel,
    lmStudioUrl: row.lmStudioUrl,
    lmStudioModel: row.lmStudioModel,
  };
}

/**
 * Return which keys are configured (boolean per provider). Safe for client.
 */
export async function getApiKeyStatus(userId: string) {
  const [row] = await db
    .select()
    .from(schema.userApiKeys)
    .where(eq(schema.userApiKeys.userId, userId))
    .limit(1);

  return {
    anthropic: !!row?.anthropicKey,
    googleGemini: !!row?.googleGeminiKey,
    huggingface: !!row?.huggingfaceKey,
    nvidia: !!row?.nvidiaKey,
    ollama: !!(row?.ollamaKey || row?.ollamaUrl),
    lmStudio: !!row?.lmStudioUrl,
    byokEnabled: row?.byokEnabled ?? false,
  };
}
