"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { ChangelogModal } from "@/components/changelog-modal";
import { LocaleToggle } from "@/components/locale-toggle";
import { useLocale } from "@/components/locale-provider";
import { t, type Locale } from "@/lib/i18n";
import {
  PanelLeftOpen,
  PanelLeftClose,
  LayoutDashboard,
  ListOrdered,
  FileText,
  Settings,
  Stethoscope,
  Sparkles,
  Split,
  Crosshair,
  MessageSquare,
  FileStack,
  Tags,
  RotateCw,
  Radio,
  PenTool,
  Link2,
  Menu,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

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
  "pen-tool": PenTool,
  link: Link2,
  settings: Settings,
};

type NavItem = {
  href: string;
  label: string;
  iconName: string;
  group?: "main" | "tools";
};

type Props = {
  nav: NavItem[];
  email: string;
  isOwner: boolean;
  setupMode?: boolean;
  accountSwitcherSlot: React.ReactNode | null;
};

function navLabel(item: NavItem, locale: Locale) {
  const key = `nav.${item.label.toLowerCase().replace(/ /g, "_")}`;
  const translated = t(key, locale);
  return translated !== key ? translated : item.label;
}

export function ExpandableSidebar({
  nav,
  email,
  isOwner,
  setupMode = false,
  accountSwitcherSlot,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const activeHref = [...nav]
    .filter(
      (item) =>
        pathname === item.href ||
        (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

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
          <BrandMark href="/dashboard" collapsed={!isExpanded} />
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
          {(() => {
            const renderItem = (item: NavItem) => {
              const Icon = ICON_MAP[item.iconName] ?? LayoutDashboard;
              const label = navLabel(item, locale);
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!isExpanded ? label : undefined}
                  onClick={isMobile ? closeMobile : undefined}
                  className={`flex items-center rounded-full transition-colors duration-150 ease-out ${
                    isExpanded
                      ? "gap-2.5 px-3 py-2.5 text-[13px]"
                      : "w-10 h-10 justify-center mx-auto"
                  } ${
                    active
                      ? "bg-subtle-cream text-ink-black font-medium"
                      : "text-ash-gray hover:text-ink-black hover:bg-subtle-cream/70"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                  {isExpanded && <span className="truncate">{label}</span>}
                </Link>
              );
            };
            const main = nav.filter(
              (item) => (item.group ?? "main") === "main" && item.href !== "/dashboard/settings",
            );
            const tools = nav.filter((item) => item.group === "tools");
            const settings = nav.filter((item) => item.href === "/dashboard/settings");
            return (
              <>
                {main.map(renderItem)}
                {tools.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-hairline">
                    {isExpanded && (
                      <p className="px-3 pb-1.5 text-caption text-ash-gray">
                        {t("nav.tools", locale)}
                      </p>
                    )}
                    {tools.map(renderItem)}
                  </div>
                )}
                {settings.length > 0 && (
                  <div className={tools.length > 0 ? "mt-3 pt-3 border-t border-hairline" : ""}>
                    {settings.map(renderItem)}
                  </div>
                )}
              </>
            );
          })()}
        </nav>

        {/* Bottom */}
        <div
          className={`shrink-0 flex flex-col gap-2 ${
            isExpanded ? "p-3" : "items-center pb-4"
          }`}
        >
          {isExpanded && accountSwitcherSlot}
          <div className={`flex ${isExpanded ? "gap-1" : "flex-col items-center gap-1"}`}>
            <LocaleToggle />
            <ChangelogModal />
          </div>

          {isExpanded ? (
            <div className="pt-3 mt-1 border-t border-hairline flex items-start gap-2.5 px-1">
              <span
                className="size-8 rounded-full bg-ink-black text-canvas-white text-caption font-medium flex items-center justify-center shrink-0 mt-0.5"
                aria-hidden
              >
                {(email.split("@")[0]?.[0] ?? "?").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium text-ink-black truncate" title={email}>
                  {email.split("@")[0]}
                </p>
                <p className="text-caption text-ash-gray truncate">
                  {email.includes("@") ? email.slice(email.indexOf("@") + 1) : ""}
                </p>
                {!isOwner && (
                  <p className="text-caption text-sky-teal mt-0.5">{t("nav.shared_account", locale)}</p>
                )}
                <div className="mt-2">
                  <SignOutButton label={t("actions.sign_out", locale)} />
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="size-9 rounded-full bg-ink-black text-canvas-white text-caption font-medium flex items-center justify-center"
              title={email}
              onClick={() => setExpanded(true)}
            >
              {(email.split("@")[0]?.[0] ?? "?").toUpperCase()}
            </button>
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
        className="fixed top-3 left-3 z-50 md:hidden w-10 h-10 rounded-full sheet flex items-center justify-center text-muted-foreground hover:text-foreground"
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
            className="absolute top-3 left-3 h-[calc(100%-1.5rem)] w-[240px] sheet flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar — hidden on mobile */}
      <aside
        className={`${
          expanded ? "w-[240px]" : "w-16"
        } shrink-0 sheet sticky top-3 h-[calc(100vh-1.5rem)] hidden md:flex flex-col transition-all duration-200 ease-out`}
      >
        {sidebarContent(false)}
      </aside>
    </>
  );
}
