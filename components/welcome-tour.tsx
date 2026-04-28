"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "tour_completed";

const STEPS = [
  {
    message: "Welcome! This is your SEO dashboard. Let\u2019s take a quick look around.",
    position: "top-center" as const,
  },
  {
    message: "Navigate between pages using the sidebar. Expand it for labels.",
    position: "left" as const,
  },
  {
    message: "Your credits and keyword usage are always visible here.",
    position: "top-right" as const,
  },
  {
    message: "Press Cmd+K (or Ctrl+K) to quickly search pages and actions.",
    position: "center" as const,
  },
  {
    message: "You\u2019re all set! Start by connecting Google Search Console.",
    position: "center" as const,
  },
];

const POSITION_CLASSES: Record<string, string> = {
  "top-center": "top-24 left-1/2 -translate-x-1/2",
  left: "top-1/3 left-20",
  "top-right": "top-24 right-8",
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
};

export function WelcomeTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  function next() {
    if (isLast) {
      dismiss();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Subtle overlay */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" />

      {/* Floating card */}
      <div
        className={`absolute z-50 pointer-events-auto ${POSITION_CLASSES[current.position]}`}
      >
        <div className="bg-card border border-primary/30 rounded-2xl p-5 max-w-[320px] shadow-xl">
          <p className="font-mono text-[10px] text-muted-foreground">
            {step + 1} of {STEPS.length}
          </p>
          <p className="text-sm mt-2 leading-relaxed">{current.message}</p>
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={dismiss}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
            >
              Skip
            </button>
            <button
              onClick={next}
              className="text-xs font-medium bg-primary text-primary-foreground rounded-lg px-4 py-1.5 hover:opacity-90 transition-opacity"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
