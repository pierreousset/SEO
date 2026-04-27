import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";

export class InsufficientCreditsError extends Error {
  constructor(public required: number, public available: number) {
    super(`Insufficient credits: need ${required}, have ${available}`);
    this.name = "InsufficientCreditsError";
  }
}

/** Read current balance. Lazily creates wallet row at 0 on first read. */
export async function getCreditsBalance(userId: string): Promise<number> {
  const [row] = await db
    .select()
    .from(schema.creditsWallet)
    .where(eq(schema.creditsWallet.userId, userId))
    .limit(1);
  if (row) return row.balance;
  // Lazy create
  await db.insert(schema.creditsWallet).values({ userId, balance: 0 }).onConflictDoNothing();
  return 0;
}

/**
 * Atomically debit credits and record a transaction. Throws InsufficientCreditsError
 * if balance is too low. Use this BEFORE running any expensive action — never refund
 * a successful action because the user disconnected.
 *
 * NOTE: Neon HTTP doesn't support real transactions. We use a guarded UPDATE that only
 * succeeds if balance >= amount. Race condition on concurrent debits is a known minor
 * risk for B1 (single user); upgrade to advisory locks if it ever bites.
 */
export async function debitCredits(opts: {
  userId: string;
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
}): Promise<{ newBalance: number }> {
  const { userId, amount, reason } = opts;
  if (amount <= 0) throw new Error("debitCredits amount must be positive");

  // Ensure wallet exists
  await getCreditsBalance(userId);

  const updated = await db
    .update(schema.creditsWallet)
    .set({
      balance: sql`${schema.creditsWallet.balance} - ${amount}`,
      lifetimeSpent: sql`${schema.creditsWallet.lifetimeSpent} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.creditsWallet.userId, userId),
        sql`${schema.creditsWallet.balance} >= ${amount}`,
      ),
    )
    .returning({ balance: schema.creditsWallet.balance });

  if (updated.length === 0) {
    const current = await getCreditsBalance(userId);
    throw new InsufficientCreditsError(amount, current);
  }

  await db.insert(schema.creditTransactions).values({
    id: randomUUID(),
    userId,
    amount: -amount,
    reason,
    metadata: opts.metadata ?? {},
  });

  return { newBalance: updated[0].balance };
}

/** Add credits (purchase, refund, bonus). Idempotent on stripeEventId. */
export async function addCredits(opts: {
  userId: string;
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
  stripeEventId?: string;
}): Promise<{ newBalance: number; alreadyApplied: boolean }> {
  const { userId, amount, reason } = opts;
  if (amount <= 0) throw new Error("addCredits amount must be positive");

  // Idempotency: if we already processed this event, no-op.
  if (opts.stripeEventId) {
    const existing = await db
      .select()
      .from(schema.creditTransactions)
      .where(eq(schema.creditTransactions.stripeEventId, opts.stripeEventId))
      .limit(1);
    if (existing.length > 0) {
      const balance = await getCreditsBalance(userId);
      return { newBalance: balance, alreadyApplied: true };
    }
  }

  await getCreditsBalance(userId); // lazy create
  const updated = await db
    .update(schema.creditsWallet)
    .set({
      balance: sql`${schema.creditsWallet.balance} + ${amount}`,
      lifetimePurchased: sql`${schema.creditsWallet.lifetimePurchased} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(schema.creditsWallet.userId, userId))
    .returning({ balance: schema.creditsWallet.balance });

  await db.insert(schema.creditTransactions).values({
    id: randomUUID(),
    userId,
    amount,
    reason,
    metadata: opts.metadata ?? {},
    stripeEventId: opts.stripeEventId ?? null,
  });

  return { newBalance: updated[0].balance, alreadyApplied: false };
}
