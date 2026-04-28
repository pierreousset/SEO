/**
 * Cached wrapper around the API key status lookup.
 *
 * React cache() deduplicates within a single server render, so multiple calls
 * to getCachedApiKeyStatus(userId) in the same request share one DB query.
 *
 * The raw getApiKeyStatus lives in lib/actions/api-keys.ts (a "use server" file),
 * so it can't use React cache() directly. This module provides the cached version
 * for use in server components and non-action server code.
 */
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export const getApiKeyStatus = cache(async (userId: string) => {
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
});
