import * as cheerio from "cheerio";
import { seedsFromPageCopy } from "@/lib/seo/keyword-ideas";

export type HomepageCopy = {
  title: string | null;
  h1s: string[];
  description: string | null;
  siteName: string | null;
};

export async function fetchHomepageCopy(domain: string): Promise<HomepageCopy | null> {
  const urls = [`https://${domain}/`, `https://www.${domain}/`];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "SEODashboard-Profile/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);
      const title = $("title").first().text().trim() || null;
      const h1s = $("h1")
        .toArray()
        .map((el) => $(el).text().trim())
        .filter(Boolean);
      const description =
        $('meta[name="description"]').attr("content")?.trim() ||
        $('meta[property="og:description"]').attr("content")?.trim() ||
        null;
      const siteName = $('meta[property="og:site_name"]').attr("content")?.trim() || null;
      if (title || h1s.length > 0 || description) {
        return { title, h1s, description, siteName };
      }
    } catch {
      /* next url */
    }
  }
  return null;
}

export function homepageSeeds(copy: HomepageCopy | null): string[] {
  if (!copy) return [];
  return seedsFromPageCopy(copy.title, copy.h1s, copy.description);
}
