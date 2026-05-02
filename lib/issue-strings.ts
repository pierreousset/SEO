// Issue-detection strings, surfaced to detectPageIssues/detectKeywordIssues.
// Pages pass their locale dict so issues render in the user's language.
// Backend cron paths (lib/seo-score-recompute.ts) call without strings and
// fall through to issueStringsEN (English) — those records get rebuilt
// from data anyway, so storage in English is acceptable.

export type IssueEntry = {
  title: (count: number) => string;
  description: string;
  impact: (value: number) => string;
  whyItMatters: string;
};

export type IssueDict = {
  declining_traffic: IssueEntry;
  low_ctr_for_position: IssueEntry;
  zero_clicks: IssueEntry;
  quick_win: IssueEntry;
  title_missing: IssueEntry;
  title_short: IssueEntry;
  meta_missing: IssueEntry;
  not_in_sitemap: IssueEntry;
  keyword_dropping: IssueEntry;
  keyword_opportunity: IssueEntry;
  keyword_low_ctr: IssueEntry;
};

export type SeverityStrings = {
  high: string;
  medium: string;
  low: string;
};

export const issueStringsEN: IssueDict = {
  declining_traffic: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} losing traffic`,
    description:
      "These pages lost more than 30% of their clicks compared to the previous period.",
    impact: (clicksLost) => `~${clicksLost} clicks lost`,
    whyItMatters:
      "A sudden traffic drop usually means a competitor published better content, Google changed how it interprets the query, or your page's freshness signal decayed. Check what changed.",
  },
  low_ctr_for_position: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} with low click-through rate`,
    description:
      "These pages rank well but get fewer clicks than expected. Usually means the title or meta description doesn't match what users are looking for.",
    impact: (clicksGain) => `Improving titles could add ~${clicksGain} clicks/month`,
    whyItMatters:
      "Your page appears in search results but users skip it. The title tag is the #1 factor for click-through rate. A good title matches the searcher's intent and includes the keyword naturally.",
  },
  zero_clicks: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} with zero clicks`,
    description: "These pages show in search results but nobody clicks them.",
    impact: (clicksRecover) =>
      `Potential to recover ${clicksRecover} clicks/month with better titles`,
    whyItMatters:
      "A page that gets impressions but zero clicks is wasting its position. Either the title doesn't match the intent, or the page targets queries nobody actually wants to click on.",
  },
  quick_win: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} close to page 1`,
    description:
      "These pages rank on page 2 with significant search volume. A small improvement could push them to page 1.",
    impact: () => "Moving to page 1 typically increases clicks by 5-10x",
    whyItMatters:
      "Page 2 of Google gets less than 1% of clicks. Page 1 gets 90%+. The difference between position 11 and position 10 is enormous. Focus your content improvement efforts here first.",
  },
  title_missing: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} missing title`,
    description: "Pages without a title tag rank poorly and get almost no clicks.",
    impact: () => "Adding titles is the highest-impact SEO fix",
    whyItMatters:
      "The title tag is the first thing Google and users see. Without it, Google generates one from your page content, which is almost always worse.",
  },
  title_short: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} with short titles`,
    description:
      "Titles under 30 characters miss keyword opportunities. Aim for 30-60 characters.",
    impact: () => "Better titles = higher CTR",
    whyItMatters:
      "Short titles miss the chance to rank for related queries. A 30-60 char title gives you room for the primary keyword + a benefit hook.",
  },
  meta_missing: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} missing meta description`,
    description:
      "Google shows the meta description in search results. Without one, it grabs random text from your page.",
    impact: () => "Good meta descriptions improve CTR by 5-10%",
    whyItMatters:
      "The meta description is your ad copy in search results. It doesn't directly affect ranking, but it affects whether people click. Write it like a call to action.",
  },
  not_in_sitemap: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} not in sitemap`,
    description: "These pages are indexed but not listed in your sitemap.xml.",
    impact: () => "Adding them helps Google discover and re-crawl them faster",
    whyItMatters:
      "A sitemap is a hint to Google about which pages to crawl. Pages outside it can still be discovered via internal links, but they get crawled less often and rank slower.",
  },
  keyword_dropping: {
    title: (n) => `${n} keyword${n > 1 ? "s" : ""} dropping fast`,
    description: "These keywords lost 5+ positions in the last 7 days.",
    impact: () => "Each lost position on page 1 costs ~30% of clicks",
    whyItMatters:
      "A sudden position drop usually means a competitor published better content or Google re-evaluated your page. Check the SERP for these queries and see what changed.",
  },
  keyword_opportunity: {
    title: (n) => `${n} keyword${n > 1 ? "s" : ""} close to top 3`,
    description:
      "These keywords are on page 1 but not in the top 3, where most clicks go.",
    impact: () => "Top 3 gets 54% of all clicks vs 12% for positions 4-10",
    whyItMatters:
      "Positions 1-3 get dramatically more clicks than 4-10. Improving your content depth, internal linking, and title for these queries can push you into the high-click zone.",
  },
  keyword_low_ctr: {
    title: (n) => `${n} keyword${n > 1 ? "s" : ""} with low CTR`,
    description:
      "These keywords rank decently but get fewer clicks than expected for their position.",
    impact: () => "Improving titles + meta descriptions for these could double their clicks",
    whyItMatters:
      "When your CTR is below average for your position, it tells Google your result isn't what searchers want. This can lead to further ranking drops. Fix the title to match the search intent.",
  },
};

