import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb } from "@/db/client";
import { DiscoverTabs } from "@/components/discover-tabs";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);
  const [gscToken, sites] = await Promise.all([t.selectGscToken(), t.selectSites()]);

  if (gscToken.length === 0) {
    return (
      <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto">
        <h1 className="font-display text-[32px] mb-4">Discover</h1>
        <div className="rounded-2xl bg-secondary p-8 text-sm">
          Connect Google Search Console first to discover untracked keywords.
        </div>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto">
        <h1 className="font-display text-[32px] mb-4">Discover</h1>
        <div className="rounded-2xl bg-secondary p-8 text-sm">
          No site registered yet. Re-connect GSC to auto-import your site.
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 lg:px-12 py-10 max-w-[1400px] mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/keywords"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to keywords
        </Link>
        <h1 className="font-display text-[40px] mt-3">Discover</h1>
        <p className="mt-3 text-base text-muted-foreground max-w-2xl">
          Three sources to expand your tracked keyword list: your own Search Console queries,
          what your declared competitors rank for, and AI-generated candidates from your
          business context. Select + add in bulk.
        </p>
      </div>

      <DiscoverTabs />
    </div>
  );
}
