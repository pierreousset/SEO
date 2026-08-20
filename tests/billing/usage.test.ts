import { describe, it, expect } from "vitest";
import { cooldownRemainingMs, currentPeriod, formatRetryWait } from "@/lib/usage";
import { KEYWORD_IDEAS_COOLDOWN_MS, MONTHLY_LIMITS, type MeteredAction } from "@/lib/billing-constants";

describe("currentPeriod", () => {
  it("formats the UTC month as YYYY-MM", () => {
    expect(currentPeriod(new Date("2026-07-09T23:30:00Z"))).toBe("2026-07");
    expect(currentPeriod(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
    expect(currentPeriod(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12");
  });

  it("uses UTC, not local time, at month boundaries", () => {
    // 2026-08-01 00:30 UTC is still August in UTC regardless of local tz.
    expect(currentPeriod(new Date("2026-08-01T00:30:00Z"))).toBe("2026-08");
  });
});

describe("MONTHLY_LIMITS", () => {
  const actions: MeteredAction[] = [
    "audit",
    "competitorDiscovery",
    "competitorGap",
    "backlinks",
    "aeoCheck",
    "contentBrief",
    "articleGeneration",
    "briefManual",
    "metaSuggestion",
    "metaSuggestionBulk",
    "schemaGeneration",
    "aiSuggestions",
    "cannibalization",
    "keywordIdeas",
  ];

  it("has an entry for every metered action (no drift)", () => {
    for (const a of actions) {
      expect(MONTHLY_LIMITS).toHaveProperty(a);
    }
    // and no stray keys
    expect(Object.keys(MONTHLY_LIMITS).sort()).toEqual([...actions].sort());
  });

  it("caps the genuinely expensive external calls", () => {
    // These hit DataForSEO / multi-provider AEO and must never be unlimited.
    for (const a of ["backlinks", "competitorDiscovery", "competitorGap", "aeoCheck", "keywordIdeas"] as MeteredAction[]) {
      expect(typeof MONTHLY_LIMITS[a]).toBe("number");
      expect(MONTHLY_LIMITS[a]!).toBeGreaterThan(0);
    }
  });

  it("keeps keyword ideas scarce so DataForSEO is not hit on every fetch", () => {
    expect(MONTHLY_LIMITS.keywordIdeas).toBe(8);
    expect(KEYWORD_IDEAS_COOLDOWN_MS).toBe(12 * 60 * 60 * 1000);
  });

  it("leaves cheap Haiku / free GSC actions unlimited", () => {
    for (const a of ["metaSuggestion", "schemaGeneration", "cannibalization"] as MeteredAction[]) {
      expect(MONTHLY_LIMITS[a]).toBeNull();
    }
  });
});

describe("cooldownRemainingMs", () => {
  const cooldown = 12 * 60 * 60 * 1000;

  it("allows a first call", () => {
    expect(cooldownRemainingMs(null, cooldown, Date.parse("2026-08-20T12:00:00Z"))).toBe(0);
  });

  it("blocks inside the window", () => {
    const last = new Date("2026-08-20T06:00:00Z");
    const now = Date.parse("2026-08-20T12:00:00Z");
    expect(cooldownRemainingMs(last, cooldown, now)).toBe(6 * 60 * 60 * 1000);
  });

  it("allows after the window", () => {
    const last = new Date("2026-08-19T12:00:00Z");
    const now = Date.parse("2026-08-20T12:00:00Z");
    expect(cooldownRemainingMs(last, cooldown, now)).toBe(0);
  });
});

describe("formatRetryWait", () => {
  it("shows minutes under an hour", () => {
    expect(formatRetryWait(5 * 60 * 1000)).toBe("5 min");
  });

  it("shows hours above an hour", () => {
    expect(formatRetryWait(6 * 60 * 60 * 1000)).toBe("6 h");
  });
});
