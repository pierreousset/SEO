import Link from "next/link";

export function BrandMark({
  href = "/",
  collapsed = false,
}: {
  href?: string;
  collapsed?: boolean;
}) {
  const mark = collapsed ? (
    <span className="text-[15px] font-semibold tracking-tight text-ink-black">240</span>
  ) : (
    <span className="flex items-baseline gap-1.5 min-w-0">
      <span className="text-[15px] font-semibold tracking-tight text-ink-black">240</span>
      <span className="text-[13px] font-medium tracking-tight text-ash-gray">seo</span>
    </span>
  );

  if (!href) return mark;

  return (
    <Link href={href} className="min-w-0 shrink-0" aria-label="240 seo">
      {mark}
    </Link>
  );
}
