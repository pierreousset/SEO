// Per-page i18n strings. Co-located with the page that uses them so it stays
// obvious where text lives. Pattern:
//   const lng = await getLocale();
//   const t = locale[lng];
// Then use t.title, t.actions.headerCta, etc. Both fr and en must match the
// same shape — TypeScript will fail the build if they don't.

const fr = {
  label: "vue d'ensemble",
  title: "Vue d'ensemble",

  actionsCard: {
    label: "actions du jour",
    titleSingular: "1 chose à faire",
    titlePlural: (n: number) => `${n} choses à faire`,
    moreCount: (n: number) => `+${n} de plus`,
  },

  actions: {
    fixCtrOn: (path: string) => `Améliorer le CTR de ${path}`,
    fixCtrSubtitle: (clicks: string, pos: string) =>
      `~${clicks} clics/mois récupérables · pos ${pos}`,
    lostQuery: (kw: string) => `Perdu : « ${kw} »`,
    lostQuerySubtitle: (imp: string) =>
      `${imp} impressions sur 28j, aucune sur 7j`,
    decliningPage: (path: string) => `En baisse : ${path}`,
    decliningSubtitle: (delta: number) => `${delta} clics vs 7j précédents`,
    pushToPage1: (kw: string) => `Pousser « ${kw} » en page 1`,
    pushSubtitle: (pos: number) => `Actuellement #${pos} — haut de page 2`,
    zeroClicks: (kw: string) => `Zéro clic : « ${kw} »`,
    zeroClicksSubtitle: (imp: string) =>
      `${imp} impressions, 0 clic · titre ou intent à revoir`,
  },

  bento: {
    seoHealth: "score seo",
    noIssues: "aucun problème détecté",
    issuesDetected: (n: number) =>
      `${n} problème${n > 1 ? "s" : ""} détecté${n > 1 ? "s" : ""}`,
    waitingFirstScore: "en attente du premier calcul de score",
    avgPosition: "position moyenne",
    clicks28d: "clics (28j)",
    keywords: "mots-clés",
    performance: "performance",
    searchConsole: "Search Console",
    connectGsc: "Connectez GSC pour voir les données de performance",
    gapZone: "zone d'opportunité",
    highestRoi: "Plus fort ROI",
    gapEmpty: "Les mots-clés en pos 5-20 apparaîtront ici",
    colKeyword: "mot-clé",
    colPos: "pos",
    col7d: "7j",
    latestBriefAt: (start: string, end: string) =>
      `dernier brief ia · ${start} → ${end}`,
    aiBrief: "brief ia",
    aiBriefEmpty: "Générez votre premier brief pour voir un aperçu ici.",
    positionDistribution: "répartition des positions",
    noPositionData: "Aucune donnée de position pour l'instant",
    serpFetch: "Fetch SERP",
    aiBriefShort: "Brief IA",
  },
};

// Forcing en to match fr's exact shape — missing keys or wrong types fail at build.
const en: typeof fr = {
  label: "overview",
  title: "Overview",

  actionsCard: {
    label: "today's actions",
    titleSingular: "1 thing to focus on",
    titlePlural: (n: number) => `${n} things to focus on`,
    moreCount: (n: number) => `+${n} more`,
  },

  actions: {
    fixCtrOn: (path: string) => `Fix CTR on ${path}`,
    fixCtrSubtitle: (clicks: string, pos: string) =>
      `~${clicks} clicks/mo recoverable · pos ${pos}`,
    lostQuery: (kw: string) => `Lost: "${kw}"`,
    lostQuerySubtitle: (imp: string) =>
      `${imp} impressions in 28d, none in last 7d`,
    decliningPage: (path: string) => `Declining: ${path}`,
    decliningSubtitle: (delta: number) => `${delta} clicks vs prior 7d`,
    pushToPage1: (kw: string) => `Push "${kw}" to page 1`,
    pushSubtitle: (pos: number) => `Currently #${pos} — top of page 2`,
    zeroClicks: (kw: string) => `Zero clicks: "${kw}"`,
    zeroClicksSubtitle: (imp: string) =>
      `${imp} impressions, 0 clicks · title or intent mismatch`,
  },

  bento: {
    seoHealth: "seo health",
    noIssues: "no issues detected",
    issuesDetected: (n: number) =>
      `${n} issue${n !== 1 ? "s" : ""} detected`,
    waitingFirstScore: "waiting for first score computation",
    avgPosition: "avg position",
    clicks28d: "clicks (28d)",
    keywords: "keywords",
    performance: "performance",
    searchConsole: "Search Console",
    connectGsc: "Connect GSC to see performance data",
    gapZone: "gap zone",
    highestRoi: "Highest ROI",
    gapEmpty: "Keywords in positions 5-20 will appear here",
    colKeyword: "keyword",
    colPos: "pos",
    col7d: "7d",
    latestBriefAt: (start: string, end: string) =>
      `latest ai brief · ${start} → ${end}`,
    aiBrief: "ai brief",
    aiBriefEmpty: "Generate your first brief to see a preview here.",
    positionDistribution: "position distribution",
    noPositionData: "No position data yet",
    serpFetch: "SERP fetch",
    aiBriefShort: "AI brief",
  },
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
