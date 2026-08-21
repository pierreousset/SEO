const fr = {
  title: "Découvrir des mots-clés",
  subtitle:
    "Search Console montre ce que vous avez déjà. Ici on cherche les requêtes que les gens tapent vraiment — volume, difficulté, intention — pour viser plus loin.",
  tabs: {
    ideas: "Idées SEO",
    gsc: "Search Console",
    competitors: "Concurrents",
    ai: "IA",
  },
  tabDesc: {
    ideas:
      "Idées à volume (Google Ads via DataForSEO) : on part de votre service + villes, et des requêtes liées à votre domaine. Pas les mots-clés des concurrents (onglet dédié).",
    gsc: "Requêtes où vous apparaissez déjà, mais que vous ne suivez pas.",
    competitors: "Mots-clés sur lesquels vos concurrents se classent, pas vous.",
    ai: "Candidats générés à partir du profil business (sans volume mesuré).",
  },
  ideas: {
    intro:
      "Deux sources : (1) idées autour de votre service et de vos villes, (2) requêtes de la même catégorie que votre site. Volume et difficulté Google Ads. Les concurrents sont l'onglet à côté. 8 recherches/mois, 12 h entre deux — seulement une fois que vous avez déjà une liste.",
    pull: "Chercher des idées",
    pulling: "Recherche…",
    refresh: "Actualiser",
    lastFetched: (when: string) => `Dernière recherche : ${when}`,
    add: (n: number) => (n > 0 ? `Ajouter ${n} au suivi` : "Ajouter au suivi"),
    adding: "Ajout…",
    filter: "Filtrer…",
    minVolume: "Volume min.",
    shown: (n: number, seeds: number) =>
      seeds > 0 ? `${n} idées · ${seeds} graines` : `${n} idées`,
    selected: (n: number) => `${n} sélectionnés`,
    thKeyword: "Mot-clé",
    thVolume: "Volume",
    thDifficulty: "Difficulté",
    thIntent: "Intent",
    thCpc: "CPC",
    thSource: "Source",
    thScore: "Score",
    sourceIdeas: "idées",
    sourceSite: "site",
    intent: {
      transactional: "transactionnel",
      commercial: "commercial",
      informational: "informationnel",
      navigational: "navigationnel",
    },
    added: (added: number, skipped: number) =>
      skipped > 0
        ? `${added} ajoutés · ${skipped} déjà suivis`
        : `${added} mot-clés ajoutés`,
    failed: "Échec de la recherche",
    addFailed: "Ajout impossible",
  },
};

const en: typeof fr = {
  title: "Discover keywords",
  subtitle:
    "Search Console shows queries you already appear for. Here we find what people actually type — volume, difficulty, intent — so you can target further.",
  tabs: {
    ideas: "SEO ideas",
    gsc: "Search Console",
    competitors: "Competitors",
    ai: "AI",
  },
  tabDesc: {
    ideas:
      "Volume-backed ideas (Google Ads via DataForSEO) from your service + cities, and queries in the same category as your domain. Not competitor keywords (that's the next tab).",
    gsc: "Queries you already appear for but don't track.",
    competitors: "Keywords competitors rank for, you don't.",
    ai: "Candidates from the business profile (no measured volume).",
  },
  ideas: {
    intro:
      "Two sources: (1) ideas around your service and cities, (2) queries in the same category as your site. Google Ads volume and difficulty. Competitors are the next tab. 8 searches/month, 12 h apart — only after you already have a list.",
    pull: "Find ideas",
    pulling: "Searching…",
    refresh: "Refresh",
    lastFetched: (when: string) => `Last search: ${when}`,
    add: (n: number) => (n > 0 ? `Add ${n} to tracking` : "Add to tracking"),
    adding: "Adding…",
    filter: "Filter…",
    minVolume: "Min. volume",
    shown: (n: number, seeds: number) =>
      seeds > 0 ? `${n} ideas · ${seeds} seeds` : `${n} ideas`,
    selected: (n: number) => `${n} selected`,
    thKeyword: "Keyword",
    thVolume: "Volume",
    thDifficulty: "Difficulty",
    thIntent: "Intent",
    thCpc: "CPC",
    thSource: "Source",
    thScore: "Score",
    sourceIdeas: "ideas",
    sourceSite: "site",
    intent: {
      transactional: "transactional",
      commercial: "commercial",
      informational: "informational",
      navigational: "navigational",
    },
    added: (added: number, skipped: number) =>
      skipped > 0
        ? `${added} added · ${skipped} already tracked`
        : `${added} keywords added`,
    failed: "Keyword research failed",
    addFailed: "Could not add keywords",
  },
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
