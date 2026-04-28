"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  keywords: "Keywords",
  discover: "Discover",
  brief: "Brief",
  audit: "Audit",
  metas: "Metas",
  aeo: "AEO",
  cannibalization: "Cannibalization",
  gap: "Gap",
  chat: "Chat",
  billing: "Billing",
  business: "Business",
  team: "Team",
  content: "Content",
  backlinks: "Backlinks",
  activity: "Activity",
  refresh: "Refresh",
  pages: "Pages",
  settings: "Settings",
  "api-keys": "API Keys",
  "connect-google": "Connections",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Don't show on root dashboard
  if (segments.length <= 1) return null;

  // Build crumbs: /dashboard → /dashboard/keywords → /dashboard/keywords/[id]
  const crumbs = segments.map((seg, i) => ({
    label: LABELS[seg] ?? seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav className="flex items-center gap-1 text-[11px] text-muted-foreground mb-4">
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          {c.isLast ? (
            <span className="text-foreground font-medium">{c.label}</span>
          ) : (
            <Link href={c.href} className="hover:text-foreground transition-colors">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
