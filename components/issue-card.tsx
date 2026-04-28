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

const severityColor: Record<string, string> = {
  high: "#F87171",
  medium: "#FBBF24",
  low: "#71717A",
};

const severityDot: Record<string, string> = {
  high: "bg-[#F87171]",
  medium: "bg-[#FBBF24]",
  low: "bg-[#71717A]",
};

export function IssueCard({ issue }: { issue: IssueCardData }) {
  const [expanded, setExpanded] = useState(false);

  const affectedCount =
    (issue.affectedPages?.length ?? 0) + (issue.affectedKeywords?.length ?? 0);

  return (
    <div
      className="bg-card rounded-2xl p-5"
      style={{ borderLeft: `3px solid ${severityColor[issue.severity]}` }}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1.5 shrink-0 h-2 w-2 rounded-full ${severityDot[issue.severity]}`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{issue.title}</div>
          <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
          <div className="font-mono text-[11px] text-[var(--up)] mt-2">
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
        </div>
      </div>
    </div>
  );
}