export const issueStringsFR: IssueDict = {
  declining_traffic: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} en perte de trafic`,
    description:
      "Ces pages ont perdu plus de 30 % de leurs clics par rapport à la période précédente.",
    impact: (clicksLost) => `~${clicksLost} clics perdus`,
    whyItMatters:
      "Une chute soudaine signifie souvent qu'un concurrent a publié un meilleur contenu, que Google a changé sa lecture de la requête, ou que le signal de fraîcheur de la page s'est dégradé. Va voir ce qui a changé.",
  },
  low_ctr_for_position: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} avec un faible taux de clic`,
    description:
      "Ces pages se positionnent bien mais obtiennent moins de clics qu'attendu. Souvent un titre ou une meta qui ne colle pas à l'intention.",
    impact: (clicksGain) => `Améliorer les titres pourrait ajouter ~${clicksGain} clics/mois`,
    whyItMatters:
      "Ta page apparaît mais l'utilisateur passe à côté. Le titre est le facteur n°1 du CTR. Un bon titre matche l'intention et inclut le mot-clé naturellement.",
  },
  zero_clicks: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} sans aucun clic`,
    description: "Ces pages apparaissent dans les résultats mais personne ne clique.",
    impact: (clicksRecover) =>
      `Potentiel de récupérer ${clicksRecover} clics/mois avec de meilleurs titres`,
    whyItMatters:
      "Une page qui obtient des impressions mais zéro clic gaspille sa position. Soit le titre ne matche pas l'intention, soit la page cible des requêtes que personne ne clique.",
  },
  quick_win: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} proche${n > 1 ? "s" : ""} de la page 1`,
    description:
      "Ces pages se positionnent en page 2 avec un volume de recherche significatif. Une petite amélioration peut les pousser en page 1.",
    impact: () => "Passer en page 1 multiplie typiquement les clics par 5-10",
    whyItMatters:
      "La page 2 de Google récolte moins de 1 % des clics. La page 1 en récolte 90 %+. La différence entre la position 11 et la 10 est énorme. Concentre tes efforts ici en premier.",
  },
  title_missing: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} sans balise title`,
    description: "Les pages sans title se positionnent mal et n'obtiennent presque aucun clic.",
    impact: () => "Ajouter les titles est le correctif SEO à plus fort impact",
    whyItMatters:
      "Le title est la première chose que Google et l'utilisateur voient. Sans, Google en génère un à partir du contenu — presque toujours moins bon.",
  },
  title_short: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} avec un title trop court`,
    description:
      "Les titles de moins de 30 caractères ratent des opportunités de mots-clés. Vise 30-60 caractères.",
    impact: () => "Meilleurs titles = meilleur CTR",
    whyItMatters:
      "Un title trop court rate des requêtes connexes. 30-60 caractères donnent de la place pour le mot-clé principal + un crochet bénéfice.",
  },
  meta_missing: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} sans meta description`,
    description:
      "Google affiche la meta description dans les résultats. Sans, il prend du texte au hasard sur la page.",
    impact: () => "De bonnes meta descriptions améliorent le CTR de 5 à 10 %",
    whyItMatters:
      "La meta description, c'est ton ad copy dans les résultats. Elle n'influence pas directement le ranking, mais elle décide qui clique. Écris-la comme un appel à l'action.",
  },
  not_in_sitemap: {
    title: (n) => `${n} page${n > 1 ? "s" : ""} absente${n > 1 ? "s" : ""} du sitemap`,
    description: "Ces pages sont indexées mais ne figurent pas dans ton sitemap.xml.",
    impact: () => "Les ajouter aide Google à les découvrir et re-crawler plus vite",
    whyItMatters:
      "Le sitemap indique à Google quelles pages crawler. Sans, elles peuvent être trouvées via les liens internes mais sont crawlées moins souvent et rankent plus lentement.",
  },
  keyword_dropping: {
    title: (n) => `${n} mot${n > 1 ? "s" : ""}-clé${n > 1 ? "s" : ""} en chute libre`,
    description: "Ces mots-clés ont perdu 5+ positions en 7 jours.",
    impact: () => "Chaque position perdue en page 1 coûte ~30 % de clics",
    whyItMatters:
      "Une chute soudaine signale souvent qu'un concurrent a publié mieux ou que Google a réévalué ta page. Vérifie la SERP pour ces requêtes.",
  },
  keyword_opportunity: {
    title: (n) => `${n} mot${n > 1 ? "s" : ""}-clé${n > 1 ? "s" : ""} proche${n > 1 ? "s" : ""} du top 3`,
    description:
      "Ces mots-clés sont en page 1 mais pas dans le top 3, là où vont la majorité des clics.",
    impact: () => "Le top 3 récolte 54 % des clics vs 12 % pour les positions 4-10",
    whyItMatters:
      "Les positions 1-3 récoltent énormément plus de clics que les 4-10. Améliore la profondeur de contenu, le maillage interne et le title pour pousser dans la zone à fort clic.",
  },
  keyword_low_ctr: {
    title: (n) => `${n} mot${n > 1 ? "s" : ""}-clé${n > 1 ? "s" : ""} avec un CTR faible`,
    description: "Ces mots-clés se positionnent correctement mais reçoivent moins de clics qu'attendu.",
    impact: () => "Améliorer les titles + meta descriptions pourrait doubler leurs clics",
    whyItMatters:
      "Un CTR sous la moyenne pour ta position dit à Google que ton résultat ne colle pas. Ça peut entraîner d'autres baisses. Corrige le title pour matcher l'intention.",
  },
};

// Backwards-compat alias used by detectPageIssues / detectKeywordIssues
// when no strings are passed (cron + recompute paths).
export const defaultIssueStrings = issueStringsEN;

export const severityStrings: Record<"fr" | "en", SeverityStrings> = {
  fr: { high: "élevé", medium: "moyen", low: "faible" },
  en: { high: "high", medium: "medium", low: "low" },
};
