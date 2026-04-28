/**
 * SERP Features detection framework.
 *
 * Detects which SERP features appear for a given keyword from DataForSEO
 * SERP results. Will be populated with real detection logic when SERP data
 * is available; for now the DB + UI are ready.
 */

export type SerpFeature =
  | "featured_snippet"
  | "people_also_ask"
  | "local_pack"
  | "knowledge_panel"
  | "image_pack"
  | "video"
  | "shopping"
  | "sitelinks";

export const SERP_FEATURE_LABELS: Record<SerpFeature, string> = {
  featured_snippet: "Featured Snippet",
  people_also_ask: "People Also Ask",
  local_pack: "Local Pack",
  knowledge_panel: "Knowledge Panel",
  image_pack: "Image Pack",
  video: "Video",
  shopping: "Shopping",
  sitelinks: "Sitelinks",
};

export const SERP_FEATURE_COLORS: Record<SerpFeature, string> = {
  featured_snippet: "bg-[#A855F7]/20 text-[#A855F7]",
  people_also_ask: "bg-[#3B82F6]/20 text-[#3B82F6]",
  local_pack: "bg-[#34D399]/20 text-[#34D399]",
  knowledge_panel: "bg-[#F59E0B]/20 text-[#F59E0B]",
  image_pack: "bg-[#EC4899]/20 text-[#EC4899]",
  video: "bg-[#EF4444]/20 text-[#EF4444]",
  shopping: "bg-[#10B981]/20 text-[#10B981]",
  sitelinks: "bg-[#6366F1]/20 text-[#6366F1]",
};

/**
 * Detect SERP features from DataForSEO SERP result data.
 *
 * When DataForSEO returns full SERP items, each item has a `type` field
 * (e.g. "featured_snippet", "people_also_ask", "local_pack", etc.).
 * This function extracts the unique feature types present in the result.
 *
 * For now returns empty — the UI and DB are ready for when SERP data flows in.
 */
export function detectSerpFeatures(serpData: unknown): SerpFeature[] {
  if (!serpData || typeof serpData !== "object") return [];

  // DataForSEO returns items[] with a type field on each
  const data = serpData as { items?: Array<{ type?: string }> };
  if (!Array.isArray(data.items)) return [];

  const validFeatures = new Set<SerpFeature>([
    "featured_snippet",
    "people_also_ask",
    "local_pack",
    "knowledge_panel",
    "image_pack",
    "video",
    "shopping",
    "sitelinks",
  ]);

  const found = new Set<SerpFeature>();
  for (const item of data.items) {
    if (item.type && validFeatures.has(item.type as SerpFeature)) {
      found.add(item.type as SerpFeature);
    }
  }

  return Array.from(found);
}
