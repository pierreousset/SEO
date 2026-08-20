import { describe, expect, it } from "vitest";
import { computeGlobalScore, type SiteData } from "@/lib/seo-score";

describe("computeGlobalScore", () => {
  it("scores from GSC keywords without a crawl (does not stay at 0)", () => {
    const data: SiteData = {
      pages: [
        {
          url: "https://example.com/",
          clicks28d: 40,
          impressions28d: 800,
          avgPosition: 8,
          clicksPrev28d: 0,
          title: null,
          titleLength: 0,
          metaDescription: null,
          metaDescriptionLength: 0,
          h1: null,
          inSitemap: false,
          indexable: true,
        },
      ],
      keywords: [
        {
          id: "1",
          query: "audit seo",
          latestPosition: 8.2,
          previousPosition: 9,
          weekAgoPosition: 11,
          impressions28d: 800,
          clicks28d: 40,
          intentStage: 2,
        },
      ],
    };
    const { score, breakdown } = computeGlobalScore(data);
    expect(breakdown.titleQuality).toBe(0);
    expect(breakdown.availableFactors).toBeGreaterThan(0);
    expect(score).toBeGreaterThan(0);
  });

  it("returns 0 only when there is nothing to score", () => {
    const { score, breakdown } = computeGlobalScore({ pages: [], keywords: [] });
    expect(breakdown.availableFactors).toBe(0);
    expect(score).toBe(0);
  });
});
