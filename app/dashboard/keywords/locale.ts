// Per-page i18n strings for /dashboard/keywords. See app/dashboard/locale.ts
// for the canonical example.

const fr = {
  // Empty state
  emptyTitle: "Aucun mot-clé suivi pour l'instant",
  emptyDescNoSites:
    "Connectez d'abord Google Search Console, puis ajoutez des mots-clés pour commencer à surveiller vos positions.",
  emptyDescWithSites:
    "Ajoutez des mots-clés pour commencer à surveiller vos positions. Nous récupérerons les classements quotidiennement et analyserons les tendances.",
  connectGsc: "Connecter GSC",

  // Header
  headerKicker: "rank tracking",
  title: "Mots-clés",
  subtitle: (tracked: number, shown: number) =>
    `${tracked} suivis · ${shown} affichés. Données décalées de 0-1 jour.`,
  discoverKeywords: "Découvrir des mots-clés",

  // Stats
  stats: {
    top3: "top 3",
    striking: "striking distance",
    strikingSubtitle: "pos 4-10",
    dropping: "en baisse",
    quickWins: "quick wins",
    quickWinsSubtitle: "pos 11-20, fortes impressions",
    totalTracked: "total suivi",
  },

  // Top movers
  topUp: "top up · 1j",
  topDown: "top down · 1j",
  noUpMovers: "Aucune progression sur la dernière collecte",
  noDownMovers: "Aucune baisse sur la dernière collecte",

  // Best opportunity
  bestOpportunityLabel: "Meilleure opportunité :",
  bestOpportunitySuffix: (impressions: string) =>
    `avec ${impressions} impressions mensuelles. Pousser dans le top 3 pour capter 3x plus de clics.`,
  bestOpportunityAt: "à",
  bestOpportunityWith: "avec",

  // Table headers
  thKeyword: "Mot-clé",
  thIntent: "Intent",
  thDiagnostic: "Diagnostic",
  thPosition: "Position",
  th1d: "1j Δ",
  th7d: "7j Δ",
  th7dShort: "7j",
  thImpr: "Impr 30j",
  thBestComp: "Best comp",
  thCountry: "Pays",
  thTip: "Conseil",
  noFilterMatch: "Aucun mot-clé ne correspond à ces filtres. Cliquez sur",
  noFilterMatchReset: "Réinitialiser",
  noFilterMatchEnd: "ci-dessus pour effacer.",

  // Footer
  collectingData:
    "Collecte en cours. Graphiques partiels tant que 4 semaines d'historique ne sont pas atteintes.",
};

const en: typeof fr = {
  emptyTitle: "No keywords tracked yet",
  emptyDescNoSites:
    "Connect Google Search Console first, then add keywords to start monitoring your search positions.",
  emptyDescWithSites:
    "Add keywords to start monitoring your search positions. We'll fetch rankings daily and analyze trends.",
  connectGsc: "Connect GSC",

  headerKicker: "rank tracking",
  title: "Keywords",
  subtitle: (tracked: number, shown: number) =>
    `${tracked} tracked · ${shown} shown. Data lags 0-1 day.`,
  discoverKeywords: "Discover keywords",

  stats: {
    top3: "top 3",
    striking: "striking distance",
    strikingSubtitle: "pos 4-10",
    dropping: "dropping",
    quickWins: "quick wins",
    quickWinsSubtitle: "pos 11-20, high impr",
    totalTracked: "total tracked",
  },

  topUp: "top up · 1d",
  topDown: "top down · 1d",
  noUpMovers: "No upward movers in last fetch",
  noDownMovers: "No downward movers in last fetch",

  bestOpportunityLabel: "Best opportunity:",
  bestOpportunitySuffix: (impressions: string) =>
    `monthly impressions. Push to top 3 to capture 3x more clicks.`,
  bestOpportunityAt: "at",
  bestOpportunityWith: "with",

  thKeyword: "Keyword",
  thIntent: "Intent",
  thDiagnostic: "Diagnostic",
  thPosition: "Position",
  th1d: "1d Δ",
  th7d: "7d Δ",
  th7dShort: "7d",
  thImpr: "Impr 30d",
  thBestComp: "Best comp",
  thCountry: "Country",
  thTip: "Tip",
  noFilterMatch: "No keywords match these filters. Click",
  noFilterMatchReset: "Reset",
  noFilterMatchEnd: "above to clear.",

  collectingData: "Collecting data. Charts partial until 4 weeks of history.",
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
