"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";
import { STRIPE_PRICES } from "@/lib/billing-constants";
import { getStripeCustomerIdForUser, getUserPlan } from "@/lib/billing-helpers";
import { requireAccountContext } from "@/lib/account-context";

/** Billing actions always operate on the logged-in user's OWN account, never a team account. */
async function requireOwnerContext() {
  const ctx = await requireAccountContext();
  if (!ctx.isOwner) {
    throw new Error("Only the account owner can manage billing.");
  }
  return ctx;
}

function appUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3100";
}

/**
 * Subscribe to the Pro plan — opens Stripe Checkout in subscription mode.
 * Returns the URL for the client to redirect to.
 */
export async function startProCheckout(): Promise<{ url: string }> {
  const ctx = await requireOwnerContext();
  if (!STRIPE_PRICES.baseMonthly) {
    throw new Error("STRIPE_PRICE_BASE_MONTHLY not configured");
  }

  const existingCustomerId = await getStripeCustomerIdForUser(ctx.sessionUserId);
  const customerId = await getOrCreateStripeCustomer({
    userId: ctx.sessionUserId,
    email: ctx.sessionUserEmail,
    existingCustomerId,
  });

  // Persist customer mapping if new
  if (!existingCustomerId) {
    await db.insert(schema.stripeCustomers).values({
      userId: ctx.sessionUserId,
      stripeCustomerId: customerId,
      email: ctx.sessionUserEmail,
    }).onConflictDoNothing();
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: STRIPE_PRICES.baseMonthly, quantity: 1 }],
    success_url: `${appUrl()}/dashboard/billing?status=success`,
    cancel_url: `${appUrl()}/dashboard/billing?status=cancelled`,
    allow_promotion_codes: true,
    automatic_tax: { enabled: false },
    metadata: { userId: ctx.sessionUserId, kind: "subscription" },
    subscription_data: {
      metadata: { userId: ctx.sessionUserId },
    },
  });

  if (!checkout.url) throw new Error("Stripe didn't return a checkout URL");
  return { url: checkout.url };
}

/**
 * Buy a credit pack (one-time payment).
 */
export async function startCreditsCheckout(
  packPriceId: string,
): Promise<{ url: string }> {
  const ctx = await requireOwnerContext();

  // Credit packs are a Pro-only add-on. A free user (or cancelled Pro) can
  // still SPEND their existing balance, but can't top up until they re-sub.
  const plan = await getUserPlan(ctx.sessionUserId);
  if (plan === "free") {
    throw new Error(
      "Credit packs are a Pro add-on. Subscribe to Pro first, then you can buy packs.",
    );
  }

  // Defensive: only allow our 3 known pack price ids
  const allowed = [
    STRIPE_PRICES.credits50,
    STRIPE_PRICES.credits200,
    STRIPE_PRICES.credits500,
  ].filter(Boolean);
  if (!allowed.includes(packPriceId)) throw new Error("Unknown credit pack");

  const existingCustomerId = await getStripeCustomerIdForUser(ctx.sessionUserId);
  const customerId = await getOrCreateStripeCustomer({
    userId: ctx.sessionUserId,
    email: ctx.sessionUserEmail,
    existingCustomerId,
  });

  if (!existingCustomerId) {
    await db.insert(schema.stripeCustomers).values({
      userId: ctx.sessionUserId,
      stripeCustomerId: customerId,
      email: ctx.sessionUserEmail,
    }).onConflictDoNothing();
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: packPriceId, quantity: 1 }],
    success_url: `${appUrl()}/dashboard/billing?status=credits_added`,
    cancel_url: `${appUrl()}/dashboard/billing?status=cancelled`,
    metadata: { userId: ctx.sessionUserId, kind: "credits", priceId: packPriceId },
    payment_intent_data: {
      metadata: { userId: ctx.sessionUserId, kind: "credits", priceId: packPriceId },
    },
  });

  if (!checkout.url) throw new Error("Stripe didn't return a checkout URL");
  return { url: checkout.url };
}

/**
 * Stripe-hosted Billing Portal — user manages payment method, cancels sub, sees history.
 */
export async function openBillingPortal(): Promise<{ url: string }> {
  const ctx = await requireOwnerContext();
  const customerId = await getStripeCustomerIdForUser(ctx.sessionUserId);
  if (!customerId) throw new Error("No Stripe customer yet — subscribe first");

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl()}/dashboard/billing`,
  });
  return { url: portal.url };
}
