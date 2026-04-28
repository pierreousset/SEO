import { db, schema } from "@/db/client";
import { eq, and } from "drizzle-orm";
import { inngest } from "@/lib/inngest/client";

/**
 * Check if a user should receive the onboarding email sequence.
 * Conditions: user has 0 sites AND onboardingEmailSent is false.
 * If so, fire the Inngest event and set the flag.
 *
 * Called fire-and-forget from the dashboard layout — must never throw
 * in a way that breaks the page render.
 */
export async function maybeStartOnboarding(
  userId: string,
  email: string,
): Promise<void> {
  // Quick check: has onboarding already been sent?
  const [user] = await db
    .select({
      onboardingEmailSent: schema.users.onboardingEmailSent,
      name: schema.users.name,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user || user.onboardingEmailSent) return;

  // Check if the user has any sites — if they do, they're not brand new
  const sites = await db
    .select({ id: schema.sites.id })
    .from(schema.sites)
    .where(eq(schema.sites.userId, userId))
    .limit(1);

  if (sites.length > 0) {
    // User already has sites — mark flag so we don't check again, but skip emails
    await db
      .update(schema.users)
      .set({ onboardingEmailSent: true })
      .where(eq(schema.users.id, userId));
    return;
  }

  // Set flag first to prevent duplicate sends on concurrent requests
  await db
    .update(schema.users)
    .set({ onboardingEmailSent: true })
    .where(
      and(
        eq(schema.users.id, userId),
        eq(schema.users.onboardingEmailSent, false),
      ),
    );

  // Fire the Inngest event to start the onboarding sequence
  await inngest.send({
    name: "onboarding/welcome",
    data: { userId, email, name: user.name },
  });
}
