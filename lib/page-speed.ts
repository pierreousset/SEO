const PAGESPEED_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export type WebVitals = {
  url: string;
  lcp: number; // Largest Contentful Paint (ms)
  fid: number; // First Input Delay (ms)
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint (ms)
  ttfb: number; // Time to First Byte (ms)
  performanceScore: number; // 0-100
  fetchedAt: string;
};

export async function fetchWebVitals(url: string): Promise<WebVitals | null> {
  try {
    const res = await fetch(
      `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=mobile&category=performance`,
      { signal: AbortSignal.timeout(30000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const audit = data.lighthouseResult?.audits;
    const cat = data.lighthouseResult?.categories?.performance;
    return {
      url,
      lcp: audit?.["largest-contentful-paint"]?.numericValue ?? 0,
      fid: audit?.["max-potential-fid"]?.numericValue ?? 0,
      cls: audit?.["cumulative-layout-shift"]?.numericValue ?? 0,
      fcp: audit?.["first-contentful-paint"]?.numericValue ?? 0,
      ttfb: audit?.["server-response-time"]?.numericValue ?? 0,
      performanceScore: Math.round((cat?.score ?? 0) * 100),
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
