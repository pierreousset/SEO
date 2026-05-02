// Per-page i18n strings for /dashboard/cannibalization.

import { severityStrings } from "@/lib/issue-strings";

const fr = {
  headerKicker: "cannibalisation de mots-clés",
  title: "Cannibalisation",

  runFirstScan: "Premier scan",
  runNewScan: "Nouveau scan",

  // Empty state (no run yet)
  emptyExplain:
    "Quand <strong>deux pages ou plus</strong> de ton site se positionnent sur le même mot-clé, Google divise l'autorité et les impressions, et personne ne gagne. Ce scan analyse les données requête×page de GSC et fait remonter les pires cas.",
  emptyRequirement:
    "GSC connecté requis. Prend 30-90 s selon la taille du site.",

  // Empty state (run done, 0 findings)
  noFindingsTitle: "Aucune cannibalisation détectée.",
  noFindingsBody: (queries: number, days: number) =>
    `${queries} requêtes scannées sur les ${days} derniers jours — chaque requête a une URL gagnante claire.`,
  noFindingsHint:
    "Si tu connais une requête où plusieurs pages se chevauchent, relance le scan après avoir ajouté plus de mots-clés ou attendu plus de données d'impressions.",

  // Intelligence summary
  intelligenceKicker: "résumé d'intelligence",
  intelligenceLine: (n: number) =>
    `${n} groupe${n !== 1 ? "s" : ""} de mots-clés où tes pages se concurrencent.`,

  topGroupsKicker: "groupes à plus fort impact",
  topGroupImpressions: (impr: number, urls: number) =>
    `${impr.toLocaleString()} impressions · ${urls} URLs`,
  topGroupHint: "Consolide ces pages ou différencie leur contenu.",

  // KPI tiles
  kpiHigh: "Sévérité élevée",
  kpiHighSub: "URL principale détient < 50 % de la part",
  kpiMedium: "Sévérité moyenne",
  kpiMediumSub: "URL principale détient < 70 % de la part",
  kpiQueriesScanned: "Requêtes scannées",
  kpiQueriesScannedSub: (days: number) => `${days} derniers jours de données GSC`,

  // Finding card
  findingMeta: (urls: number, impressions: number, clicks: number, topShare: number) =>
    `${urls} URLs · ${impressions.toLocaleString()} impressions · ${clicks.toLocaleString()} clics · l'URL principale détient ${topShare} % des impressions`,
  trackedBadge: "suivi",

  // Table headers
  thUrl: "URL",
  thImpressions: "Impressions",
  thClicks: "Clics",
  thAvgPos: "Pos. moy.",
  thShare: "Part",

  // CTA at bottom
  ctaKicker: "comment corriger la cannibalisation",
  ctaText:
    "Choisis l'URL que tu veux faire ranker. Consolide le contenu des URLs perdantes dedans, ajoute des redirections 301 depuis les perdantes, et mets à jour les liens internes. Délai d'effet typique : 2-4 semaines.",

  severity: severityStrings.fr,
};

const en: typeof fr = {
  headerKicker: "keyword cannibalization",
  title: "Cannibalization",

  runFirstScan: "Run first scan",
  runNewScan: "Run new scan",

  emptyExplain:
    "When <strong>two or more of your own pages</strong> compete for the same keyword, Google splits authority and impressions — and nobody wins. This scan pulls GSC query×page data and surfaces the worst offenders.",
  emptyRequirement:
    "Requires GSC connected. Takes 30-90s depending on your site size.",

  noFindingsTitle: "No cannibalization detected.",
  noFindingsBody: (queries: number, days: number) =>
    `Scanned ${queries} queries over the last ${days}d — every query has a clear winning URL.`,
  noFindingsHint:
    "If you know of a query where multiple pages overlap, re-run the scan after adding more tracked keywords or waiting for more impressions data.",

  intelligenceKicker: "intelligence summary",
  intelligenceLine: (n: number) =>
    `${n} keyword group${n !== 1 ? "s" : ""} where your pages compete against each other.`,

  topGroupsKicker: "highest impact groups",
  topGroupImpressions: (impr: number, urls: number) =>
    `${impr.toLocaleString()} impressions · ${urls} URLs`,
  topGroupHint: "Consolidate these pages or differentiate their content.",

  kpiHigh: "High severity",
  kpiHighSub: "top URL holds < 50% share",
  kpiMedium: "Medium severity",
  kpiMediumSub: "top URL holds < 70% share",
  kpiQueriesScanned: "Queries scanned",
  kpiQueriesScannedSub: (days: number) => `last ${days}d of GSC data`,

  findingMeta: (urls: number, impressions: number, clicks: number, topShare: number) =>
    `${urls} URLs · ${impressions.toLocaleString()} impressions · ${clicks.toLocaleString()} clicks · top URL holds ${topShare}% of impressions`,
  trackedBadge: "tracked",

  thUrl: "URL",
  thImpressions: "Impressions",
  thClicks: "Clicks",
  thAvgPos: "Avg pos",
  thShare: "Share",

  ctaKicker: "how to fix cannibalization",
  ctaText:
    "Pick the URL you want to rank. Consolidate content from the losing URLs into it, add 301 redirects from the losers, and update internal links. Typical time-to-effect: 2-4 weeks.",

  severity: severityStrings.en,
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
