// Per-page i18n strings for /dashboard/audit.

const fr = {
  headerKicker: "Audit du site",
  title: "Audit",
  runNewAudit: "Lancer un nouvel audit",
  runFirstAudit: "Lancer le premier audit",

  issuesFixed: (n: number) => `${n} problème${n !== 1 ? "s" : ""} corrigé${n !== 1 ? "s" : ""}`,
  newIssues: (n: number) => `${n} nouveau${n !== 1 ? "x" : ""} problème${n !== 1 ? "s" : ""}`,
  noChange: "Aucun changement",
  sinceLastAudit: "depuis le dernier audit",

  fixFirst: "à corriger en priorité",
  pagesAffected: (n: number) => `${n} page${n !== 1 ? "s" : ""} concernée${n !== 1 ? "s" : ""}`,
  defaultImpact: (n: number) =>
    `Corriger ce point pourrait améliorer le SEO sur ${n} page${n !== 1 ? "s" : ""}`,

  emptyTitle: "Aucun audit lancé pour l'instant",
  emptyDesc:
    "Lancez un audit pour vérifier vos pages et détecter les problèmes SEO. On crawle votre site et on contrôle titres, meta descriptions, H1, schemas, etc.",

  synthesisSkippedTitle: "Synthèse IA ignorée.",
  synthesisFreePlan:
    "L'offre gratuite ne livre que les findings bruts. Passez en Pro pour obtenir des actions priorisées par l'IA.",
  synthesisInsufficientCredits:
    "Crédits insuffisants pour lancer la synthèse IA (4 requis). Achetez un pack de crédits pour débloquer.",
  synthesisFallback: "La synthèse n'a pas pu s'exécuter sur cet audit.",
  findingsBelow: "Tous les findings sont listés ci-dessous.",
  manageBilling: "Gérer la facturation →",

  aiSynthesisKicker: "synthèse ia",
  topActions: "Actions prioritaires",
  siteWide: "site complet",
  effortMin: (min: number) => `~${min}min`,

  allFindings: (n: number) => `tous les findings (${n})`,
  findingCount: (n: number) => `${n} finding${n > 1 ? "s" : ""}`,

  impactEstimates: {
    title_missing: "Ajouter des titres pourrait améliorer la visibilité des pages concernées",
    meta_missing: "Les meta descriptions améliorent le CTR de 5 à 10%",
    h1_missing: "Des H1 manquants nuisent à la hiérarchie du contenu et à la crawlabilité",
    canonical_missing: "Les canonicals évitent les pénalités pour contenu dupliqué",
    alt_missing: "Le texte alt améliore la visibilité en image search et l'accessibilité",
    schema_missing: "Les données structurées activent les rich snippets dans les SERP",
    og_missing: "Les balises Open Graph améliorent le rendu sur les réseaux sociaux",
  } as Record<string, string>,
};

const en: typeof fr = {
  headerKicker: "Site audit",
  title: "Audit",
  runNewAudit: "Run new audit",
  runFirstAudit: "Run first audit",

  issuesFixed: (n: number) => `${n} issue${n !== 1 ? "s" : ""} fixed`,
  newIssues: (n: number) => `${n} new issue${n !== 1 ? "s" : ""}`,
  noChange: "No change",
  sinceLastAudit: "since last audit",

  fixFirst: "fix these first",
  pagesAffected: (n: number) => `${n} page${n !== 1 ? "s" : ""} affected`,
  defaultImpact: (n: number) =>
    `Fixing this could improve SEO for ${n} page${n !== 1 ? "s" : ""}`,

  emptyTitle: "No audit run yet",
  emptyDesc:
    "Run a site audit to check your pages for SEO issues. We crawl your site and check titles, meta descriptions, H1s, schema, and more.",

  synthesisSkippedTitle: "AI synthesis skipped.",
  synthesisFreePlan:
    "Free plan only delivers raw findings. Upgrade to Pro to get prioritized AI actions.",
  synthesisInsufficientCredits:
    "Not enough credits to run AI synthesis (4 needed). Buy a credit pack to unlock.",
  synthesisFallback: "Synthesis couldn't run on this audit.",
  findingsBelow: "All findings are still listed below.",
  manageBilling: "Manage billing →",

  aiSynthesisKicker: "ai synthesis",
  topActions: "Top actions",
  siteWide: "site-wide",
  effortMin: (min: number) => `~${min}min`,

  allFindings: (n: number) => `all findings (${n})`,
  findingCount: (n: number) => `${n} finding${n > 1 ? "s" : ""}`,

  impactEstimates: {
    title_missing: "Adding titles could improve visibility for affected pages",
    meta_missing: "Meta descriptions improve CTR by 5-10%",
    h1_missing: "Missing H1 tags hurt content hierarchy and crawlability",
    canonical_missing: "Canonicals prevent duplicate content penalties",
    alt_missing: "Alt text improves image search visibility and accessibility",
    schema_missing: "Structured data enables rich snippets in SERPs",
    og_missing: "Open Graph tags improve social media sharing appearance",
  },
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
