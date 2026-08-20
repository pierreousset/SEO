// Per-page i18n strings. Co-located with the page that uses them so it stays
// obvious where text lives. Pattern:
//   const lng = await getLocale();
//   const t = locale[lng];
// Then use t.title, t.actions.headerCta, etc. Both fr and en must match the
// same shape — TypeScript will fail the build if they don't.

const fr = {
  label: "vue d'ensemble",
  title: "Vue d'ensemble",
  headerKicker: "aujourd'hui",
  pullGsc: "Search Console",
  fetchNow: "Positions",
  historyHint: "L'historique se construit à chaque sync.",
  coachNote: (n: number) =>
    n <= 0 ? "Rien d'urgent. On surveille." : n === 1 ? "Une chose. Celle-là." : `${n} choses. Dans cet ordre.`,
  first: "d'abord",

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
    paidOverlap: (kw: string) => `Vous payez « ${kw} » déjà en top 3`,
    paidOverlapSubtitle: (eur: string, pos: number) =>
      `${eur}€ / 30j · organique #${pos}`,
    paidGap: (kw: string) => `Ads sans page organique : « ${kw} »`,
    paidGapSubtitle: (eur: string) =>
      `${eur}€ / 30j. Une page organique coûterait moins.`,
    adsNew: (kw: string) => `Suivre « ${kw} » (vu dans Ads)`,
    adsNewSubtitle: (imp: string, eur: string) =>
      `${imp} impr. Ads · ${eur}€. Absent du suivi.`,
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

  onboarding: {
    kicker: "pour commencer",
    title: "Trois étapes. Ensuite le coach parle.",
    subtitle:
      "Search Console d'abord. On lit vos vrais clics. Puis on vous dit quoi corriger.",
    step1Title: "Connecter Search Console",
    step1Body:
      "Accès lecture seule. On n'écrit rien chez Google. C'est la source du brief.",
    step1Cta: "Connecter Google",
    step1Done: "Connectée",
    step1OwnerOnly: "Seul le propriétaire du compte peut connecter Search Console.",
    step1MissingEnv: "Search Console n'est pas configurée sur ce serveur (GOOGLE_CLIENT_ID).",
    step2Title: "Vérifier vos mots-clés",
    step2Body:
      "À la connexion, on importe vos 20 requêtes les plus vues. Vous pourrez en ajouter.",
    step2Cta: "Voir les mots-clés",
    step2Add: "Ajouter des mots-clés",
    step3Title: "Lire les 3 actions",
    step3Body:
      "La vue d'ensemble se remplit dès que les données GSC arrivent. Pas besoin d'un fetch SERP pour commencer.",
    step3Cta: "Ouvrir la vue d'ensemble",
    justConnected:
      "Search Console est liée. On a importé vos requêtes et les totaux du site.",
    nextBrief:
      "Les 3 actions du jour apparaissent ici. Le brief hebdo part le lundi.",
    warnNoProperty:
      "Aucun site vérifié dans Search Console. Vérifiez la propriété dans Google, puis reconnectez.",
    warnNoQueries:
      "Le site est lié, mais aucune requête sur 28 jours. Ajoutez des mots-clés à la main, ou attendez que Google ait du trafic.",
    warnImportFailed:
      "La connexion a marché, l'import a échoué. Réessayez ou ajoutez des mots-clés à la main.",
    pullCta: "Charger l'historique GSC",
    pullHint:
      "Le graphe et les clics viennent d'un second chargement. Si ça reste vide, lancez Inngest (`bun inngest`) puis ce bouton.",
    adsCta: "Connecter Google Ads",
    adsHint:
      "Optionnel. On croise vos search terms payants avec l'organique : stop spend, pages à écrire.",
    adsConnected: "Google Ads est lié. On a importé les search terms des 30 derniers jours.",
    adsNoAccount:
      "Aucun compte Ads client lisible. Connecte le Google qui a le compte Ads (pas seulement le MCC), ou lie un compte client sous le manager.",
    adsTokenTest:
      "Le token Ads est encore en mode test. Demande l'accès Basic ici : ads.google.com/aw/apicenter (toi seul, une fois). Tes clients n'ont rien à faire.",
    adsImportFailed:
      "La connexion Ads a marché, l'import des search terms a échoué. Réessayez depuis Réglages.",
    adsMissingToken:
      "Google Ads n'est pas configuré sur ce serveur (GOOGLE_ADS_DEVELOPER_TOKEN).",
    adsRetry: "Relancer l'import Ads",
  },
};

