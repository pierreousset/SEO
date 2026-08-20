import { redirect } from "next/navigation";
import { resolveAccountContext } from "@/lib/account-context";
import { processReferralCookie } from "@/lib/actions/referrals";
import { maybeStartOnboarding } from "@/lib/onboarding-trigger";
import { CreditsDisplay } from "@/components/credits-display";
import { ActiveJobsIndicator } from "@/components/active-jobs-indicator";
import { UsageMeter } from "@/components/usage-meter";
import { AccountSwitcher } from "@/components/account-switcher";
import { ExpandableSidebar } from "@/components/expandable-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { tenantDb } from "@/db/client";

const NAV = [
  { href: "/dashboard", label: "Overview", iconName: "layout-dashboard" as const, group: "main" as const },
  { href: "/dashboard/keywords", label: "Keywords", iconName: "list-ordered" as const, group: "main" as const },
  { href: "/dashboard/pages", label: "Pages", iconName: "file-stack" as const, group: "main" as const },
  { href: "/dashboard/brief", label: "Brief", iconName: "file-text" as const, group: "main" as const },
  { href: "/dashboard/audit", label: "Audit", iconName: "stethoscope" as const, group: "main" as const },
  { href: "/dashboard/chat", label: "Chat", iconName: "message-square" as const, group: "tools" as const },
  { href: "/dashboard/refresh", label: "Refresh", iconName: "rotate-cw" as const, group: "tools" as const },
  { href: "/dashboard/aeo", label: "AEO", iconName: "sparkles" as const, group: "tools" as const },
  { href: "/dashboard/audit/metas", label: "Metas", iconName: "tags" as const, group: "tools" as const },
  { href: "/dashboard/internal-links", label: "Links", iconName: "link" as const, group: "tools" as const },
  { href: "/dashboard/cannibalization", label: "Cannibalization", iconName: "split" as const, group: "tools" as const },
  { href: "/dashboard/gap", label: "Gap", iconName: "crosshair" as const, group: "tools" as const },
  { href: "/dashboard/content", label: "Content", iconName: "pen-tool" as const, group: "tools" as const },
  { href: "/dashboard/activity", label: "Activity", iconName: "radio" as const, group: "tools" as const },
  { href: "/dashboard/settings", label: "Settings", iconName: "settings" as const, group: "main" as const },
];

const SETUP_HREFS = new Set(["/dashboard", "/dashboard/keywords", "/dashboard/settings"]);

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let ctx: Awaited<ReturnType<typeof resolveAccountContext>>;
  try {
    ctx = await resolveAccountContext();
  } catch {
    redirect("/");
  }

  // Process referral cookie (fire-and-forget, non-blocking)
  processReferralCookie().catch(() => {});

  // Fire onboarding email sequence for new users (fire-and-forget)
  maybeStartOnboarding(ctx.sessionUserId, ctx.sessionUserEmail).catch(() => {});

  const t = tenantDb(ctx.ownerId);
  const [gsc] = await t.selectGscToken();
  const setupMode = !gsc;

  const nav = NAV.filter((item) => {
    if ("ownerOnly" in item && item.ownerOnly && !ctx.isOwner) return false;
    if (setupMode && !SETUP_HREFS.has(item.href)) return false;
    return true;
  });

  return (
    <div className="flex-1 flex dashboard-shell md:p-3 md:gap-3">
      <ExpandableSidebar
        nav={nav}
        setupMode={setupMode}
        email={ctx.sessionUserEmail}
        isOwner={ctx.isOwner}
        accountSwitcherSlot={
          ctx.accounts.length > 1 ? (
            <AccountSwitcher accounts={ctx.accounts} activeOwnerId={ctx.ownerId} />
          ) : null
        }
      />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar — credits + jobs indicator, fixed top-right */}
        <div className="sticky top-0 z-30 flex items-center justify-end gap-2 md:gap-3 px-5 md:px-8 py-4 bg-background/80 backdrop-blur-sm md:rounded-[28px]">
          {/* Leave space for mobile hamburger button */}
          <div className="md:hidden w-10 shrink-0" />
          <ActiveJobsIndicator />
          <div className="hidden md:flex">
            <UsageMeter userId={ctx.ownerId} />
          </div>
          <CreditsDisplay userId={ctx.ownerId} />
        </div>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <CommandPalette setupMode={setupMode} />
    </div>
  );
}
