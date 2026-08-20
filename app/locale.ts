const fr = {
  brand: "SEO Dashboard",
  company: "240 Company",

  nav: {
    pricing: "Tarifs",
    how: "Comment ça marche",
    login: "Connexion",
    cta: "Commencer",
  },

  hero: {
    eyebrow: "Coach SEO, pas un énième tableau",
    title: "Quoi corriger. Dans quel ordre. Pourquoi.",
    titleLines: ["Quoi corriger.", "Dans quel ordre.", "Pourquoi."],
    subtitle:
      "Search Console montre des chiffres. On vous dit ce qui rapporte des clics cette semaine, à partir de vos vraies données.",
    cta: "Essayer gratuitement",
    micro: (price: number) => `Sans carte bancaire. 10 mots-clés offerts. Puis ${price}€/mois.`,
  },

  preview: {
    kicker: "aujourd'hui",
    score: "74",
    scoreLabel: "score seo",
    coach: "3 choses. Dans cet ordre.",
    first: "d'abord",
    label: "actions du jour",
    title: "3 choses à faire",
    items: [
      {
        title: "Améliorer le CTR de /tarifs",
        subtitle: "~40 clics/mois récupérables · pos 8.2",
      },
      {
        title: "Perdu : « audit seo agence »",
        subtitle: "1 200 impressions sur 28j, aucune sur 7j",
      },
      {
        title: "Pousser « brief contenu seo » en page 1",
        subtitle: "Actuellement #12. Haut de page 2.",
      },
    ],
    footnote: "Exemple. Chez vous, ce sont vos pages et vos requêtes.",
  },

  problem: {
    eyebrow: "Le vrai écart",
    title: "Vous avez déjà Search Console. Elle est gratuite.",
    subtitle: "Elle décrit. Elle ne décide pas.",
    leftLabel: "Search Console",
    rightLabel: "Ici",
    rows: [
      { gsc: "42 pages indexées", ours: "3 pages perdent du trafic. Celles-ci d'abord." },
      { gsc: "Position moyenne 14.4", ours: "Poussez ce mot-clé en page 1 cette semaine." },
      { gsc: "Un export CSV le dimanche soir", ours: "Un brief lundi matin, classé par impact." },
    ],
  },

  how: {
    eyebrow: "Méthode",
    title: "Trois étapes. Pas un cockpit.",
    steps: [
      {
        n: "01",
        title: "Connectez Search Console",
        body: "On lit vos clics, impressions et positions. Pas un crawl générique recollé sur votre marque.",
      },
      {
        n: "02",
        title: "On classe ce qui rapporte",
        body: "Chaque écart devient une action : titre à réécrire, page qui décroche, requête à pousser.",
      },
      {
        n: "03",
        title: "Vous faites les 3 premières",
        body: "Le lundi, un brief. Pas 80 graphiques. Trois décisions, dans l'ordre.",
      },
    ],
  },

  capabilities: {
    eyebrow: "Ce qui est dedans",
    title: "L'outil autour du coach, pas l'inverse.",
    lead: "Le brief est le produit. Le reste sert à le tenir à jour.",
    items: [
      {
        title: "Score de santé",
        body: "Un chiffre pour voir si le site va mieux cette semaine que la précédente.",
      },
      {
        title: "Audit on-page",
        body: "Titles, metas, canoniques, maillage. Priorisé, pas une liste de 400 warnings.",
      },
      {
        title: "Suivi de positions",
        body: "Vos mots-clés, vos alertes de chute. Avant que le trafic parte.",
      },
      {
        title: "Briefs et articles",
        body: "Plans et brouillons ancrés dans vos données GSC, pas dans un mot-clé inventé.",
      },
      {
        title: "Équipe",
        body: "Invitez un client ou un collègue. Ils voient le dashboard. Vous gardez le compte.",
      },
      {
        title: "Écart concurrentiel",
        body: "Ce qu'ils rankent et pas vous. Utile. Pas un substitut à Ahrefs.",
      },
    ],
  },

  quote: "Pas plus de data. Trois décisions.",

  compound: {
    eyebrow: "L'effet composé",
    title: "Les pages qui rankent continuent de rapporter.",
    subtitle:
      "Trois actions par semaine, mois après mois. Le trafic n'est pas linéaire.",
    widgetTitle: "Trafic composé",
    yearOf: (current: number, total: number) => `année ${current} sur ${total}`,
    endBalance: "Clics cumulés",
    contributed: "Effort",
    growth: "Croissance",
    crossover: (year: number) => `La croissance dépasse l'effort à l'année ${year}`,
    monthly: "Clics gagnés / mois",
    perMonth: (n: number) => `${n} / mois`,
    returnLabel: "Rendement",
    horizonLabel: "Horizon",
    yearsShort: (n: number) => `${n} ans`,
    rate: (n: number) => `${n}%`,
    summary: (monthly: number, rate: number, years: number) =>
      `${monthly} / mois · ${rate}% · ${years} ans`,
    play: "Lancer",
    footnote:
      "Illustration. Chez vous, les clics viennent de Search Console, pas d'un simulateur.",
  },

  pricing: {
    eyebrow: "Tarifs",
    title: "Un prix. Pas de packs cachés.",
    subtitle: "Commencez gratuit. Passez Pro quand le brief vous fait gagner une heure.",
    vat: "Prix TTC, hors options. Résiliable à tout moment.",
    free: {
      name: "Free",
      price: "0€",
      period: "",
      cta: "Créer un compte",
      features: [
        "10 mots-clés suivis",
        "1 site",
        "Search Console connectée",
        "Score de santé",
        "3 actions visibles",
        "10 messages de chat, une fois",
      ],
    },
    pro: {
      name: "Pro",
      period: "/mois",
      cta: "Commencer gratuit, upgrader après",
      features: [
        "100 mots-clés suivis",
        "Brief hebdo classé par impact",
        "Audit de site",
        "Écart concurrentiel",
        "Générateur d'articles",
        "Alertes de chute",
        "Invitations équipe",
        "500 messages de chat / mois",
      ],
    },
  },

  faq: {
    eyebrow: "Questions",
    title: "Sans langue de bois.",
    items: [
      {
        q: "C'est quoi la différence avec Search Console ?",
        a: "Search Console est la source. On ne la remplace pas. On lit vos lignes et on les transforme en une liste d'actions ordonnée par clics récupérables.",
      },
      {
        q: "Pourquoi 99€, pas 15€ ?",
        a: "Un audit, un brief et des appels Search Console / SEO data ont un coût réel. 99€ est le prix du forfait Pro. Le free existe pour voir si le coach vous parle avant de payer.",
      },
      {
        q: "C'est une alternative à Semrush ?",
        a: "Non, pas au sens index mondial de backlinks. Semrush est une suite de data. Ici, un coach branché sur votre Search Console. Moins de chiffres. Plus de décisions.",
      },
      {
        q: "Mes données restent à moi ?",
        a: "Oui. On stocke ce qu'il faut pour le brief et le suivi. Pas de revente. Le détail est dans la politique de confidentialité.",
      },
      {
        q: "Je peux arrêter quand je veux ?",
        a: "Oui. Le free n'expire pas. Pro se résilie depuis la facturation, fin de période en cours.",
      },
    ],
  },

  close: {
    title: "Prêt à savoir quoi faire lundi ?",
    subtitle: "Un e-mail. Un code. Pas de mot de passe.",
    formTitle: "Créer votre espace",
  },

  auth: {
    placeholder: "vous@agence.fr",
    submit: "Envoyer le code",
    sending: "Envoi du code…",
    error: "Impossible d'envoyer le code. Réessayez.",
  },

  footer: {
    tagline: "Un coach SEO, par 240 Company.",
    mentions: "Mentions légales",
    privacy: "Confidentialité",
    terms: "CGV",
    copyright: (year: number) => `© ${year} 240 Company`,
  },

  meta: {
    title: "SEO Dashboard — Quoi corriger, dans quel ordre",
    description:
      "Coach SEO branché sur Search Console. Brief hebdo, audit, suivi de positions. 99€/mois après un free sans carte. Par 240 Company.",
  },
};

