const fr = {
  title: "Politique de confidentialité",
  updated: "Dernière mise à jour : 19 août 2026",
  sections: [
    {
      heading: "Qui est responsable",
      body: "240 Company, éditeur de SEO Dashboard (seo.240company.com). Contact : contact@240company.com.",
    },
    {
      heading: "Données que nous traitons",
      body: "Compte : e-mail, date de création, langue. Produit : données Search Console que vous connectez (pages, requêtes, clics, impressions, positions), contenus générés (briefs, articles), usage (limites mensuelles). Paiement : géré par Stripe. Nous ne stockons pas le numéro de carte.",
    },
    {
      heading: "Finalités et bases",
      body: "Fournir le service (contrat). Facturer Pro (contrat). Sécurité et abus (intérêt légitime). E-mails transactionnels : code de connexion, alertes, brief (contrat). Pas de newsletter marketing sans consentement.",
    },
    {
      heading: "Sous-traitants",
      body: "Neon (base Postgres), Vercel (hébergement), Stripe (paiement), Resend (e-mail), Google (Search Console OAuth, si vous connectez), Anthropic et autres LLM (génération de briefs, si activé), DataForSEO (données SEO, si une fonctionnalité l'appelle). Chacun n'accède qu'à ce dont il a besoin.",
    },
    {
      heading: "Cookies",
      body: "Cookie de session d'authentification. Cookie locale (fr/en) pour la langue. Cookie ref_code si vous arrivez via un lien de parrainage. Pas de cookie publicitaire tiers.",
    },
    {
      heading: "Durée et droits",
      body: "Les données de compte sont gardées tant que le compte existe. Vous pouvez demander l'accès, la correction, l'export ou la suppression : contact@240company.com. Vous pouvez aussi saisir la CNIL.",
    },
    {
      heading: "Transferts",
      body: "Certains sous-traitants sont aux États-Unis (Vercel, Stripe, Google, Anthropic). Les transferts reposent sur leurs clauses contractuelles types.",
    },
  ],
};

const en: typeof fr = {
  title: "Privacy policy",
  updated: "Last updated: 19 August 2026",
  sections: [
    {
      heading: "Controller",
      body: "240 Company, publisher of SEO Dashboard (seo.240company.com). Contact: contact@240company.com.",
    },
    {
      heading: "Data we process",
      body: "Account: email, created date, language. Product: Search Console data you connect (pages, queries, clicks, impressions, positions), generated content (briefs, articles), usage (monthly limits). Payment: handled by Stripe. We do not store card numbers.",
    },
    {
      heading: "Purposes and legal bases",
      body: "Provide the service (contract). Bill Pro (contract). Security and abuse (legitimate interest). Transactional email: sign-in code, alerts, brief (contract). No marketing newsletter without consent.",
    },
    {
      heading: "Processors",
      body: "Neon (Postgres), Vercel (hosting), Stripe (payments), Resend (email), Google (Search Console OAuth, if you connect it), Anthropic and other LLMs (brief generation, when enabled), DataForSEO (SEO data, when a feature calls it). Each only gets what it needs.",
    },
    {
      heading: "Cookies",
      body: "Auth session cookie. Locale cookie (fr/en). ref_code cookie if you arrive via a referral link. No third-party ad cookies.",
    },
    {
      heading: "Retention and rights",
      body: "Account data is kept while the account exists. You can request access, correction, export, or deletion: contact@240company.com. You may also contact your local data authority (CNIL in France).",
    },
    {
      heading: "Transfers",
      body: "Some processors are in the United States (Vercel, Stripe, Google, Anthropic). Transfers rely on their standard contractual clauses.",
    },
  ],
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
