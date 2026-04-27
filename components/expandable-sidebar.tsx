"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PanelLeftOpen,
  PanelLeftClose,
  LayoutDashboard,
  ListOrdered,
  FileText,
  Settings,
  Briefcase,
  Stethoscope,
  Sparkles,
  Split,
  Crosshair,
  CreditCard,
  MessageSquare,
  FileStack,
  Tags,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "message-square": MessageSquare,
  "list-ordered": ListOrdered,
  "file-stack": FileStack,
  "file-text": FileText,
  sparkles: Sparkles,
  stethoscope: Stethoscope,
  tags: Tags,
  split: Split,
  crosshair: Crosshair,
  briefcase: Briefcase,
  users: Users,
  "credit-card": CreditCard,
  settings: Settings,
};

type NavItem = {
  href: string;
  label: string;
  iconName: string;
};

type Props = {
  nav: NavItem[];
  email: string;
  isOwner: boolean;
  accountSwitcherSlot: React.ReactNode | null;
};

export function ExpandableSidebar({
  nav,
  email,
  isOwner,
  accountSwitcherSlot,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={`${
        expanded ? "w-[220px]" : "w-16"
      } shrink-0 bg-background sticky top-0 h-screen flex flex-col transition-all duration-200 ease-out border-r border-border`}
    >
      {/* Header */}
      <div className={`flex items-center shrink-0 ${expanded ? "px-4 pt-5 pb-4 gap-3" : "justify-center pt-5 pb-4"}`}>
        <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground text-base font-bold">S</span>
        </div>
        {expanded && <span className="text-[15px] font-semibold truncate">SEO</span>}
        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 ${expanded ? "px-3" : "items-center px-0"}`}>
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors mb-2"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
        )}
        {nav.map((item) => {
          const Icon = ICON_MAP[item.iconName] ?? LayoutDashboard;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!expanded ? item.label : undefined}
              className={`flex items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ${
                expanded
                  ? "gap-2.5 px-3 py-2.5 text-[13px]"
                  : "w-10 h-10 justify-center mx-auto"
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
              {expanded && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className={`shrink-0 flex flex-col gap-2 ${expanded ? "p-3" : "items-center pb-4"}`}>
        {expanded && accountSwitcherSlot}

        {expanded ? (
          <div className="rounded-xl bg-secondary p-3">
            <div className="text-xs text-muted-foreground truncate" title={email}>
              {email}
              {!isOwner && (
                <span className="block text-[10px] mt-0.5 text-[var(--up)]">
                  Shared account
                </span>
              )}
            </div>
          </div>
        ) : (
          <div
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-[13px] font-semibold cursor-pointer"
            title={email}
            onClick={() => setExpanded(true)}
          >
            {email[0].toUpperCase()}
          </div>
        )}
      </div>
    </aside>
  );
}
