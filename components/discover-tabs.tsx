"use client";

import { useState } from "react";
import { Search, Users, Sparkles, Target } from "lucide-react";
import { DiscoverKeywords } from "@/components/discover-keywords";
import { DiscoverCompetitors } from "@/components/discover-competitors";
import { DiscoverAi } from "@/components/discover-ai";
import { DiscoverIdeas } from "@/components/discover-ideas";
import { locale } from "@/app/dashboard/keywords/discover/locale";
import type { Locale } from "@/lib/i18n";

const TAB_IDS = ["ideas", "gsc", "competitors", "ai"] as const;
type TabId = (typeof TAB_IDS)[number];

const ICONS: Record<TabId, typeof Target> = {
  ideas: Target,
  gsc: Search,
  competitors: Users,
  ai: Sparkles,
};

export function DiscoverTabs({ lng }: { lng: Locale }) {
  const [active, setActive] = useState<TabId>("ideas");
  const i = locale[lng];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {TAB_IDS.map((id) => {
          const Icon = ICONS[id];
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground border-foreground"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
              {i.tabs[id]}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">{i.tabDesc[active]}</p>

      {active === "ideas" && <DiscoverIdeas lng={lng} />}
      {active === "gsc" && <DiscoverKeywords />}
      {active === "competitors" && <DiscoverCompetitors />}
      {active === "ai" && <DiscoverAi />}
    </div>
  );
}
