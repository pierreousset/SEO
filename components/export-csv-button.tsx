"use client";

import { Download } from "lucide-react";

export function ExportCsvButton({
  type,
  label,
}: {
  type: string;
  label?: string;
}) {
  return (
    <a
      href={`/api/export/${type}`}
      download
      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full border border-border bg-background hover:bg-muted/40 transition-colors"
    >
      <Download className="h-3 w-3" strokeWidth={1.5} />
      {label ?? "Export CSV"}
    </a>
  );
}
