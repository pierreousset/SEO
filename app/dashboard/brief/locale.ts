// Per-page i18n strings for /dashboard/brief.

const fr = {
  weekly: "Hebdo",
  title: "Brief",

  upgradeFeature: "Brief IA hebdomadaire",
  upgradeDescription:
    "Recevez un brief IA chaque semaine analysant les mouvements de mots-clés, les top movers et des actions concrètes. Passez en Pro pour le débloquer.",

  emptyTitle: "Aucun brief généré pour l'instant",
  emptyDescWithData:
    "Une fois que vous avez des données de position, générez votre premier brief IA. Il analyse votre SEO et crée un plan d'action hebdo.",
  emptyDescNoData:
    "Aucune donnée pour l'instant. Lancez d'abord une récupération SERP, puis générez le brief.",

  weekOf: (start: string, end: string) => `Semaine du ${start} → ${end}`,
  weeklyBrief: "Brief hebdo",
  regenerate: "Régénérer",

  prioritiesKicker: "priorités de la semaine",

  healthTrend: "tendance du score de santé",

  statMoversAnalysed: "Movers analysés",
  statActionsQueued: "Actions en file",
  statHighPriority: "Haute priorité",

  thisWeek: "cette semaine",
  actionsTitle: "Actions",
  ticketCount: (n: number) =>
    `${n} ticket${n > 1 ? "s" : ""} généré${n > 1 ? "s" : ""} à partir des mouvements ci-dessus.`,
  markDoneAria: (action: string) => `Marquer le ticket comme fait : ${action}`,
  effortMin: (min: number) => `~${min}min`,

  moversTitle: "Top movers",
  hypothesisBadge: "hypothèse",

  warningsKicker: "avertissements",
};

const en: typeof fr = {
  weekly: "Weekly",
  title: "Brief",

  upgradeFeature: "Weekly AI Brief",
  upgradeDescription:
    "Get a weekly AI-generated brief analyzing your keyword movements, top movers, and actionable tickets. Upgrade to Pro to unlock.",

  emptyTitle: "No brief generated yet",
  emptyDescWithData:
    "Once you have position data, generate your first AI brief. It analyzes your SEO and creates a weekly action plan.",
  emptyDescNoData:
    "No data yet. Run a SERP fetch first, then generate the brief.",

  weekOf: (start: string, end: string) => `Week of ${start} → ${end}`,
  weeklyBrief: "Weekly brief",
  regenerate: "Regenerate",

  prioritiesKicker: "this week's priorities",

  healthTrend: "health score trend",

  statMoversAnalysed: "Movers analysed",
  statActionsQueued: "Actions queued",
  statHighPriority: "High priority",

  thisWeek: "this week",
  actionsTitle: "Actions",
  ticketCount: (n: number) =>
    `${n} ticket${n > 1 ? "s" : ""} generated from the movers above.`,
  markDoneAria: (action: string) => `Mark ticket as done: ${action}`,
  effortMin: (min: number) => `~${min}min`,

  moversTitle: "Top movers",
  hypothesisBadge: "hypothesis",

  warningsKicker: "warnings",
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
