import Link from "next/link";
import { getUserPlan } from "@/lib/billing-helpers";

// Flat 99€/mo plan, no credits: the nav pill just shows the current plan and
// links to billing. (File/name kept so the layout import stays stable.)
export async function CreditsDisplay({ userId }: { userId: string }) {
  const plan = await getUserPlan(userId);

  return (
    <Link
      href="/dashboard/billing"
      className="flex items-center gap-2 rounded-full bg-card px-3.5 py-2 hover:bg-subtle-cream transition-colors duration-150 ease-out"
    >
      <span className="text-caption text-ash-gray uppercase">{plan}</span>
      {plan === "free" && (
        <span className="hidden md:inline text-xs text-sky-teal">Pro</span>
      )}
    </Link>
  );
}
