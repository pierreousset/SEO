import { db, schema } from "@/db/client";
import { eq, and } from "drizzle-orm";

const WEBHOOK_EVENTS = [
  "position_drop",
  "audit_complete",
  "brief_ready",
  "crawl_complete",
  "alert_triggered",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

function formatSlackPayload(event: string, payload: Record<string, unknown>): Record<string, unknown> {
  const message = payload.message ?? `Event: ${event}`;
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*SEO Dashboard*\n${message}`,
        },
      },
    ],
  };
}

function formatDiscordPayload(event: string, payload: Record<string, unknown>): Record<string, unknown> {
  const message = payload.message ?? `Event: ${event}`;
  return {
    embeds: [
      {
        title: "SEO Dashboard",
        description: String(message),
        color: 11163383, // #A855F7
      },
    ],
  };
}

function formatCustomPayload(event: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  };
}

/**
 * Fire webhooks for a user and event. Fire-and-forget — errors are swallowed
 * so the caller is never blocked or broken by webhook delivery failures.
 */
export async function fireWebhook(
  userId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const hooks = await db
      .select()
      .from(schema.webhooks)
      .where(
        and(
          eq(schema.webhooks.userId, userId),
          eq(schema.webhooks.enabled, true),
        ),
      );

    // Filter to hooks that subscribe to this event
    const matching = hooks.filter((h) => {
      const events = (h.events ?? []) as string[];
      return events.includes(event);
    });

    if (matching.length === 0) return;

    const sends = matching.map(async (hook) => {
      let body: Record<string, unknown>;
      switch (hook.provider) {
        case "slack":
          body = formatSlackPayload(event, payload);
          break;
        case "discord":
          body = formatDiscordPayload(event, payload);
          break;
        default:
          body = formatCustomPayload(event, payload);
      }

      try {
        await fetch(hook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        // Swallow individual delivery failures
      }
    });

    // Fire all in parallel, don't await the overall promise in caller context
    void Promise.allSettled(sends);
  } catch {
    // Swallow — webhook delivery must never break the caller
  }
}
