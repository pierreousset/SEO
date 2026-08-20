import { describe, expect, it } from "vitest";
import {
  buildKeywordSeeds,
  keywordMarket,
  keywordOpportunityScore,
  mergeKeywordIdeas,
  parseLabsKeyword,
} from "@/lib/seo/keyword-ideas";

describe("buildKeywordSeeds", () => {
  it("combines primary service with cities", () => {
    expect(
      buildKeywordSeeds({
        primaryService: "Avocat",
        secondaryServices: ["Droit des sociétés"],
        targetCities: ["Paris", "Lyon"],
      }),
    ).toEqual([
      "avocat",
      "droit des sociétés",
      "avocat paris",
      "avocat lyon",
    ]);
  });

  it("returns empty when the profile has no services", () => {
    expect(buildKeywordSeeds({ targetCities: ["Paris"] })).toEqual([]);
  });
});

describe("keywordMarket", () => {
  it("stays on France, switches language", () => {
    expect(keywordMarket("fr")).toEqual({ locationCode: 2250, languageCode: "fr" });
    expect(keywordMarket("en")).toEqual({ locationCode: 2250, languageCode: "en" });
  });
});

describe("keywordOpportunityScore", () => {
  it("prefers easier commercial terms over hard informational heads", () => {
    const easy = keywordOpportunityScore({
      searchVolume: 400,
      keywordDifficulty: 20,
      intent: "transactional",
      wordCount: 3,
    });
    const hard = keywordOpportunityScore({
      searchVolume: 400,
      keywordDifficulty: 80,
      intent: "informational",
      wordCount: 1,
    });
    expect(easy).toBeGreaterThan(hard);
  });

  it("is zero without volume", () => {
    expect(
      keywordOpportunityScore({
        searchVolume: 0,
        keywordDifficulty: 10,
        intent: "transactional",
        wordCount: 3,
      }),
    ).toBe(0);
  });
});

describe("parseLabsKeyword", () => {
  it("reads a flat keyword_ideas item", () => {
    const row = parseLabsKeyword(
      {
        keyword: "avocat paris",
        keyword_info: { search_volume: 720, cpc: 4.2, competition: 0.4 },
        keyword_properties: { keyword_difficulty: 28 },
        search_intent_info: { main_intent: "commercial" },
      },
      "ideas",
    );
    expect(row?.keyword).toBe("avocat paris");
    expect(row?.searchVolume).toBe(720);
    expect(row?.keywordDifficulty).toBe(28);
    expect(row?.intent).toBe("commercial");
    expect(row?.source).toBe("ideas");
    expect(row?.opportunityScore).toBeGreaterThan(0);
  });

  it("reads nested keyword_data from ranked-style payloads", () => {
    const row = parseLabsKeyword(
      {
        keyword_data: {
          keyword: "SEO audit",
          keyword_info: { search_volume: 90 },
          keyword_properties: { keyword_difficulty: 40 },
        },
      },
      "site",
    );
    expect(row?.keyword).toBe("seo audit");
    expect(row?.source).toBe("site");
  });
});

describe("mergeKeywordIdeas", () => {
  it("keeps the higher-scoring duplicate", () => {
    const merged = mergeKeywordIdeas([
      {
        keyword: "avocat paris",
        searchVolume: 100,
        keywordDifficulty: 50,
        cpc: 1,
        competition: 0.2,
        intent: "commercial",
        source: "site",
        opportunityScore: 10,
      },
      {
        keyword: "avocat paris",
        searchVolume: 400,
        keywordDifficulty: 20,
        cpc: 3,
        competition: 0.3,
        intent: "transactional",
        source: "ideas",
        opportunityScore: 90,
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].searchVolume).toBe(400);
    expect(merged[0].opportunityScore).toBe(90);
  });
});
