const STAGES: Record<number, { label: string; cls: string; title: string }> = {
  1: {
    label: "S1",
    cls: "bg-muted text-muted-foreground",
    title: "Stage 1 — problem-unaware (low immediate revenue)",
  },
  2: {
    label: "S2",
    cls: "bg-muted text-muted-foreground",
    title: "Stage 2 — problem-aware / informational",
  },
  3: {
    label: "S3",
    cls: "bg-primary/10 text-primary",
    title: "Stage 3 — solution-aware / comparing options",
  },
  4: {
    label: "S4",
    cls: "bg-[var(--up)]/10 text-[var(--up)] font-semibold",
    title: "Stage 4 — ready to hire (highest revenue intent)",
  },
};

export function IntentStageBadge({ stage }: { stage: number | null }) {
  if (!stage) {
    return (
      <span className="text-[10px] uppercase font-mono tabular text-muted-foreground" title="Not classified yet">
        —
      </span>
    );
  }
  const v = STAGES[stage];
  if (!v) return null;
  return (
    <span
      title={v.title}
      className={`inline-block text-[10px] uppercase font-medium px-1.5 py-0.5 rounded-sm font-mono tabular ${v.cls}`}
    >
      {v.label}
    </span>
  );
}
