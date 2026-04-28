"use client";

export function DecayMiniChart({ weeks }: { weeks: number[] }) {
  const max = Math.max(...weeks, 1);
  return (
    <div className="flex items-end gap-1 h-6">
      {weeks.map((v, i) => (
        <div
          key={i}
          className="w-3 rounded-sm bg-[var(--down)]"
          style={{
            height: `${(v / max) * 100}%`,
            opacity: 0.4 + (i / weeks.length) * 0.6,
          }}
        />
      ))}
    </div>
  );
}
