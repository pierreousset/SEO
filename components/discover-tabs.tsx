"use client";

import { useState } from "react";
import { Search, Users, Sparkles } from "lucide-react";
import { DiscoverKeywords } from "@/components/discover-keywords";
import { DiscoverCompetitors } from "@/components/discover-competitors";
import { DiscoverAi } from "@/components/discover-ai";

const TABS = [
  {
    id: "gsc",
    label: "From GSC",
    icon: Search,
    desc: "Queries you appear for but don't track",
  },
  {
    id: "competitors",
    label: "From competitors",
    icon: Users,
    desc: "Keywords competitors rank for, you don't",
  },
  {
    id: "ai",
    label: "AI suggestions",
    icon: Sparkles,
    desc: "New candidates from your business context",
  },
] as const;

export function DiscoverTabs() {
  const [active, setActive] = useState<(typeof TABS)[number]["id"]>("gsc");
  const current = TABS.find((t) => t.id === active)!;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                isActive
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t.label}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">{current.desc}</p>

      {active === "gsc" && <DiscoverKeywords />}
      {active === "competitors" && <DiscoverCompetitors />}
      {active === "ai" && <DiscoverAi />}
    </div>
  );
}
