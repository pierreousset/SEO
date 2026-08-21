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
      "Mots-clés à volume (données Google Ads via DataForSEO), à partir de votre activité et de votre site — pas seulement ce que Search Console a déjà vu.",
    gsc: "Requêtes où vous apparaissez déjà, mais que vous ne suivez pas.",
    competitors: "Mots-clés sur lesquels vos concurrents se classent, pas vous.",
    ai: "Candidats générés à partir du profil business (sans volume mesuré).",
  },
  ideas: {
    intro:
      "On part du service + des villes du profil, et des mots-clés liés au domaine. Volume réel, difficulté, intention. Limité à 8 recherches/mois, 12 h entre deux.",
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
      "Volume-backed keywords (Google Ads data via DataForSEO) from your business and domain — not only what Search Console already saw.",
    gsc: "Queries you already appear for but don't track.",
    competitors: "Keywords competitors rank for, you don't.",
    ai: "Candidates from the business profile (no measured volume).",
  },
  ideas: {
    intro:
      "Seeded from your services + cities, plus keywords in the same category as your domain. Limited to 8 searches/month, 12 h apart.",
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
