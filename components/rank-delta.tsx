import { ArrowUp, ArrowDown, Minus } from "lucide-react";

export function RankDelta({ value }: { value: number | null }) {
  if (value === null || value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground font-mono tabular">
        <Minus className="h-3 w-3" strokeWidth={1.5} />
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono tabular ${
        up ? "text-[var(--up)]" : "text-[var(--down)]"
      }`}
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {Math.abs(value)}
    </span>
  );
}
