"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { ChangelogModal } from "@/components/changelog-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
import {
  PanelLeftOpen,
  PanelLeftClose,
  LogOut,
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
  RotateCw,
  Radio,
  PenTool,
  KeyRound,
  Link2,
  Menu,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "message-square": MessageSquare,
  "list-ordered": ListOrdered,
  "file-stack": FileStack,
  "file-text": FileText,
  "rotate-cw": RotateCw,
  radio: Radio,
  sparkles: Sparkles,
  stethoscope: Stethoscope,
  tags: Tags,
  split: Split,
  crosshair: Crosshair,
  briefcase: Briefcase,
  users: Users,
  "credit-card": CreditCard,
  "pen-tool": PenTool,
  "key-round": KeyRound,
  link: Link2,
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileOpen, closeMobile]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const { locale } = useLocale();

  // Shared sidebar content rendered as the <aside> inner
  const sidebarContent = (isMobile: boolean) => {
    const isExpanded = isMobile ? true : expanded;
    return (
      <>
        {/* Header */}
        <div
          className={`flex items-center shrink-0 ${
            isExpanded ? "px-4 pt-5 pb-4 gap-3" : "justify-center pt-5 pb-4"
          }`}
        >
          <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-base font-bold">S</span>
          </div>
          {isExpanded && <span className="text-[15px] font-semibold truncate">SEO</span>}
          {isExpanded && (
            <button
              onClick={() => (isMobile ? closeMobile() : setExpanded(false))}
              className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {isMobile ? (
                <X className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav
          className={`flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 ${
            isExpanded ? "px-3" : "items-center px-0"
          }`}
        >
          {!isExpanded && (
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
                title={!isExpanded ? item.label : undefined}
                onClick={isMobile ? closeMobile : undefined}
                className={`flex items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ${
                  isExpanded
                    ? "gap-2.5 px-3 py-2.5 text-[13px]"
                    : "w-10 h-10 justify-center mx-auto"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                {isExpanded && <span className="truncate">{t(`nav.${item.label.toLowerCase().replace(/ /g, "_")}`, locale) !== `nav.${item.label.toLowerCase().replace(/ /g, "_")}` ? t(`nav.${item.label.toLowerCase().replace(/ /g, "_")}`, locale) : item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div
          className={`shrink-0 flex flex-col gap-2 ${
            isExpanded ? "p-3" : "items-center pb-4"
          }`}
        >
          {isExpanded && accountSwitcherSlot}
          <div className={`flex ${isExpanded ? "gap-1" : "flex-col items-center gap-1"}`}>
            <ThemeToggle />
            <LocaleToggle />
            <ChangelogModal />
          </div>

          {isExpanded ? (
            <div className="rounded-xl bg-secondary p-3 space-y-2">
              <div className="text-xs text-muted-foreground truncate" title={email}>
                {email}
                {!isOwner && (
                  <span className="block text-[10px] mt-0.5 text-[var(--up)]">
                    Shared account
                  </span>
                )}
              </div>
              <SignOutButton />
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
      </>
    );
  };

  return (
    <>
      {/* Mobile hamburger button — fixed top-left, visible only on < md */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" strokeWidth={1.5} />
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={closeMobile}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          {/* Drawer */}
          <aside
            className="absolute top-0 left-0 h-full w-[220px] bg-background border-r border-border flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar — hidden on mobile */}
      <aside
        className={`${
          expanded ? "w-[220px]" : "w-16"
        } shrink-0 bg-background sticky top-0 h-screen hidden md:flex flex-col transition-all duration-200 ease-out border-r border-border`}
      >
        {sidebarContent(false)}
      </aside>
    </>
  );
}
