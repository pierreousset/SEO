"use client";

import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "tour_completed";

type Position =
  | "top-center"
  | "bottom-left"
  | "top-right"
  | "center";

const STEPS: Array<{
  title: string;
  message: string;
  position: Position;
}> = [
  {
    title: "Welcome! Your SEO Coach is ready.",
    message:
      "This dashboard tracks your Google rankings, spots drops before they hurt, and tells you exactly what to fix each week.",
    position: "top-center",
  },
  {
    title: "Connect Google Search Console",
    message:
      "This gives us your real search data. Click the Connections icon in the sidebar to link your GSC account.",
    position: "bottom-left",
  },
  {
    title: "Track keywords",
    message:
      "Add the keywords you want to monitor. We'll fetch their positions daily and surface trends automatically.",
    position: "top-right",
  },
  {
    title: "Your health score",
    message:
      "Once data is in, you'll see a 0-100 score with specific actions to improve. It updates after every fetch.",
    position: "center",
  },
  {
    title: "Use Cmd+K anytime",
    message:
      "Quick search for any page or action. Works everywhere in the dashboard.",
    position: "center",
  },
  {
    title: "You're ready!",
    message:
      "Start by connecting GSC. We'll take it from there.",
    position: "center",
  },
];

export function WelcomeTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, []);

  // Keep card in viewport
  useEffect(() => {
    if (!visible || !cardRef.current) return;
    const el = cardRef.current;
    const rect = el.getBoundingClientRect();
    const pad = 16;

    if (rect.right > window.innerWidth - pad) {
      el.style.transform = `translateX(-${rect.right - window.innerWidth + pad}px)`;
    } else if (rect.left < pad) {
      el.style.transform = `translateX(${pad - rect.left}px)`;
    } else {
      el.style.transform = "";
    }

    if (rect.bottom > window.innerHeight - pad) {
      el.style.marginTop = `-${rect.bottom - window.innerHeight + pad}px`;
    } else {
      el.style.marginTop = "";
    }
  }, [step, visible]);

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

  function prev() {
    if (step > 0) setStep((s) => s - 1);
  }

  const positionClasses: Record<Position, string> = {
    "top-center": "top-24 left-1/2 -translate-x-1/2",
    "bottom-left": "bottom-24 left-20",
    "top-right": "top-24 right-8",
    center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" />

      {/* Card */}
      <div
        className={`absolute z-50 pointer-events-auto ${positionClasses[current.position]}`}
      >
        <div ref={cardRef} className="bg-card border border-primary/30 rounded-2xl p-6 max-w-[360px] shadow-xl">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-5 bg-primary"
                    : i < step
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          <h3 className="text-sm font-semibold">{current.title}</h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {current.message}
          </p>

          <div className="flex items-center justify-between mt-5">
            <div className="flex items-center gap-2">
              <button
                onClick={dismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
              >
                Skip tour
              </button>
            </div>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={prev}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
                >
                  Back
                </button>
              )}
              <button
                onClick={next}
                className="text-xs font-medium bg-primary text-primary-foreground rounded-lg px-4 py-1.5 hover:opacity-90 transition-opacity"
              >
                {isLast ? "Get started" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
