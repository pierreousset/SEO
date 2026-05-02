import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

type Align = "left" | "right" | "center";

export function SortableHeader({
  field,
  label,
  align = "left",
  currentSort,
  currentDir,
  searchParams,
  className = "",
}: {
  field: string;
  label: string;
  align?: Align;
  currentSort: string | null;
  currentDir: "asc" | "desc";
  searchParams: Record<string, string | string[] | undefined>;
  className?: string;
}) {
  const isActive = currentSort === field;
  const nextDir: "asc" | "desc" =
    isActive && currentDir === "desc" ? "asc" : isActive && currentDir === "asc" ? "desc" : "desc";

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === "sort" || k === "dir") continue;
    if (typeof v === "string") params.set(k, v);
  }
  params.set("sort", field);
  params.set("dir", nextDir);

  const Icon = isActive ? (currentDir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;

  const alignCls = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "";

  return (
    <Link
      href={`?${params.toString()}`}
      scroll={false}
      className={`inline-flex items-center gap-1 text-caption text-ash-gray hover:text-ink-black transition-colors w-full ${alignCls} ${className}`}
    >
      <span>{label}</span>
      <Icon
        className={`h-3 w-3 shrink-0 ${isActive ? "text-ink-black" : "opacity-40"}`}
        strokeWidth={1.5}
      />
    </Link>
  );
}
