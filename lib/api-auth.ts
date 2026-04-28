import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

/**
 * Authenticate an API request via Bearer token.
 * Returns the userId if valid, null otherwise.
 * Updates lastUsedAt on successful auth.
 */
export async function authenticateApiRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const key = authHeader.slice(7);
  if (!key) return null;

  const hash = createHash("sha256").update(key).digest("hex");

  const [token] = await db
    .select()
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.keyHash, hash))
    .limit(1);

  if (!token) return null;

  // Update lastUsedAt (fire-and-forget)
  void db
    .update(schema.apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiTokens.id, token.id))
    .then(() => {});

  return token.userId;
}
