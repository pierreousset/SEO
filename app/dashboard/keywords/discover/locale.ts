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
      "Idées à volume (Google Ads) autour de votre service et de vos villes — ou du titre de votre site si le profil est vide. Uniquement des requêtes proches de votre activité.",
    gsc: "Requêtes où vous apparaissez déjà, mais que vous ne suivez pas.",
    competitors: "Mots-clés sur lesquels vos concurrents se classent, pas vous.",
    ai: "Candidats générés à partir du profil business (sans volume mesuré).",
  },
  ideas: {
    intro:
      "On part de votre service + villes (profil business), sinon du titre de votre site. Puis seulement des idées qui parlent de la même activité — pas un dump générique. 8 recherches/mois une fois une liste obtenue.",
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
      "Volume-backed ideas (Google Ads) around your service and cities — or your site title if the profile is empty. Only queries close to your activity.",
    gsc: "Queries you already appear for but don't track.",
    competitors: "Keywords competitors rank for, you don't.",
    ai: "Candidates from the business profile (no measured volume).",
  },
  ideas: {
    intro:
      "We start from your service + cities (business profile), or your site title if that's empty. Then only ideas that match that activity — not a generic dump. 8 searches/month once you have a list.",
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
