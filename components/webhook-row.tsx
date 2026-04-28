"use client";

import { useTransition } from "react";
import { toggleWebhook, deleteWebhook } from "@/lib/actions/webhooks";
import { Trash2 } from "lucide-react";

export function WebhookRow({
  id,
  url,
  provider,
  events,
  enabled,
  isOwner,
}: {
  id: string;
  url: string;
  provider: string;
  events: string[];
  enabled: boolean;
  isOwner: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const providerLabel =
    provider === "slack" ? "Slack" : provider === "discord" ? "Discord" : "Custom";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary">
            {providerLabel}
          </span>
          <span
            className={`text-xs font-mono px-2 py-0.5 rounded-md ${
              enabled
                ? "bg-[var(--up)]/10 text-[var(--up)]"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {enabled ? "active" : "paused"}
          </span>
        </div>
        <p className="text-sm font-mono truncate mt-1">{url}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {events.join(", ")}
        </p>
      </div>

      {isOwner && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await toggleWebhook(id);
              })
            }
            className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary transition disabled:opacity-50"
          >
            {enabled ? "Pause" : "Enable"}
          </button>
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await deleteWebhook(id);
              })
            }
            className="p-1.5 rounded-full hover:bg-[var(--down)]/10 text-muted-foreground hover:text-[var(--down)] transition disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
