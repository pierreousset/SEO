"use client";

export function PositionHeatmap({ changes }: { changes: Array<number | null> }) {
  return (
    <div className="flex items-center gap-[2px]">
      {changes.map((delta, i) => {
        const bg =
          delta === null
            ? "bg-[#1A1A1A] border border-border"
            : delta > 0
              ? "bg-[#34D399]"
              : delta < 0
                ? "bg-[#F87171]"
                : "bg-[#2A2A2A]";
        return (
          <div
            key={i}
            className={`w-3 h-3 rounded-[3px] ${bg}`}
            title={
              delta !== null
                ? `Day ${i + 1}: ${delta > 0 ? "+" : ""}${delta}`
                : "No data"
            }
          />
        );
      })}
    </div>
  );
}
