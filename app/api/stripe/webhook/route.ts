import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { db, schema } from "@/db/client";
import { addCredits } from "@/lib/credits";
import { CREDIT_PACK_AMOUNTS } from "@/lib/billing-constants";
import { claimReferralReward } from "@/lib/actions/referrals";

// Stripe webhooks need the raw body to verify the signature. Disable Next.js body parsing.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[stripe webhook] signature verification failed:", err?.message);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event);
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreatedOrUpdated(event);
        // Award referral credits when a referred user subscribes
        {
          const sub = event.data.object as Stripe.Subscription;
          const subUserId =
            sub.metadata?.userId ??
            (typeof sub.customer === "string"
              ? await resolveUserFromCustomer(sub.customer)
              : null);
          if (subUserId) {
            await claimReferralReward(subUserId).catch((err) =>
              console.warn("[stripe webhook] referral claim error:", err),
            );
          }
        }
        break;

      case "customer.subscription.updated":
        await handleSubscriptionCreatedOrUpdated(event);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event);
        break;

      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(event);
        break;

      default:
        // Acknowledge but don't process — Stripe expects 200 for all events
        console.log(`[stripe webhook] unhandled event type: ${event.type}`);
        break;
    }
  } catch (err: any) {
    console.error(`[stripe webhook] handler error for ${event.type}:`, err);
    // Return 500 so Stripe retries — better than silently dropping a payment event
    return NextResponse.json({ error: err?.message ?? "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------
async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  const kind = session.metadata?.kind;

  if (!userId) {
    console.warn("[stripe webhook] checkout.session.completed missing userId metadata");
    return;
  }

  if (kind === "credits") {
    // One-time credit pack purchase
    const priceId = session.metadata?.priceId ?? "";
    const credits = CREDIT_PACK_AMOUNTS[priceId];
    if (!credits) {
      console.warn(`[stripe webhook] unknown credit pack price ${priceId}`);
      return;
    }
    await addCredits({
      userId,
      amount: credits,
      reason: "purchase",
      stripeEventId: event.id,
      metadata: {
        priceId,
        sessionId: session.id,
        amountPaid: session.amount_total,
      },
    });
    console.log(`[stripe webhook] credit pack applied: ${credits} credits for user ${userId}`);
  } else if (kind === "subscription" || session.subscription) {
    // Subscription checkout — ensure subscription row exists (race with subscription.created).
    // Retrieve the full subscription object from Stripe.
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as Stripe.Subscription | null)?.id;

    if (!subscriptionId) {
      console.warn("[stripe webhook] checkout.session.completed subscription kind but no subscription ID");
      return;
    }

    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const planFromPrice = derivePlanFromSubscription(sub);
    const periodEndUnix = (sub as any).current_period_end as number | undefined;

    await db
      .insert(schema.subscriptions)
      .values({
        id: sub.id,
        userId,
        stripeCustomerId,
        plan: planFromPrice,
        status: sub.status,
        currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      })
      .onConflictDoUpdate({
        target: schema.subscriptions.id,
        set: {
          plan: planFromPrice,
          status: sub.status,
          currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
          updatedAt: new Date(),
        },
      });
    console.log(`[stripe webhook] checkout.session.completed: upserted subscription ${sub.id} for user ${userId}`);
  }
}

// ---------------------------------------------------------------------------
// customer.subscription.created / customer.subscription.updated
// ---------------------------------------------------------------------------
async function handleSubscriptionCreatedOrUpdated(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const previousAttributes = (event.data as any).previous_attributes as Record<string, unknown> | undefined;
  const userId =
    sub.metadata?.userId ??
    (typeof sub.customer === "string"
      ? await resolveUserFromCustomer(sub.customer)
      : null);

  if (!userId) {
    console.warn(`[stripe webhook] subscription ${sub.id}: cannot resolve userId`);
    return;
  }

  const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const planFromPrice = derivePlanFromSubscription(sub);
  const periodEndUnix = (sub as any).current_period_end as number | undefined;

  // Log plan changes for debugging
  if (previousAttributes?.items) {
    console.log(`[stripe webhook] subscription ${sub.id}: plan changed to ${planFromPrice}`);
  }
  if (previousAttributes?.status) {
    console.log(`[stripe webhook] subscription ${sub.id}: status changed from ${previousAttributes.status} to ${sub.status}`);
  }
  if (previousAttributes?.cancel_at_period_end !== undefined) {
    console.log(`[stripe webhook] subscription ${sub.id}: cancelAtPeriodEnd changed to ${sub.cancel_at_period_end}`);
  }

  // Upsert: handles both created and updated in an idempotent way
  await db
    .insert(schema.subscriptions)
    .values({
      id: sub.id,
      userId,
      stripeCustomerId,
      plan: planFromPrice,
      status: sub.status,
      currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    })
    .onConflictDoUpdate({
      target: schema.subscriptions.id,
      set: {
        plan: planFromPrice,
        status: sub.status,
        currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        updatedAt: new Date(),
      },
    });

  console.log(`[stripe webhook] ${event.type}: upserted subscription ${sub.id} (status=${sub.status}, plan=${planFromPrice})`);
}

// ---------------------------------------------------------------------------
// customer.subscription.deleted
// ---------------------------------------------------------------------------
async function handleSubscriptionDeleted(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;

  await db
    .update(schema.subscriptions)
    .set({
      status: "canceled",
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(schema.subscriptions.id, sub.id));

  console.log(`[stripe webhook] subscription ${sub.id} deleted → marked as canceled`);
}

// ---------------------------------------------------------------------------
// invoice.payment_failed
// ---------------------------------------------------------------------------
async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = resolveSubscriptionIdFromInvoice(invoice);

  if (!subscriptionId) {
    // Not a subscription invoice (e.g. one-time credit pack) — nothing to update
    console.log("[stripe webhook] invoice.payment_failed: no subscription, skipping");
    return;
  }

  // Mark subscription as past_due
  await db
    .update(schema.subscriptions)
    .set({
      status: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(schema.subscriptions.id, subscriptionId));

  // Resolve user for notification
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : (invoice.customer as Stripe.Customer | Stripe.DeletedCustomer | null)?.id ?? null;
  const userId = customerId ? await resolveUserFromCustomer(customerId) : null;

  // TODO: Send email notification about failed payment
  console.warn(
    `[stripe webhook] invoice.payment_failed: subscription ${subscriptionId} → past_due` +
    (userId ? ` (user: ${userId})` : "") +
    ` | invoice: ${invoice.id}` +
    ` | attempt: ${invoice.attempt_count}`,
  );
}

// ---------------------------------------------------------------------------
// invoice.paid
// ---------------------------------------------------------------------------
async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = resolveSubscriptionIdFromInvoice(invoice);

  // Handle credit pack invoices — already handled by checkout.session.completed,
  // but verify idempotency via stripeEventId in addCredits.
  if (!subscriptionId) {
    console.log("[stripe webhook] invoice.paid: no subscription (one-time invoice), skipping");
    return;
  }

  // Determine if this is a renewal (not the first payment)
  const billingReason = invoice.billing_reason;
  const isRenewal = billingReason === "subscription_cycle";
  const isFirstPayment = billingReason === "subscription_create";

  // Use invoice period_end for the new subscription period
  const periodEnd: number | undefined = invoice.period_end ?? undefined;

  if (isRenewal || !isFirstPayment) {
    // Confirm subscription is active and update the period
    const updateFields: Record<string, unknown> = {
      status: "active",
      updatedAt: new Date(),
    };
    if (periodEnd) {
      updateFields.currentPeriodEnd = new Date(periodEnd * 1000);
    }

    await db
      .update(schema.subscriptions)
      .set(updateFields as { status: string; updatedAt: Date; currentPeriodEnd?: Date })
      .where(eq(schema.subscriptions.id, subscriptionId));

    console.log(
      `[stripe webhook] invoice.paid: subscription ${subscriptionId} confirmed active` +
      (periodEnd ? ` | new period end: ${new Date(periodEnd * 1000).toISOString()}` : "") +
      ` | billing_reason: ${billingReason}`,
    );
  } else {
    // First payment — subscription.created already handles this, but log it
    console.log(`[stripe webhook] invoice.paid: first payment for subscription ${subscriptionId}, handled by subscription.created`);
  }
}

// ---------------------------------------------------------------------------
// customer.subscription.trial_will_end
// ---------------------------------------------------------------------------
async function handleTrialWillEnd(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const userId =
    sub.metadata?.userId ??
    (typeof sub.customer === "string"
      ? await resolveUserFromCustomer(sub.customer)
      : null);

  // TODO: Send email notification about trial ending in 3 days
  console.log(
    `[stripe webhook] trial_will_end: subscription ${sub.id}` +
    (userId ? ` (user: ${userId})` : "") +
    ` | trial ends: ${sub.trial_end ? new Date((sub.trial_end as number) * 1000).toISOString() : "unknown"}`,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract subscription ID from an invoice using the dahlia API's parent field. */
function resolveSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subDetails = invoice.parent?.subscription_details;
  if (!subDetails) return null;
  const sub = subDetails.subscription;
  return typeof sub === "string" ? sub : sub?.id ?? null;
}

async function resolveUserFromCustomer(stripeCustomerId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(schema.stripeCustomers)
    .where(eq(schema.stripeCustomers.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return row?.userId ?? null;
}

function derivePlanFromSubscription(sub: Stripe.Subscription): string {
  // Map price IDs to plan tiers. Currently only "pro".
  // When adding new tiers, map by sub.items.data[0].price.id.
  const priceId = sub.items?.data?.[0]?.price?.id;
  if (priceId) {
    // Future: match against STRIPE_PRICES for tier mapping
    // For now, any active subscription = pro
    console.log(`[stripe webhook] derivePlan: priceId=${priceId} → pro`);
  }
  return "pro";
}
