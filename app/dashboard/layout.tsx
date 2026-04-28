import { redirect } from "next/navigation";
import { resolveAccountContext } from "@/lib/account-context";
import { CreditsDisplay } from "@/components/credits-display";
import { ActiveJobsIndicator } from "@/components/active-jobs-indicator";
import { UsageMeter } from "@/components/usage-meter";
import { AccountSwitcher } from "@/components/account-switcher";
import { ExpandableSidebar } from "@/components/expandable-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { WelcomeTour } from "@/components/welcome-tour";

const NAV = [
  { href: "/dashboard", label: "Overview", iconName: "layout-dashboard" as const },
  { href: "/dashboard/chat", label: "Chat", iconName: "message-square" as const },
  { href: "/dashboard/keywords", label: "Keywords", iconName: "list-ordered" as const },
  { href: "/dashboard/pages", label: "Pages", iconName: "file-stack" as const },
  { href: "/dashboard/refresh", label: "Refresh", iconName: "rotate-cw" as const },
  { href: "/dashboard/brief", label: "Brief", iconName: "file-text" as const },
  { href: "/dashboard/aeo", label: "AEO", iconName: "sparkles" as const },
  { href: "/dashboard/audit", label: "Audit", iconName: "stethoscope" as const },
  { href: "/dashboard/audit/metas", label: "Metas", iconName: "tags" as const },
  { href: "/dashboard/cannibalization", label: "Cannibalization", iconName: "split" as const },
  { href: "/dashboard/gap", label: "Gap", iconName: "crosshair" as const },
  { href: "/dashboard/content", label: "Content", iconName: "pen-tool" as const },
  { href: "/dashboard/activity", label: "Activity", iconName: "radio" as const },
  { href: "/dashboard/business", label: "Business", iconName: "briefcase" as const },
  { href: "/dashboard/team", label: "Team", iconName: "users" as const },
  { href: "/dashboard/billing", label: "Billing", iconName: "credit-card" as const, ownerOnly: true as const },
  { href: "/dashboard/connect-google", label: "Connections", iconName: "settings" as const },
  { href: "/dashboard/settings/api-keys", label: "API Keys", iconName: "key-round" as const, ownerOnly: true as const },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let ctx: Awaited<ReturnType<typeof resolveAccountContext>>;
  try {
    ctx = await resolveAccountContext();
  } catch {
    redirect("/");
  }

  const nav = NAV.filter((item) => {
    if ("ownerOnly" in item && item.ownerOnly && !ctx.isOwner) return false;
    return true;
  });

  return (
    <div className="flex-1 flex">
      <ExpandableSidebar
        nav={nav}
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
        <div className="sticky top-0 z-30 flex items-center justify-end gap-2 md:gap-3 px-3 md:px-6 py-3 bg-background/80 backdrop-blur-sm">
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
      <CommandPalette />
      <WelcomeTour />
    </div>
  );
}
