// Per-page i18n strings for /dashboard/pages.

const fr = {
  headerKicker: (days: number) => `Pages indexées · ${days} derniers jours`,
  title: "Pages",

  emptyTitle:
    "Aucune page pour l'instant. Lancez une récupération de l'historique GSC depuis l'aperçu — les données apparaissent ici 30 à 60 secondes plus tard.",
  emptyCta: "Récupérer l'historique GSC",

  intelligenceKicker: "page intelligence",
  issuesDetected: "Problèmes détectés",

  vitalsKicker: "core web vitals",
  vitalsTitle: "Performance",
  vitalsThUrl: "URL",
  vitalsThScore: "Score",
  vitalsThLcp: "LCP",
  vitalsThFcp: "FCP",
  vitalsThCls: "CLS",
  vitalsThTtfb: "TTFB",
  vitalsThChecked: "Vérifié",
  vitalsEmpty:
    "Aucune donnée Vitals pour l'instant. Cliquez sur « Vérifier les vitals » pour scanner vos meilleures pages via PageSpeed Insights.",

  decayKicker: "content decay",
  decayTitle: "Pages perdant du trafic progressivement",
  decayPerWeek: (rate: number) => `${rate}% par semaine`,
  decayClicksLost: (clicks: number) => `~${clicks} clics perdus sur 4 semaines`,

  statPagesIndexed: "Pages indexées",
  statTotalClicks: "Clics totaux",
  statTotalImpressions: "Impressions totales",
  statAvgCtr: "CTR moyen",

  topPagesTitle: "Top des pages",
  topPagesSubtitle: (days: number) =>
    `Toute URL avec au moins une impression Google sur les ${days} derniers jours est considérée comme indexée. Triées par clics.`,
  thUrl: "URL",
  thClicks: "Clics",
  thImpr: "Impr.",
  thCtr: "CTR",
  thAvgPos: "Pos. moy.",
  thLastSeen: "Vue récemment",
  healthCritical: "Problèmes critiques",
  healthWarnings: "Avertissements",
  healthHealthy: "Saine",
  showingTop300: "Affichage des 300 meilleures par clics. Re-tirez GSC pour rafraîchir.",

  ctaKicker: "suite",
  ctaText:
    "Repérez les pages qui perdent du terrain semaine après semaine — le radar Refresh fait remonter les candidates à une mise à jour.",
};

const en: typeof fr = {
  headerKicker: (days: number) => `Indexed pages · last ${days} days`,
  title: "Pages",

  emptyTitle:
    "No pages yet. Run a GSC history pull from the Overview page — the data shows up here 30-60s later.",
  emptyCta: "Pull GSC history",

  intelligenceKicker: "page intelligence",
  issuesDetected: "Issues detected",

  vitalsKicker: "core web vitals",
  vitalsTitle: "Performance",
  vitalsThUrl: "URL",
  vitalsThScore: "Score",
  vitalsThLcp: "LCP",
  vitalsThFcp: "FCP",
  vitalsThCls: "CLS",
  vitalsThTtfb: "TTFB",
  vitalsThChecked: "Checked",
  vitalsEmpty:
    "No vitals data yet. Click “Check vitals” to scan your top pages via PageSpeed Insights.",

  decayKicker: "content decay",
  decayTitle: "Pages losing traffic gradually",
  decayPerWeek: (rate: number) => `${rate}% per week`,
  decayClicksLost: (clicks: number) => `~${clicks} clicks lost over 4 weeks`,

  statPagesIndexed: "Pages indexed",
  statTotalClicks: "Total clicks",
  statTotalImpressions: "Total impressions",
  statAvgCtr: "Avg CTR",

  topPagesTitle: "Top pages",
  topPagesSubtitle: (days: number) =>
    `Any URL with at least one Google impression in the last ${days} days counts as indexed here. Sorted by clicks.`,
  thUrl: "URL",
  thClicks: "Clicks",
  thImpr: "Impr.",
  thCtr: "CTR",
  thAvgPos: "Avg pos",
  thLastSeen: "Last seen",
  healthCritical: "Critical issues",
  healthWarnings: "Warnings",
  healthHealthy: "Healthy",
  showingTop300: "Showing top 300 by clicks. Re-pull GSC to refresh.",

  ctaKicker: "next",
  ctaText:
    "See which of these pages are losing ground week after week — the Refresh radar surfaces candidates for a content update.",
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
