"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateEmailDigestSettings } from "@/lib/actions/business";
import { toast } from "sonner";

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "off", label: "Off" },
] as const;

const SECTION_OPTIONS = [
  { value: "health_score", label: "Health score & trend" },
  { value: "top_issues", label: "Top issues this period" },
  { value: "position_changes", label: "Position changes (movers up/down)" },
  { value: "brief_summary", label: "Brief summary" },
  { value: "content_decay", label: "Content decay alerts" },
  { value: "competitor_keywords", label: "New competitor keywords" },
] as const;

type Props = {
  currentFrequency: string;
  currentSections: string[];
};

export function EmailDigestForm({ currentFrequency, currentSections }: Props) {
  const [pending, start] = useTransition();
  const [frequency, setFrequency] = useState(currentFrequency);
  const [sections, setSections] = useState<string[]>(currentSections);

  function toggleSection(value: string) {
    setSections((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateEmailDigestSettings(frequency, sections);
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Email digest settings saved.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Frequency */}
      <div>
        <p className="text-sm font-medium mb-2">Frequency</p>
        <div className="flex flex-wrap gap-2">
          {FREQUENCY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFrequency(opt.value)}
              className={`px-4 py-2 rounded-full text-xs font-medium border transition-colors ${
                frequency === opt.value
                  ? "bg-primary text-white border-primary"
                  : "bg-transparent text-foreground border-border hover:bg-secondary/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {frequency === "daily" && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Daily digests are coming soon. Currently runs on the weekly schedule.
          </p>
        )}
        {frequency === "monthly" && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Monthly digest sends on the first Monday of each month.
          </p>
        )}
      </div>

      {/* Sections */}
      {frequency !== "off" && (
        <div>
          <p className="text-sm font-medium mb-2">Sections to include</p>
          <div className="space-y-2">
            {SECTION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={sections.includes(opt.value)}
                  onChange={() => toggleSection(opt.value)}
                  className="accent-primary h-4 w-4"
                />
                <span className="text-sm text-foreground group-hover:text-foreground/80">
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save digest settings"}
        </Button>
      </div>
    </form>
  );
}
