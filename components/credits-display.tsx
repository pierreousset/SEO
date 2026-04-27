import Link from "next/link";
import { Coins } from "lucide-react";
import { getCreditsBalance } from "@/lib/credits";
import { getUserPlan } from "@/lib/billing-helpers";

export async function CreditsDisplay({ userId }: { userId: string }) {
  const [plan, balance] = await Promise.all([
    getUserPlan(userId),
    getCreditsBalance(userId),
  ]);

  return (
    <Link
      href="/dashboard/billing"
      className="flex items-center gap-3 rounded-xl bg-card border border-border px-3.5 py-2 hover:bg-secondary transition-colors"
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] text-muted-foreground uppercase">{plan}</span>
      </div>
      <div className="w-px h-4 bg-border" />
      <div className="flex items-center gap-1.5">
        <Coins className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        <span className="font-mono text-sm font-semibold tabular-nums">{balance}</span>
      </div>
    </Link>
  );
}
