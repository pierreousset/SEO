import { db, schema } from "@/db/client";
import { eq, and, desc } from "drizzle-orm";
import { sendPositionAlertEmail } from "@/lib/email/position-alert";
import { fireWebhook } from "@/lib/webhooks";

type AlertRow = typeof schema.positionAlerts.$inferSelect;

/**
 * Check all enabled alerts for a user and fire emails for any that trigger.
 * Called after daily SERP fetch saves new positions.
 */
export async function checkAndFireAlerts(userId: string): Promise<{
  checked: number;
  fired: number;
}> {
  // Load all enabled alerts for this user
  const alerts = await db
    .select()
    .from(schema.positionAlerts)
    .where(
      and(
        eq(schema.positionAlerts.userId, userId),
        eq(schema.positionAlerts.enabled, true),
      ),
    );

  if (alerts.length === 0) return { checked: 0, fired: 0 };

  // Load user email for notifications
  const [user] = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user) return { checked: alerts.length, fired: 0 };

  let fired = 0;
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";

  for (const alert of alerts) {
    // Don't re-trigger within 24h
    if (alert.lastTriggeredAt) {
      const hoursSince =
        (Date.now() - new Date(alert.lastTriggeredAt).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) continue;
    }

    // Load latest 2 positions for this keyword, ordered by date desc
    const positions = await db
      .select()
      .from(schema.positions)
      .where(
        and(
          eq(schema.positions.keywordId, alert.keywordId),
          eq(schema.positions.userId, userId),
        ),
      )
      .orderBy(desc(schema.positions.date))
      .limit(2);

    if (positions.length < 2) continue;

    const [latest, previous] = positions;
    const triggered = evaluateCondition(
      alert.condition,
      previous.position,
      latest.position,
    );

    if (!triggered) continue;

    // Load keyword name
    const [keyword] = await db
      .select({ query: schema.keywords.query })
      .from(schema.keywords)
      .where(eq(schema.keywords.id, alert.keywordId))
      .limit(1);

    await sendPositionAlertEmail({
      to: user.email,
      keyword: keyword?.query ?? "Unknown keyword",
      oldPosition: previous.position,
      newPosition: latest.position,
      condition: alert.condition,
      dashboardUrl: `${baseUrl}/dashboard/keywords/${alert.keywordId}`,
    });

    // Update lastTriggeredAt
    await db
      .update(schema.positionAlerts)
      .set({ lastTriggeredAt: new Date() })
      .where(eq(schema.positionAlerts.id, alert.id));

    // Fire webhook for alert
    void fireWebhook(userId, "alert_triggered", {
      message: `Alert: "${keyword?.query ?? "Unknown"}" ${alert.condition.replace(/_/g, " ")} (${previous.position ?? "n/a"} -> ${latest.position ?? "n/a"}).`,
      keyword: keyword?.query ?? "Unknown",
      condition: alert.condition,
      oldPosition: previous.position,
      newPosition: latest.position,
    });

    fired++;
  }

  return { checked: alerts.length, fired };
}

function evaluateCondition(
  condition: string,
  oldPosition: number | null,
  newPosition: number | null,
): boolean {
  // If either position is null (not ranked), treat as position 101 for comparison
  const oldPos = oldPosition ?? 101;
  const newPos = newPosition ?? 101;

  switch (condition) {
    case "exits_top_3":
      return oldPos <= 3 && newPos > 3;
    case "exits_top_10":
      return oldPos <= 10 && newPos > 10;
    case "exits_top_20":
      return oldPos <= 20 && newPos > 20;
    case "drops_by_5":
      return newPos - oldPos >= 5;
    case "drops_by_10":
      return newPos - oldPos >= 10;
    default:
      return false;
  }
}
