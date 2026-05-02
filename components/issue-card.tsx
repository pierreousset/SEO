"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export type IssueCardData = {
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  impact: string;
  whyItMatters?: string;
  affectedPages?: string[];
  affectedKeywords?: string[];
};

// Severity badge per Acctual: pill, brand-palette colors only.
// high = hot-pink (loud), medium = ash-gray (neutral), low = ash-gray.
const severityBadge: Record<string, string> = {
  high: "bg-hot-pink/10 text-hot-pink",
  medium: "bg-subtle-cream text-deep-slate",
  low: "bg-subtle-cream text-ash-gray",
};

const severityLabel: Record<string, string> = {
  high: "high",
  medium: "medium",
  low: "low",
};

export function IssueCard({ issue, children }: { issue: IssueCardData; children?: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  const affectedCount =
    (issue.affectedPages?.length ?? 0) + (issue.affectedKeywords?.length ?? 0);

  return (
    <div className="bg-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm font-semibold leading-snug">{issue.title}</div>
        <span
          className={`shrink-0 inline-block text-caption px-2.5 py-0.5 rounded-full ${severityBadge[issue.severity]}`}
        >
          {severityLabel[issue.severity]}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{issue.description}</p>
      <div className="text-caption text-sky-teal mt-2 tabular-nums">
        {issue.impact}
      </div>

      {affectedCount > 0 && (
        <div className="text-xs text-muted-foreground mt-1.5">
          {issue.affectedPages && issue.affectedPages.length > 0 && (
            <span>&rarr; {issue.affectedPages.length} page{issue.affectedPages.length !== 1 ? "s" : ""}</span>
          )}
          {issue.affectedKeywords && issue.affectedKeywords.length > 0 && (
            <span>&rarr; {issue.affectedKeywords.length} keyword{issue.affectedKeywords.length !== 1 ? "s" : ""}</span>
          )}
        </div>
      )}

      {issue.whyItMatters && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-3 transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
          ) : (
            <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
          )}
          Why this matters
        </button>
      )}
      {expanded && issue.whyItMatters && (
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed pl-4 border-l border-border">
          {issue.whyItMatters}
        </p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
