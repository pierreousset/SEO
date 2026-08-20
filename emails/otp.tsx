import { Heading, Text } from "@react-email/components";
import { EmailLayout, emailColors, textStyles } from "./layout";

export type OtpType = "sign-in" | "email-verification" | "forget-password";

const COPY: Record<
  OtpType,
  { preview: (otp: string) => string; title: string; body: string }
> = {
  "sign-in": {
    preview: (otp) => `${otp} — votre code de connexion, expire dans 10 min`,
    title: "Votre code de connexion",
    body: "Entrez ce code pour ouvrir SEO Dashboard. Il expire dans 10 minutes.",
  },
  "email-verification": {
    preview: (otp) => `${otp} — code de vérification, expire dans 10 min`,
    title: "Vérifiez votre e-mail",
    body: "Entrez ce code pour confirmer votre adresse. Il expire dans 10 minutes.",
  },
  "forget-password": {
    preview: (otp) => `${otp} — code de réinitialisation, expire dans 10 min`,
    title: "Réinitialiser l'accès",
    body: "Entrez ce code pour continuer. Il expire dans 10 minutes.",
  },
};

export default function OtpEmail({
  otp,
  type = "sign-in",
}: {
  otp: string;
  type?: OtpType;
}) {
  const copy = COPY[type] ?? COPY["sign-in"];
  const spaced = otp.split("").join("  ");

  return (
    <EmailLayout preview={copy.preview(otp)}>
      <Heading as="h1" style={textStyles.heading}>
        {copy.title}
      </Heading>
      <Text style={textStyles.body}>{copy.body}</Text>
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ margin: "8px 0 8px" }}
      >
        <tr>
          <td
            style={{
              backgroundColor: emailColors.cream,
              border: `1px solid ${emailColors.hairline}`,
              borderRadius: 16,
              padding: "22px 16px",
              textAlign: "center",
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "0.28em",
              color: emailColors.ink,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
            }}
          >
            {spaced}
          </td>
        </tr>
      </table>
      <Text style={textStyles.muted}>
        Si vous n&apos;avez pas demandé ce code, ignorez cet e-mail. Quelqu&apos;un a
        peut-être saisi votre adresse par erreur.
      </Text>
    </EmailLayout>
  );
}

OtpEmail.PreviewProps = {
  otp: "482917",
  type: "sign-in" as OtpType,
};

export function renderOtpText(otp: string, type: OtpType = "sign-in"): string {
  const copy = COPY[type] ?? COPY["sign-in"];
  return [
    copy.title,
    "",
    copy.body,
    "",
    otp,
    "",
    "Si vous n'avez pas demandé ce code, ignorez cet e-mail.",
    "",
    "SEO Dashboard · 240 Company",
  ].join("\n");
}
