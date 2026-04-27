import Stripe from "stripe";

// Lazy: don't throw at import time (breaks `next build` before env is set in CI).
// The Stripe client lets you construct with any string; calls fail at runtime
// with a clear "Invalid API key" error if the key is bogus.
export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY ?? "sk_test_dev_only_placeholder",
  { apiVersion: "2026-03-25.dahlia", typescript: true },
);

export const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

/** Get or create the Stripe customer for a user. Lazy — only call before first checkout. */
export async function getOrCreateStripeCustomer(opts: {
  userId: string;
  email: string;
  existingCustomerId: string | null;
}): Promise<string> {
  if (opts.existingCustomerId) return opts.existingCustomerId;
  const customer = await stripe.customers.create({
    email: opts.email,
    metadata: { userId: opts.userId },
  });
  return customer.id;
}
