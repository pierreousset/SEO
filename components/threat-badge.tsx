import { type ThreatTier } from "@/lib/competitor-threat";

const CLS: Record<ThreatTier, { label: string; cls: string }> = {
  HIGH: { label: "HI", cls: "bg-[var(--down)]/10 text-[var(--down)]" },
  MEDIUM: { label: "MED", cls: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300" },
  LOW: { label: "LO", cls: "bg-[var(--up)]/10 text-[var(--up)]" },
};

export function ThreatBadge({ tier, reason }: { tier: ThreatTier; reason?: string }) {
  const v = CLS[tier];
  return (
    <span
      title={reason}
      className={`inline-block text-[10px] uppercase font-medium px-1.5 py-0.5 rounded-sm font-mono tabular ${v.cls}`}
    >
      {v.label}
    </span>
  );
}
