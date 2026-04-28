"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  MessageSquare,
  ListOrdered,
  FileStack,
  FileText,
  Sparkles,
  Stethoscope,
  Tags,
  Split,
  Crosshair,
  PenTool,
  Radio,
  Briefcase,
  Users,
  CreditCard,
  Settings,
  Key,
  Zap,
  Play,
  Download,
  Plus,
} from "lucide-react";

type Item = {
  id: string;
  label: string;
  section: "Pages" | "Actions";
  href: string;
  icon: React.ReactNode;
};

const PAGES: Item[] = [
  { id: "overview", label: "Overview", section: "Pages", href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4 text-muted-foreground" /> },
  { id: "chat", label: "Chat", section: "Pages", href: "/dashboard/chat", icon: <MessageSquare className="h-4 w-4 text-muted-foreground" /> },
  { id: "keywords", label: "Keywords", section: "Pages", href: "/dashboard/keywords", icon: <ListOrdered className="h-4 w-4 text-muted-foreground" /> },
  { id: "pages", label: "Pages", section: "Pages", href: "/dashboard/pages", icon: <FileStack className="h-4 w-4 text-muted-foreground" /> },
  { id: "brief", label: "Brief", section: "Pages", href: "/dashboard/brief", icon: <FileText className="h-4 w-4 text-muted-foreground" /> },
  { id: "aeo", label: "AEO", section: "Pages", href: "/dashboard/aeo", icon: <Sparkles className="h-4 w-4 text-muted-foreground" /> },
  { id: "audit", label: "Audit", section: "Pages", href: "/dashboard/audit", icon: <Stethoscope className="h-4 w-4 text-muted-foreground" /> },
  { id: "metas", label: "Metas", section: "Pages", href: "/dashboard/audit/metas", icon: <Tags className="h-4 w-4 text-muted-foreground" /> },
  { id: "cannibalization", label: "Cannibalization", section: "Pages", href: "/dashboard/cannibalization", icon: <Split className="h-4 w-4 text-muted-foreground" /> },
  { id: "gap", label: "Gap", section: "Pages", href: "/dashboard/gap", icon: <Crosshair className="h-4 w-4 text-muted-foreground" /> },
  { id: "content", label: "Content", section: "Pages", href: "/dashboard/content", icon: <PenTool className="h-4 w-4 text-muted-foreground" /> },
  { id: "activity", label: "Activity", section: "Pages", href: "/dashboard/activity", icon: <Radio className="h-4 w-4 text-muted-foreground" /> },
  { id: "business", label: "Business", section: "Pages", href: "/dashboard/business", icon: <Briefcase className="h-4 w-4 text-muted-foreground" /> },
  { id: "team", label: "Team", section: "Pages", href: "/dashboard/team", icon: <Users className="h-4 w-4 text-muted-foreground" /> },
  { id: "billing", label: "Billing", section: "Pages", href: "/dashboard/billing", icon: <CreditCard className="h-4 w-4 text-muted-foreground" /> },
  { id: "connections", label: "Connections", section: "Pages", href: "/dashboard/connect-google", icon: <Settings className="h-4 w-4 text-muted-foreground" /> },
  { id: "api-keys", label: "API Keys", section: "Pages", href: "/dashboard/settings/api-keys", icon: <Key className="h-4 w-4 text-muted-foreground" /> },
];

const ACTIONS: Item[] = [
  { id: "action-fetch", label: "Fetch SERP now", section: "Actions", href: "/dashboard?action=fetch", icon: <Zap className="h-4 w-4 text-muted-foreground" /> },
  { id: "action-brief", label: "Generate brief", section: "Actions", href: "/dashboard/brief", icon: <Play className="h-4 w-4 text-muted-foreground" /> },
  { id: "action-audit", label: "Run audit", section: "Actions", href: "/dashboard/audit", icon: <Stethoscope className="h-4 w-4 text-muted-foreground" /> },
  { id: "action-chat", label: "New chat", section: "Actions", href: "/dashboard/chat?new=1", icon: <Plus className="h-4 w-4 text-muted-foreground" /> },
  { id: "action-export", label: "Export keywords CSV", section: "Actions", href: "/api/export/keywords", icon: <Download className="h-4 w-4 text-muted-foreground" /> },
];

const ALL_ITEMS = [...PAGES, ...ACTIONS];

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const filtered = query
    ? ALL_ITEMS.filter((item) => fuzzyMatch(query, item.label))
    : ALL_ITEMS;

  const pages = filtered.filter((i) => i.section === "Pages");
  const actions = filtered.filter((i) => i.section === "Actions");
  const flat = [...pages, ...actions];

  const select = useCallback(
    (item: Item) => {
      setOpen(false);
      setQuery("");
      setActiveIndex(0);
      if (item.href.startsWith("/api/")) {
        window.location.href = item.href;
      } else {
        router.push(item.href);
      }
    },
    [router],
  );

  // Global keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Small delay to ensure the modal is rendered
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Reset active index when filtered results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[activeIndex]) select(flat[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  if (!open) return null;

  let itemIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="mx-auto mt-[20vh] max-w-[560px] overflow-hidden rounded-2xl border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border bg-background px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages and actions..."
            className="h-12 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
          {flat.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results found.
            </div>
          )}

          {pages.length > 0 && (
            <>
              <div className="px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Pages
              </div>
              {pages.map((item) => {
                const idx = itemIndex++;
                return (
                  <button
                    key={item.id}
                    data-active={idx === activeIndex}
                    onClick={() => select(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground ${
                      idx === activeIndex ? "bg-secondary" : "hover:bg-secondary"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </>
          )}

          {actions.length > 0 && (
            <>
              <div className="px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Actions
              </div>
              {actions.map((item) => {
                const idx = itemIndex++;
                return (
                  <button
                    key={item.id}
                    data-active={idx === activeIndex}
                    onClick={() => select(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground ${
                      idx === activeIndex ? "bg-secondary" : "hover:bg-secondary"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 font-mono text-[10px] text-muted-foreground">
          <span>↑↓ navigate</span>
          <span className="mx-2">·</span>
          <span>↵ open</span>
          <span className="mx-2">·</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