// Forcing en to match fr's exact shape — missing keys or wrong types fail at build.
const en: typeof fr = {
  label: "overview",
  title: "Overview",
  headerKicker: "today",
  pullGsc: "Search Console",
  fetchNow: "Positions",
  historyHint: "History builds with each sync.",
  coachNote: (n: number) =>
    n <= 0 ? "Nothing urgent. We watch." : n === 1 ? "One thing. This one." : `${n} things. In this order.`,
  first: "first",

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
    paidOverlap: (kw: string) => `You're paying for "${kw}" already in the top 3`,
    paidOverlapSubtitle: (eur: string, pos: number) =>
      `${eur}€ / 30d · organic #${pos}`,
    paidGap: (kw: string) => `Ads with no organic page: "${kw}"`,
    paidGapSubtitle: (eur: string) =>
      `${eur}€ / 30d. An organic page would cost less.`,
    adsNew: (kw: string) => `Track "${kw}" (seen in Ads)`,
    adsNewSubtitle: (imp: string, eur: string) =>
      `${imp} Ads impr. · ${eur}€. Not in your keyword list.`,
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

  onboarding: {
    kicker: "get started",
    title: "Three steps. Then the coach has something to say.",
    subtitle:
      "Search Console first. We read your real clicks. Then we tell you what to fix.",
    step1Title: "Connect Search Console",
    step1Body:
      "Read-only access. We never write to Google. This is the source for the brief.",
    step1Cta: "Connect Google",
    step1Done: "Connected",
    step1OwnerOnly: "Only the account owner can connect Search Console.",
    step1MissingEnv: "Search Console is not configured on this server (GOOGLE_CLIENT_ID).",
    step2Title: "Check your keywords",
    step2Body:
      "On connect, we import your 20 most-seen queries. You can add more later.",
    step2Cta: "View keywords",
    step2Add: "Add keywords",
    step3Title: "Read the 3 actions",
    step3Body:
      "Overview fills in as soon as GSC data arrives. You don't need a SERP fetch to start.",
    step3Cta: "Open overview",
    justConnected:
      "Search Console is linked. We imported your queries and site totals.",
    nextBrief:
      "Today's 3 actions show up here. The weekly brief goes out on Monday.",
    warnNoProperty:
      "No verified site in Search Console. Check the property in Google, then reconnect.",
    warnNoQueries:
      "The site is linked, but there are no queries in the last 28 days. Add keywords by hand, or wait for Google to see traffic.",
    warnImportFailed:
      "Connection worked, import failed. Retry or add keywords by hand.",
    pullCta: "Load GSC history",
    pullHint:
      "The chart and clicks come from a second load. If it stays empty, start Inngest (`bun inngest`) then hit this button.",
    adsCta: "Connect Google Ads",
    adsHint:
      "Optional. We cross your paid search terms with organic: stop spend, pages to write.",
    adsConnected: "Google Ads is linked. We imported search terms for the last 30 days.",
    adsNoAccount:
      "No readable Ads client account. Sign in with the Google that owns the Ads account, or link a client under the manager.",
    adsTokenTest:
      "The Ads developer token is still test-only. Apply for Basic access at ads.google.com/aw/apicenter (you, once). Customers do nothing.",
    adsImportFailed:
      "Ads connected, search-term import failed. Retry from Settings.",
    adsMissingToken:
      "Google Ads is not configured on this server (GOOGLE_ADS_DEVELOPER_TOKEN).",
    adsRetry: "Retry Ads import",
  },
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
