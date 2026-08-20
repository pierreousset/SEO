const fr = {
  title: "Conditions générales de vente",
  updated: "Dernière mise à jour : 19 août 2026",
  sections: [
    {
      heading: "Objet",
      body: "Ces conditions régissent l'accès à SEO Dashboard, un logiciel en ligne de coaching SEO édité par 240 Company. En créant un compte, vous les acceptez.",
    },
    {
      heading: "Comptes",
      body: "L'inscription se fait par e-mail et code à usage unique. Vous êtes responsable de l'accès à cette boîte mail. Un compte = un utilisateur. Les invitations équipe n'ouvrent pas un droit de revente du service.",
    },
    {
      heading: "Offres et prix",
      body: "Free : 10 mots-clés, 1 site, score de santé, 3 actions. Pro : 99€ TTC par mois (ou le prix affiché au moment du paiement), 100 mots-clés, brief hebdo, audit, écart concurrentiel, articles, alertes, équipe. Pas de packs de crédits. Le prix Pro est unique.",
    },
    {
      heading: "Paiement et reconduction",
      body: "Le paiement Pro est géré par Stripe, par abonnement mensuel. Il se reconduit tant que vous ne résiliez pas. La résiliation prend effet à la fin de la période en cours. Pas de remboursement au prorata, sauf obligation légale.",
    },
    {
      heading: "Rétractation",
      body: "Si vous êtes un consommateur dans l'UE, vous disposez de 14 jours pour vous rétracter. En demandant l'exécution immédiate de Pro (audit, brief, appels data), vous reconnaissez perdre ce droit une fois le service commencé, conformément à l'exception des contenus numériques.",
    },
    {
      heading: "Usage acceptable",
      body: "Pas de scraping abusif, pas de partage de compte hors équipe invitée, pas d'usage illégal du contenu généré. Les limites mensuelles (audits, briefs, etc.) existent pour protéger le service. Le dépassement peut être refusé jusqu'au mois suivant.",
    },
    {
      heading: "Données et propriété",
      body: "Vos contenus et vos données GSC restent les vôtres. Le logiciel, la marque et les modèles restent ceux de 240 Company. Nous pouvons supprimer un compte qui met le service en péril.",
    },
    {
      heading: "Responsabilité",
      body: "Le coach propose des priorités à partir de vos données. Ce n'est pas une garantie de classement Google. Le service est fourni « en l'état ». Notre responsabilité est limitée, pour un mois donné, au montant Pro payé ce mois, dans les limites du droit applicable.",
    },
    {
      heading: "Droit applicable",
      body: "Droit français. Litiges : tribunaux compétents du siège de 240 Company, sans priver un consommateur UE de son for de protection.",
    },
  ],
};

const en: typeof fr = {
  title: "Terms of sale",
  updated: "Last updated: 19 August 2026",
  sections: [
    {
      heading: "Purpose",
      body: "These terms govern access to SEO Dashboard, an online SEO coaching product published by 240 Company. Creating an account means you accept them.",
    },
    {
      heading: "Accounts",
      body: "Sign-in uses email and a one-time code. You are responsible for that inbox. One account is one user. Team invites are not a right to resell the service.",
    },
    {
      heading: "Plans and price",
      body: "Free: 10 keywords, 1 site, health score, 3 actions. Pro: 99€ per month including applicable tax (or the price shown at checkout), 100 keywords, weekly brief, audit, competitor gap, articles, alerts, team. No credit packs. Pro is a single price.",
    },
    {
      heading: "Payment and renewal",
      body: "Pro is billed by Stripe on a monthly subscription. It renews until you cancel. Cancellation takes effect at the end of the current period. No prorated refund unless the law requires one.",
    },
    {
      heading: "Withdrawal",
      body: "If you are an EU consumer, you have 14 days to withdraw. By asking for Pro to start immediately (audit, brief, data calls), you acknowledge losing that right once the service has begun, under the digital-content exception.",
    },
    {
      heading: "Acceptable use",
      body: "No abusive scraping, no account sharing outside invited team members, no illegal use of generated content. Monthly limits (audits, briefs, and so on) protect the service. Overages may be refused until the next month.",
    },
    {
      heading: "Data and IP",
      body: "Your content and GSC data stay yours. The software, brand, and templates stay 240 Company's. We may close an account that puts the service at risk.",
    },
    {
      heading: "Liability",
      body: "The coach ranks work from your data. It is not a Google ranking guarantee. The service is provided as available. For a given month, our liability is limited to the Pro amount paid that month, within applicable law.",
    },
    {
      heading: "Governing law",
      body: "French law. Disputes: courts of 240 Company's registered office, without stripping an EU consumer of their protective venue.",
    },
  ],
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
