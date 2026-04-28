"use client";

import { useState, useTransition } from "react";
import { Bell, Trash2, Plus, ChevronDown } from "lucide-react";
import { createAlert, deleteAlert, toggleAlert } from "@/lib/actions/alerts";

type Alert = {
  id: string;
  keywordId: string;
  condition: string;
  enabled: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date | null;
  keywordQuery: string;
};

const CONDITION_OPTIONS = [
  { value: "exits_top_3", label: "Exits top 3" },
  { value: "exits_top_10", label: "Exits top 10" },
  { value: "exits_top_20", label: "Exits top 20" },
  { value: "drops_by_5", label: "Drops by 5+ positions" },
  { value: "drops_by_10", label: "Drops by 10+ positions" },
] as const;

export function PositionAlerts({
  keywordId,
  initialAlerts,
}: {
  keywordId: string;
  initialAlerts: Alert[];
}) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleCreate(condition: string) {
    setShowDropdown(false);
    startTransition(async () => {
      const result = await createAlert(keywordId, condition);
      if (result.ok && result.id) {
        setAlerts((prev) => [
          ...prev,
          {
            id: result.id!,
            keywordId,
            condition,
            enabled: true,
            lastTriggeredAt: null,
            createdAt: new Date(),
            keywordQuery: "",
          },
        ]);
      }
    });
  }

  function handleToggle(alertId: string, enabled: boolean) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, enabled } : a)),
    );
    startTransition(async () => {
      await toggleAlert(alertId, enabled);
    });
  }

  function handleDelete(alertId: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    startTransition(async () => {
      await deleteAlert(alertId);
    });
  }

  return (
    <section className="rounded-2xl bg-card p-6 md:p-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          <h2 className="font-display text-lg">Position alerts</h2>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3.5 py-1.5 text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add alert
            <ChevronDown className="h-3 w-3" strokeWidth={2} />
          </button>
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 z-50 min-w-[220px] rounded-xl bg-background border border-border shadow-xl p-1.5">
              {CONDITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleCreate(opt.value)}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {alerts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No alerts configured. Add one to get notified when this keyword's position changes.
        </p>
      )}

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const label =
              CONDITION_OPTIONS.find((o) => o.value === alert.condition)?.label ??
              alert.condition;
            return (
              <div
                key={alert.id}
                className="flex items-center gap-3 rounded-[12px] bg-background px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(alert.id, !alert.enabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    alert.enabled ? "bg-primary" : "bg-muted"
                  }`}
                  aria-label={alert.enabled ? "Disable alert" : "Enable alert"}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      alert.enabled ? "translate-x-[18px]" : "translate-x-[3px]"
                    }`}
                  />
                </button>
                <span
                  className={`flex-1 text-sm ${
                    alert.enabled ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
                {alert.lastTriggeredAt && (
                  <span className="text-[10px] font-mono tabular text-muted-foreground">
                    last:{" "}
                    {new Date(alert.lastTriggeredAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(alert.id)}
                  className="text-muted-foreground hover:text-[var(--down)] transition-colors p-1"
                  aria-label="Delete alert"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
