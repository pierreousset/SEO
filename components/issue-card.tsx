"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  issueCardLabelsEN,
  type IssueCardLabels,
} from "@/lib/issue-strings";

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
const severityBadge: Record<string, string> = {
  high: "bg-hot-pink/10 text-hot-pink",
  medium: "bg-vivid-violet/10 text-vivid-violet",
  low: "bg-subtle-cream text-ash-gray",
};

export function IssueCard({
  issue,
  labels = issueCardLabelsEN,
  children,
}: {
  issue: IssueCardData;
  labels?: IssueCardLabels;
  children?: React.ReactNode;
}) {
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
          {labels.severity[issue.severity]}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{issue.description}</p>
      <div className="text-caption text-sky-teal mt-2 tabular-nums">
        {issue.impact}
      </div>

      {affectedCount > 0 && (
        <div className="text-xs text-muted-foreground mt-1.5">
          {issue.affectedPages && issue.affectedPages.length > 0 && (
            <span>&rarr; {labels.affectedPages(issue.affectedPages.length)}</span>
          )}
          {issue.affectedKeywords && issue.affectedKeywords.length > 0 && (
            <span>&rarr; {labels.affectedKeywords(issue.affectedKeywords.length)}</span>
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
          {labels.whyThisMatters}
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
