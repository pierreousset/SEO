import { type Diagnostic, diagnosticInfo } from "@/lib/diagnostics";

const TONE_CLS: Record<string, string> = {
  good: "bg-[var(--up)]/10 text-[var(--up)]",
  warn: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  bad: "bg-[var(--down)]/10 text-[var(--down)]",
  neutral: "bg-muted text-muted-foreground",
};

export function DiagnosticBadge({ tag }: { tag: Diagnostic }) {
  const info = diagnosticInfo(tag);
  return (
    <span
      title={info.hint}
      className={`inline-block text-[10px] uppercase font-medium px-1.5 py-0.5 rounded-sm font-mono tabular ${TONE_CLS[info.tone]}`}
    >
      {info.label}
    </span>
  );
}
