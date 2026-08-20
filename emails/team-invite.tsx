import { Heading, Link, Text } from "@react-email/components";
import { EmailLayout, emailButton, textStyles } from "./layout";

export default function TeamInviteEmail({
  who,
  link,
}: {
  who: string;
  link: string;
}) {
  const cta = emailButton("Accepter l'invitation", link);
  return (
    <EmailLayout preview={`${who} vous invite sur SEO Dashboard`}>
      <Heading as="h1" style={textStyles.heading}>
        Invitation
      </Heading>
      <Text style={textStyles.body}>
        <strong>{who}</strong> vous invite à rejoindre son compte. Vous verrez
        les mêmes sites, mots-clés, briefs et audits.
      </Text>
      <Link href={cta.href} style={cta.style}>
        {cta.label}
      </Link>
      <Text style={textStyles.muted}>Ce lien expire dans 7 jours.</Text>
    </EmailLayout>
  );
}

TeamInviteEmail.PreviewProps = {
  who: "marie@studio.fr",
  link: "http://localhost:3100/invite/preview",
};

export function renderTeamInviteText(who: string, link: string): string {
  return [
    `${who} vous invite sur SEO Dashboard.`,
    "",
    `Accepter : ${link}`,
    "",
    "Ce lien expire dans 7 jours.",
    "",
    "SEO Dashboard · 240 Company",
  ].join("\n");
}
