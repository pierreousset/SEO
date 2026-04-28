"use client";

export function PositionSparkline({ positions }: { positions: number[] }) {
  if (positions.length < 2)
    return <span className="text-[10px] text-muted-foreground">—</span>;

  const min = Math.min(...positions);
  const max = Math.max(...positions);
  const range = max - min || 1;
  const h = 24;
  const w = 64;

  // Invert Y: position 1 should be at top (lower position = better = higher on chart)
  const points = positions
    .map((p, i) => {
      const x = (i / (positions.length - 1)) * w;
      const y = ((p - min) / range) * (h - 4) + 2; // position 1 → top
      return `${x},${y}`;
    })
    .join(" ");

  const trending = positions[positions.length - 1] <= positions[0]; // lower position = better
  const color = trending ? "#34D399" : "#F87171";

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
