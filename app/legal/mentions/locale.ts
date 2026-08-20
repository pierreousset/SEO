const fr = {
  title: "Mentions légales",
  updated: "Dernière mise à jour : 19 août 2026",
  sections: [
    {
      heading: "Éditeur",
      body: "Le site seo.240company.com est édité par 240 Company. Directeur de la publication : Pierre Ousset. Contact : contact@240company.com. Les numéros d'immatriculation (SIRET, TVA) seront publiés ici dès qu'ils seront attribués.",
    },
    {
      heading: "Hébergement",
      body: "Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.",
    },
    {
      heading: "Produit",
      body: "SEO Dashboard est un logiciel en ligne (SaaS) de coaching SEO, proposé en formule gratuite et en formule Pro. Les conditions d'utilisation figurent dans les CGV.",
    },
  ],
};

const en: typeof fr = {
  title: "Legal notice",
  updated: "Last updated: 19 August 2026",
  sections: [
    {
      heading: "Publisher",
      body: "seo.240company.com is published by 240 Company. Publication director: Pierre Ousset. Contact: contact@240company.com. Company registration numbers (SIRET, VAT) will be listed here once issued.",
    },
    {
      heading: "Hosting",
      body: "The site is hosted by Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, United States.",
    },
    {
      heading: "Product",
      body: "SEO Dashboard is an online SEO coaching product, offered as a free plan and a Pro plan. Terms of use are in the Terms page.",
    },
  ],
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
