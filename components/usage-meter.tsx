import Link from "next/link";
import { db, schema } from "@/db/client";
import { eq, count } from "drizzle-orm";
import { getUserPlan } from "@/lib/billing-helpers";
import { FREE_LIMITS, PRO_LIMITS } from "@/lib/billing-constants";

export async function UsageMeter({ userId }: { userId: string }) {
  const [plan, [row]] = await Promise.all([
    getUserPlan(userId),
    db
      .select({ value: count() })
      .from(schema.keywords)
      .where(eq(schema.keywords.userId, userId)),
  ]);

  const used = row?.value ?? 0;
  const max = plan === "pro" ? PRO_LIMITS.maxKeywordsIncluded : FREE_LIMITS.maxKeywords;
  const pct = Math.min((used / max) * 100, 100);
  const isWarning = pct > 80;

  return (
    <Link
      href="/dashboard/keywords"
      className="flex items-center gap-2.5 rounded-xl bg-card border border-border px-3 py-2 hover:bg-secondary transition-colors"
    >
      {/* Tiny progress bar */}
      <div className="h-1 w-16 rounded-full bg-background overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: isWarning ? "var(--down)" : "hsl(var(--primary))",
          }}
        />
      </div>
      {/* Count */}
      <div className="flex items-center gap-1">
        <span className="font-mono text-sm font-semibold tabular-nums">
          {used}/{max}
        </span>
        <span className="text-[10px] text-muted-foreground">kw</span>
      </div>
    </Link>
  );
}