const en: typeof fr = {
  brand: "SEO Dashboard",
  company: "240 Company",

  nav: {
    pricing: "Pricing",
    how: "How it works",
    login: "Log in",
    cta: "Get started",
  },

  hero: {
    eyebrow: "An SEO coach, not another dashboard",
    title: "What to fix. In what order. Why.",
    titleLines: ["What to fix.", "In what order.", "Why."],
    subtitle:
      "Search Console shows numbers. We tell you which fixes win clicks this week, from your actual data.",
    cta: "Start free",
    micro: (price: number) => `No credit card. 10 keywords included. Then ${price}€/mo.`,
  },

  preview: {
    kicker: "today",
    score: "74",
    scoreLabel: "seo health",
    coach: "3 things. In this order.",
    first: "first",
    label: "today's actions",
    title: "3 things to do",
    items: [
      {
        title: "Improve CTR on /pricing",
        subtitle: "~40 recoverable clicks/mo · pos 8.2",
      },
      {
        title: "Lost: “agency seo audit”",
        subtitle: "1,200 impressions in 28d, none in 7d",
      },
      {
        title: "Push “seo content brief” to page 1",
        subtitle: "Currently #12. Top of page 2.",
      },
    ],
    footnote: "Example. Yours will be your pages and queries.",
  },

  problem: {
    eyebrow: "The actual gap",
    title: "You already have Search Console. It's free.",
    subtitle: "It describes. It does not decide.",
    leftLabel: "Search Console",
    rightLabel: "Here",
    rows: [
      { gsc: "42 pages indexed", ours: "3 pages are losing traffic. These first." },
      { gsc: "Average position 14.4", ours: "Push this keyword to page 1 this week." },
      { gsc: "A CSV export on Sunday night", ours: "A Monday brief, ranked by impact." },
    ],
  },

  how: {
    eyebrow: "Method",
    title: "Three steps. Not a cockpit.",
    steps: [
      {
        n: "01",
        title: "Connect Search Console",
        body: "We read your clicks, impressions, and positions. Not a generic crawl stamped with your brand.",
      },
      {
        n: "02",
        title: "We rank what pays",
        body: "Each gap becomes an action: a title to rewrite, a sliding page, a query to push.",
      },
      {
        n: "03",
        title: "You do the first three",
        body: "Monday, a brief. Not 80 charts. Three decisions, in order.",
      },
    ],
  },

  capabilities: {
    eyebrow: "What's inside",
    title: "The tool exists to serve the coach.",
    lead: "The brief is the product. Everything else keeps it honest.",
    items: [
      {
        title: "Health score",
        body: "One number to see if the site is better this week than last.",
      },
      {
        title: "On-page audit",
        body: "Titles, metas, canonicals, internal links. Prioritized, not 400 warnings.",
      },
      {
        title: "Rank tracking",
        body: "Your keywords, your drop alerts. Before the traffic leaves.",
      },
      {
        title: "Briefs and drafts",
        body: "Outlines and articles anchored in your GSC data, not a made-up keyword.",
      },
      {
        title: "Team",
        body: "Invite a client or a colleague. They see the dashboard. You keep the account.",
      },
      {
        title: "Competitor gap",
        body: "What they rank for and you don't. Useful. Not an Ahrefs stand-in.",
      },
    ],
  },

  quote: "Not more data. Three decisions.",

  compound: {
    eyebrow: "Compounding",
    title: "Pages that rank keep paying out.",
    subtitle:
      "Three actions a week, month after month. Traffic is not linear.",
    widgetTitle: "Compound traffic",
    yearOf: (current: number, total: number) => `year ${current} of ${total}`,
    endBalance: "Cumulative clicks",
    contributed: "Effort",
    growth: "Growth",
    crossover: (year: number) => `Growth passes effort in year ${year}`,
    monthly: "Clicks gained / month",
    perMonth: (n: number) => `${n} / mo`,
    returnLabel: "Return",
    horizonLabel: "Horizon",
    yearsShort: (n: number) => `${n}y`,
    rate: (n: number) => `${n}%`,
    summary: (monthly: number, rate: number, years: number) =>
      `${monthly}/mo · ${rate}% · ${years} yr`,
    play: "Play sweep",
    footnote:
      "Illustration. Yours will be Search Console clicks, not a simulator.",
  },

  pricing: {
    eyebrow: "Pricing",
    title: "One price. No hidden packs.",
    subtitle: "Start free. Go Pro when the brief saves you an hour.",
    vat: "Prices include VAT where applicable. Cancel anytime.",
    free: {
      name: "Free",
      price: "0€",
      period: "",
      cta: "Create an account",
      features: [
        "10 keywords tracked",
        "1 site",
        "Search Console connected",
        "Health score",
        "Top 3 actions",
        "10 chat messages, once",
      ],
    },
    pro: {
      name: "Pro",
      period: "/mo",
      cta: "Start free, upgrade later",
      features: [
        "100 keywords tracked",
        "Weekly brief ranked by impact",
        "Site audit",
        "Competitor gap",
        "Article generator",
        "Drop alerts",
        "Team invites",
        "500 chat messages / month",
      ],
    },
  },

  faq: {
    eyebrow: "Questions",
    title: "Straight answers.",
    items: [
      {
        q: "How is this different from Search Console?",
        a: "Search Console is the source. We don't replace it. We turn your rows into an action list ordered by recoverable clicks.",
      },
      {
        q: "Why 99€, not 15€?",
        a: "Audits, briefs, and Search Console / SEO data calls have a real cost. 99€ is the Pro plan. Free exists so you can hear the coach before you pay.",
      },
      {
        q: "Is this a Semrush alternative?",
        a: "Not in the global backlink-index sense. Semrush is a data suite. This is a coach on your Search Console. Fewer numbers. More decisions.",
      },
      {
        q: "Do I keep my data?",
        a: "Yes. We store what the brief and tracking need. No resale. Details are in the privacy policy.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes. Free does not expire. Pro cancels from billing, at the end of the current period.",
      },
    ],
  },

  close: {
    title: "Ready to know what to do on Monday?",
    subtitle: "An email. A code. No password.",
    formTitle: "Create your workspace",
  },

  auth: {
    placeholder: "you@studio.com",
    submit: "Send the code",
    sending: "Sending code…",
    error: "Couldn't send the code. Try again.",
  },

  footer: {
    tagline: "An SEO coach, by 240 Company.",
    mentions: "Legal notice",
    privacy: "Privacy",
    terms: "Terms",
    copyright: (year: number) => `© ${year} 240 Company`,
  },

  meta: {
    title: "SEO Dashboard — What to fix, in what order",
    description:
      "SEO coach on Search Console. Weekly brief, audit, rank tracking. 99€/mo after a free tier with no card. By 240 Company.",
  },
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
