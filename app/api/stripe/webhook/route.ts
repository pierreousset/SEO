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
        await handleSubscriptionChange(event);
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
        await handleSubscriptionChange(event);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event);
        break;

      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
        // Handled implicitly via subscription.updated
        break;

      default:
        // Acknowledge but don't process
        break;
    }
  } catch (err: any) {
    console.error(`[stripe webhook] handler error for ${event.type}:`, err);
    // Return 500 so Stripe retries — better than silently dropping a payment event
    return NextResponse.json({ error: err?.message ?? "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

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
  }
  // For subscription kind, the subscription.created event handles it.
}

async function handleSubscriptionChange(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
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
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  await db
    .update(schema.subscriptions)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(eq(schema.subscriptions.id, sub.id));
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
  // We only have one plan (pro) for now. If you add tiers later, map by price ID.
  return "pro";
}
