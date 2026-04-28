/**
 * Content decay detection.
 *
 * Identifies pages losing traffic gradually over time (not a sudden drop,
 * but a sustained week-over-week decline). Uses GSC page-level metrics.
 */

export type DecayingPage = {
  url: string;
  weeklyClickTrend: number[]; // last 4 weeks of clicks
  decayRate: number; // average percentage decline per week (negative)
  totalClicksLost: number;
  severity: "high" | "medium" | "low";
};

/**
 * Detect pages with gradual traffic decay.
 *
 * Logic:
 * 1. Group metrics by URL
 * 2. For each URL, bucket by ISO week (last 4 weeks)
 * 3. If clicks decline 3+ consecutive weeks → content is decaying
 * 4. Severity: high if >30% total decline, medium if >15%, low if >5%
 * 5. Sort by totalClicksLost descending
 * 6. Return top 20
 */
export function detectContentDecay(
  pageMetrics: Array<{ url: string; date: string; clicks: number }>,
): DecayingPage[] {
  // Group by URL
  const byUrl = new Map<string, Array<{ date: string; clicks: number }>>();
  for (const m of pageMetrics) {
    const arr = byUrl.get(m.url) ?? [];
    arr.push({ date: m.date, clicks: m.clicks });
    byUrl.set(m.url, arr);
  }

  // Determine the 4 most recent week boundaries (Mon-Sun)
  const now = new Date();
  const weeks: Array<{ start: string; end: string }> = [];
  for (let w = 0; w < 4; w++) {
    const weekEnd = new Date(now);
    weekEnd.setUTCDate(weekEnd.getUTCDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    weeks.unshift({
      start: weekStart.toISOString().slice(0, 10),
      end: weekEnd.toISOString().slice(0, 10),
    });
  }

  const results: DecayingPage[] = [];

  for (const [url, metrics] of byUrl) {
    // Bucket clicks by week
    const weeklyClicks: number[] = weeks.map((week) => {
      let total = 0;
      for (const m of metrics) {
        if (m.date >= week.start && m.date <= week.end) {
          total += m.clicks;
        }
      }
      return total;
    });

    // Need at least some data in the first week to measure decline
    if (weeklyClicks[0] === 0) continue;

    // Check for 3+ consecutive weeks of decline
    let consecutiveDeclines = 0;
    for (let i = 1; i < weeklyClicks.length; i++) {
      if (weeklyClicks[i] < weeklyClicks[i - 1]) {
        consecutiveDeclines++;
      } else {
        consecutiveDeclines = 0;
      }
    }

    if (consecutiveDeclines < 3) continue;

    // Calculate total decline
    const firstWeek = weeklyClicks[0];
    const lastWeek = weeklyClicks[weeklyClicks.length - 1];
    const totalClicksLost = firstWeek - lastWeek;
    const totalDeclinePercent =
      firstWeek > 0 ? ((lastWeek - firstWeek) / firstWeek) * 100 : 0;

    // Average weekly decay rate
    const weeklyRates: number[] = [];
    for (let i = 1; i < weeklyClicks.length; i++) {
      if (weeklyClicks[i - 1] > 0) {
        weeklyRates.push(
          ((weeklyClicks[i] - weeklyClicks[i - 1]) / weeklyClicks[i - 1]) * 100,
        );
      }
    }
    const decayRate =
      weeklyRates.length > 0
        ? weeklyRates.reduce((a, b) => a + b, 0) / weeklyRates.length
        : 0;

    // Only include if decline is meaningful (>5%)
    if (totalDeclinePercent > -5) continue;

    // Severity
    let severity: "high" | "medium" | "low";
    if (totalDeclinePercent <= -30) {
      severity = "high";
    } else if (totalDeclinePercent <= -15) {
      severity = "medium";
    } else {
      severity = "low";
    }

    results.push({
      url,
      weeklyClickTrend: weeklyClicks,
      decayRate: Math.round(decayRate * 10) / 10,
      totalClicksLost,
      severity,
    });
  }

  // Sort by totalClicksLost descending
  results.sort((a, b) => b.totalClicksLost - a.totalClicksLost);

  return results.slice(0, 20);
}
