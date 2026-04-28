"use client";

import { useTransition, useState } from "react";
import { addWebhook } from "@/lib/actions/webhooks";

const PROVIDERS = [
  { value: "slack", label: "Slack" },
  { value: "discord", label: "Discord" },
  { value: "custom", label: "Custom (JSON POST)" },
] as const;

const EVENTS = [
  { value: "position_drop", label: "Position drop" },
  { value: "audit_complete", label: "Audit complete" },
  { value: "brief_ready", label: "Brief ready" },
  { value: "crawl_complete", label: "Crawl complete" },
  { value: "alert_triggered", label: "Alert triggered" },
] as const;

export function WebhookForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await addWebhook(formData);
      if (result && "error" in result) {
        setError(result.error ?? "Unknown error");
      } else {
        setSuccess(true);
        // Reset form after short delay
        setTimeout(() => setSuccess(false), 2000);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Webhook URL
          </label>
          <input
            name="url"
            type="url"
            required
            placeholder="https://hooks.slack.com/services/..."
            className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Provider
          </label>
          <select
            name="provider"
            required
            className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-2">
          Events
        </label>
        <div className="flex flex-wrap gap-3">
          {EVENTS.map((e) => (
            <label
              key={e.value}
              className="inline-flex items-center gap-1.5 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                name="events"
                value={e.value}
                className="rounded border-border text-primary focus:ring-primary/40"
              />
              {e.label}
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs text-[var(--down)]">{error}</p>
      )}
      {success && (
        <p className="text-xs text-[var(--up)]">Webhook added.</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium hover:opacity-85 transition disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add Webhook"}
      </button>
    </form>
  );
}
