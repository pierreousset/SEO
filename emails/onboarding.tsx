import { Heading, Link, Text } from "@react-email/components";
import { EmailLayout, emailButton, emailColors, textStyles } from "./layout";

export function OnboardingWelcomeEmail({
  name,
  settingsUrl,
}: {
  name?: string | null;
  settingsUrl: string;
}) {
  const greeting = name ? `Bonjour ${name}` : "Bienvenue";
  const cta = emailButton("Connecter Search Console", settingsUrl);
  return (
    <EmailLayout preview="Trois étapes pour que le coach ait quelque chose à dire.">
      <Heading as="h1" style={textStyles.heading}>
        {greeting}.
      </Heading>
      <Text style={textStyles.body}>
        SEO Dashboard lit Search Console et vous dit quoi corriger. Pour
        commencer :
      </Text>
      <ol
        style={{
          margin: "0 0 24px",
          paddingLeft: 20,
          color: emailColors.slate,
          fontSize: 15,
          lineHeight: "26px",
        }}
      >
        <li>Connectez Google Search Console.</li>
        <li>Ajoutez les mots-clés que vous suivez.</li>
        <li>Lancez la première récupération.</li>
      </ol>
      <Link href={cta.href} style={cta.style}>
        {cta.label}
      </Link>
      <Text style={textStyles.muted}>Besoin d&apos;aide ? Répondez à cet e-mail.</Text>
    </EmailLayout>
  );
}

export function OnboardingFetchEmail({
  hasGscConnected,
  dashboardUrl,
  settingsUrl,
}: {
  hasGscConnected: boolean;
  dashboardUrl: string;
  settingsUrl: string;
}) {
  const cta = hasGscConnected
    ? emailButton("Ouvrir le dashboard", dashboardUrl)
    : emailButton("Connecter Search Console", settingsUrl);
  return (
    <EmailLayout
      preview={
        hasGscConnected
          ? "Search Console est liée. Lancez la première récupération."
          : "Connectez Search Console pour que le coach ait vos données."
      }
    >
      <Heading as="h1" style={textStyles.heading}>
        {hasGscConnected
          ? "C'est lié. Il reste à lancer."
          : "Vos données SEO attendent."}
      </Heading>
      <Text style={textStyles.body}>
        {hasGscConnected
          ? "Search Console est connectée. Lancez une récupération pour voir les positions et les 3 actions du jour."
          : "Sans Search Console, le dashboard n'a rien à classer. La connexion prend moins d'une minute."}
      </Text>
      <Link href={cta.href} style={cta.style}>
        {cta.label}
      </Link>
    </EmailLayout>
  );
}

export function OnboardingBriefEmail({
  isFreePlan,
  briefUrl,
  billingUrl,
}: {
  isFreePlan: boolean;
  briefUrl: string;
  billingUrl: string;
}) {
  const cta = emailButton("Lire le brief", briefUrl);
  return (
    <EmailLayout preview="Votre premier brief hebdo est prêt.">
      <Heading as="h1" style={textStyles.heading}>
        Votre premier brief est prêt.
      </Heading>
      <Text style={textStyles.body}>
        On a classé vos écarts : ce qui bouge, ce qui rapporte, quoi faire en
        premier. Pas 80 graphiques. Des décisions.
      </Text>
      <Link href={cta.href} style={cta.style}>
        {cta.label}
      </Link>
      {isFreePlan ? (
        <Text style={{ ...textStyles.body, marginTop: 24 }}>
          Le free montre 3 actions. Pro envoie le brief complet chaque lundi.{" "}
          <Link href={billingUrl} style={{ color: emailColors.teal }}>
            Voir Pro
          </Link>
          .
        </Text>
      ) : null}
      <Text style={textStyles.muted}>
        Un brief par semaine. Préférences dans Réglages.
      </Text>
    </EmailLayout>
  );
}

OnboardingWelcomeEmail.PreviewProps = {
  name: "Pierre",
  settingsUrl: "http://localhost:3100/dashboard/settings",
};
