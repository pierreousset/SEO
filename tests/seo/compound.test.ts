import { describe, expect, it } from "vitest";
import { compoundSeries, yearTotal } from "@/lib/seo/compound";

describe("yearTotal", () => {
  it("matches the classic $200/mo · 10% · 40y end balance", () => {
    const total = yearTotal(200, 0.1, 40);
    expect(Math.round(total)).toBe(1_264_816);
  });

  it("is just contributions when the rate is zero", () => {
    expect(yearTotal(200, 0, 40)).toBe(96_000);
  });
});

describe("compoundSeries", () => {
  it("splits contributed vs growth and finds the crossover year", () => {
    const { points, crossoverYear } = compoundSeries(200, 0.1, 40);
    const last = points[points.length - 1];
    expect(last.contributed).toBe(96_000);
    expect(Math.round(last.growth)).toBe(1_168_816);
    expect(crossoverYear).toBe(13);
  });

  it("has no crossover when growth never overtakes contributions", () => {
    const { crossoverYear } = compoundSeries(200, 0.04, 20);
    expect(crossoverYear).toBeNull();
  });
});
