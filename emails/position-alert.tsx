import { Heading, Link, Text } from "@react-email/components";
import { EmailLayout, emailButton, emailColors, textStyles } from "./layout";

const CONDITION_LABELS: Record<string, string> = {
  exits_top_3: "est sorti du top 3",
  exits_top_10: "est sorti du top 10",
  exits_top_20: "est sorti du top 20",
  drops_by_5: "a perdu 5 positions ou plus",
  drops_by_10: "a perdu 10 positions ou plus",
};

export function conditionLabel(condition: string): string {
  return CONDITION_LABELS[condition] ?? condition;
}

export default function PositionAlertEmail({
  keyword,
  oldPosition,
  newPosition,
  condition,
  dashboardUrl,
}: {
  keyword: string;
  oldPosition: number | null;
  newPosition: number | null;
  condition: string;
  dashboardUrl: string;
}) {
  const label = conditionLabel(condition);
  const oldPos = oldPosition != null ? `#${oldPosition}` : "hors classement";
  const newPos = newPosition != null ? `#${newPosition}` : "hors classement";
  const cta = emailButton("Voir le mot-clé", dashboardUrl);

  return (
    <EmailLayout preview={`« ${keyword} » ${label}`}>
      <Heading as="h1" style={textStyles.heading}>
        Alerte position
      </Heading>
      <Text style={textStyles.body}>
        Le mot-clé <strong>« {keyword} »</strong> {label}.
      </Text>
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{
          margin: "8px 0 20px",
          backgroundColor: emailColors.cream,
          border: `1px solid ${emailColors.hairline}`,
          borderRadius: 16,
        }}
      >
        <tr>
          <td style={{ padding: 20 }}>
            <Text
              style={{
                margin: "0 0 4px",
                fontSize: 12,
                color: emailColors.ash,
              }}
            >
              Avant
            </Text>
            <Text
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                color: emailColors.ink,
              }}
            >
              {oldPos}
            </Text>
          </td>
          <td style={{ padding: 20, color: emailColors.ash, fontSize: 18 }}>
            →
          </td>
          <td style={{ padding: 20 }}>
            <Text
              style={{
                margin: "0 0 4px",
                fontSize: 12,
                color: emailColors.ash,
              }}
            >
              Maintenant
            </Text>
            <Text
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                color: emailColors.pink,
              }}
            >
              {newPos}
            </Text>
          </td>
        </tr>
      </table>
      <Link href={cta.href} style={cta.style}>
        {cta.label}
      </Link>
      <Text style={textStyles.muted}>
        Gérez les alertes depuis la fiche du mot-clé.
      </Text>
    </EmailLayout>
  );
}

PositionAlertEmail.PreviewProps = {
  keyword: "audit seo agence",
  oldPosition: 8,
  newPosition: 14,
  condition: "drops_by_5",
  dashboardUrl: "http://localhost:3100/dashboard/keywords",
};

export function renderPositionAlertText(input: {
  keyword: string;
  oldPosition: number | null;
  newPosition: number | null;
  condition: string;
  dashboardUrl: string;
}): string {
  const label = conditionLabel(input.condition);
  const oldPos =
    input.oldPosition != null ? `#${input.oldPosition}` : "hors classement";
  const newPos =
    input.newPosition != null ? `#${input.newPosition}` : "hors classement";
  return [
    `Alerte : « ${input.keyword} » ${label}.`,
    `Avant ${oldPos}, maintenant ${newPos}.`,
    "",
    `Voir : ${input.dashboardUrl}`,
    "",
    "SEO Dashboard · 240 Company",
  ].join("\n");
}
