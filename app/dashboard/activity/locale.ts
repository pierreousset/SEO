// Per-page i18n strings for /dashboard/activity.

const fr = {
  headerKicker: (days: number) => `Activité concurrents · ${days} derniers jours`,
  title: "Activité",

  emptyKeywordsTitle:
    "Suivez d'abord quelques mots-clés — le flux fait remonter ce que vos concurrents ont fait sur",
  emptyKeywordsTitleEmphasis: "votre",
  emptyKeywordsTitleSuffix: "SERP cette semaine.",
  emptyKeywordsCta: "Ajouter des mots-clés",

  emptyEventsTitle: "Tout est calme côté concurrence.",
  emptyEventsBody: (days: number) =>
    `Aucun mouvement marquant détecté sur les ${days} derniers jours.`,
  emptyEventsHint:
    "Le flux a besoin d'au moins deux récupérations SERP quotidiennes par mot-clé. Si votre suivi est récent, revenez dans quelques jours.",

  statMovesUp: "Progressions",
  statMovesUpSubtitle: "concurrents qui gagnent du rang ou entrent dans le top 20",
  statMovesDown: "Reculs",
  statMovesDownSubtitle: "concurrents qui perdent du rang ou sortent du classement",
  statMostActive: "Le plus actif",
  statEventCount: (n: number) => `${n} événement${n > 1 ? "s" : ""}`,
  statNobody: "personne pour l'instant",

  notInTop100: "hors du top 100",
  pivotedUrl: "URL modifiée",

  ctaKicker: "creuser",
  ctaText:
    "Demandez au chat « Pourquoi [concurrent] a-t-il bondi de 10 positions sur [mot-clé] cette semaine ? » — il a accès au snapshot SERP, aux données GSC et à votre historique pour analyser.",

  auditLogTitle: "Journal d'audit",

  actionLabels: {
    keyword_added: "Mot-clé ajouté",
    keyword_removed: "Mot-clé supprimé",
    audit_triggered: "Audit du site lancé",
    brief_triggered: "Brief généré",
    crawl_triggered: "Crawl meta lancé",
    invite_sent: "Invitation envoyée",
    member_joined: "Membre rejoint",
    settings_updated: "Paramètres mis à jour",
    article_generated: "Article généré",
  } as Record<string, string>,

  eventLabels: {
    big_up: "Grosse progression",
    big_down: "Grosse chute",
    new_entry: "Nouvelle entrée",
    lost: "Rang perdu",
    url_swap: "Pivot d'URL",
  },
};

const en: typeof fr = {
  headerKicker: (days: number) => `Competitor activity · last ${days} days`,
  title: "Activity",

  emptyKeywordsTitle:
    "Track some keywords first — the feed surfaces what your competitors did on",
  emptyKeywordsTitleEmphasis: "your",
  emptyKeywordsTitleSuffix: "SERP in the last week.",
  emptyKeywordsCta: "Add keywords",

  emptyEventsTitle: "All quiet on the competitive front.",
  emptyEventsBody: (days: number) =>
    `No big moves detected in the last ${days} days.`,
  emptyEventsHint:
    "The feed needs at least two daily SERP fetches per keyword. If your tracking is fresh, check back in a few days.",

  statMovesUp: "Moves up",
  statMovesUpSubtitle: "competitors gained rank or entered top 20",
  statMovesDown: "Moves down",
  statMovesDownSubtitle: "competitors lost rank or dropped out",
  statMostActive: "Most active",
  statEventCount: (n: number) => `${n} event${n > 1 ? "s" : ""}`,
  statNobody: "nobody yet",

  notInTop100: "not in top 100",
  pivotedUrl: "pivoted URL",

  ctaKicker: "dig deeper",
  ctaText:
    "Ask the chat \"Why did [competitor] jump 10 positions on [keyword] this week?\" — it has access to the SERP snapshot, GSC data, and your history to reason about it.",

  auditLogTitle: "Audit log",

  actionLabels: {
    keyword_added: "Added keyword",
    keyword_removed: "Removed keyword",
    audit_triggered: "Ran site audit",
    brief_triggered: "Generated brief",
    crawl_triggered: "Ran meta crawl",
    invite_sent: "Sent invite",
    member_joined: "Member joined",
    settings_updated: "Updated settings",
    article_generated: "Generated article",
  },

  eventLabels: {
    big_up: "Big move up",
    big_down: "Big drop",
    new_entry: "New entry",
    lost: "Lost rank",
    url_swap: "URL pivot",
  },
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
