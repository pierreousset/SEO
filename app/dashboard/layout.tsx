import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { LayoutDashboard, ListOrdered, FileText, Settings, Briefcase, Stethoscope, LogOut } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/keywords", label: "Keywords", icon: ListOrdered },
  { href: "/dashboard/brief", label: "Brief", icon: FileText },
  { href: "/dashboard/audit", label: "Audit", icon: Stethoscope },
  { href: "/dashboard/business", label: "Business", icon: Briefcase },
  { href: "/dashboard/connect-google", label: "Connections", icon: Settings },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  return (
    <div className="flex-1 flex">
      <aside className="w-64 shrink-0 border-r border-border bg-background flex flex-col">
        <div className="px-6 py-6">
          <span className="font-display text-xl">SEO Dashboard</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <item.icon className="h-4 w-4" strokeWidth={1.5} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4">
          <div className="rounded-[20px] bg-secondary p-4">
            <div className="mb-3 text-xs text-muted-foreground truncate" title={session.user.email}>
              {session.user.email}
            </div>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
