// Per-page i18n strings for /dashboard/internal-links.

const fr = {
  headerKicker: "liens internes",
  title: "Suggestions de liens",
  subtitle: (n: number) =>
    `${n} suggestion${n !== 1 ? "s" : ""} pour améliorer ton maillage interne`,

  emptyNoCrawlIntro: "Lance d'abord un crawl meta pour obtenir des suggestions de liens. Va dans",
  emptyNoCrawlLink: "Audit → Métas",
  emptyNoCrawlOutro: "et lance le crawl de ton site.",

  // Summary cards
  cardTotal: "Total",
  cardHighImpact: "Fort impact",
  cardMedium: "Moyen",
  cardLow: "Faible",

  // Table
  sectionHeading: (n: number) => `suggestions (${n})`,
  thFrom: "Depuis",
  thTo: "Vers",
  thReason: "Raison",
  thImpact: "Impact",

  // No suggestions state
  lookingGood: "Tout va bien",
  noSuggestions: "Aucun problème de maillage interne détecté. Tes pages sont bien interconnectées.",

  // Impact badge labels
  impactHigh: "fort",
  impactMedium: "moyen",
  impactLow: "faible",
};

const en: typeof fr = {
  headerKicker: "internal links",
  title: "Link Suggestions",
  subtitle: (n: number) =>
    `${n} suggestion${n !== 1 ? "s" : ""} to improve your internal linking`,

  emptyNoCrawlIntro: "Run a meta crawl first to get link suggestions. Go to",
  emptyNoCrawlLink: "Audit → Metas",
  emptyNoCrawlOutro: "and crawl your site.",

  cardTotal: "Total",
  cardHighImpact: "High impact",
  cardMedium: "Medium",
  cardLow: "Low",

  sectionHeading: (n: number) => `suggestions (${n})`,
  thFrom: "From",
  thTo: "To",
  thReason: "Reason",
  thImpact: "Impact",

  lookingGood: "Looking good",
  noSuggestions:
    "No internal linking issues found. Your pages are well cross-linked.",

  impactHigh: "high",
  impactMedium: "medium",
  impactLow: "low",
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
