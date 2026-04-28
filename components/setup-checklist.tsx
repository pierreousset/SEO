"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X } from "lucide-react";

const DISMISS_KEY = "setup_checklist_dismissed";

export type ChecklistStep = {
  label: string;
  done: boolean;
};

export function SetupChecklist({ steps }: { steps: ChecklistStep[] }) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(DISMISS_KEY);
    setDismissed(stored === "1");
  }, []);

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (dismissed || allDone) return null;

  const pct = Math.round((doneCount / steps.length) * 100);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="rounded-2xl bg-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm font-semibold">Getting started</h2>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {doneCount}/{steps.length}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
          >
            {collapsed ? (
              <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
            )}
          </button>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Dismiss checklist"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-6 pb-3">
        <div className="h-1.5 rounded-full bg-background overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      {!collapsed && (
        <ul className="px-2 pb-2">
          {steps.map((step, i) => (
            <li
              key={i}
              className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
            >
              <div className="shrink-0">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-[var(--up)]" strokeWidth={2} />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                )}
              </div>
              <span
                className={`text-sm ${
                  step.done
                    ? "text-muted-foreground line-through"
                    : "font-medium"
                }`}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
