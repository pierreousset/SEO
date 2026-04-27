import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

type TopMover = {
  keyword: string;
  delta: number;
  probable_cause: string;
  confidence: number;
};

type Ticket = {
  priority: "high" | "medium" | "low";
  action: string;
  target: string;
  why: string;
  estimated_effort_min: number;
};

export type WeeklyBriefEmailProps = {
  businessName: string | null;
  periodStart: string;
  periodEnd: string;
  summary: string;
  topMovers: TopMover[];
  tickets: Ticket[];
  warnings: string[];
  dashboardUrl: string;
  language: "fr" | "en";
};

const STRINGS = {
  fr: {
    preview: (period: string) => `Brief SEO — ${period}`,
    weekOf: "Semaine du",
    topMovers: "Top movers",
    actions: "Actions prioritaires",
    warnings: "À noter",
    openDashboard: "Voir le brief complet",
    footer: "Brief auto-généré depuis vos données Google Search Console + DataForSEO.",
    preferences: "Modifier vos préférences email",
    priorities: { high: "URGENT", medium: "À faire", low: "Si possible" },
    hypothese: "hypothèse",
  },
  en: {
    preview: (period: string) => `SEO brief — ${period}`,
    weekOf: "Week of",
    topMovers: "Top movers",
    actions: "Priority actions",
    warnings: "Warnings",
    openDashboard: "Open full brief",
    footer: "Auto-generated brief from your Google Search Console + DataForSEO data.",
    preferences: "Update email preferences",
    priorities: { high: "URGENT", medium: "TO DO", low: "IF TIME" },
    hypothese: "hypothesis",
  },
};

export default function WeeklyBriefEmail(props: WeeklyBriefEmailProps) {
  const s = STRINGS[props.language];
  const periodText = `${props.periodStart} → ${props.periodEnd}`;

  return (
    <Html>
      <Head />
      <Preview>{s.preview(periodText)}</Preview>
      <Tailwind>
        <Body className="bg-[#fafafa] font-sans text-[#0a0a0a] m-0 p-0 py-6">
          <Container className="max-w-[640px] w-full mx-auto bg-white rounded-2xl overflow-hidden">
            {/* Header */}
            <Section className="px-8 pt-8 pb-6">
              <Text className="text-[11px] font-semibold text-[#737373] uppercase tracking-[0.06em] m-0">
                {s.weekOf} {periodText}
              </Text>
              <Heading
                as="h1"
                className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.15] text-[#0a0a0a] mt-2 mb-0"
              >
                {props.businessName ?? "SEO brief"}
              </Heading>
              <Text className="mt-4 mb-0 text-[15px] leading-[1.6] text-[#525252]">
                {props.summary}
              </Text>
            </Section>

            {/* Top movers */}
            {props.topMovers.length > 0 && (
              <Section className="px-8 pt-2">
                <Text className="text-[11px] font-semibold text-[#737373] uppercase tracking-[0.06em] mb-2 mt-0">
                  {s.topMovers}
                </Text>
                {props.topMovers.map((m, i) => {
                  const color =
                    m.delta > 0 ? "#16a34a" : m.delta < 0 ? "#dc2626" : "#737373";
                  const sign = m.delta > 0 ? "+" : "";
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "10px 0",
                        borderBottom: "1px solid #e5e5e5",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontFamily: "ui-monospace,Menlo,Monaco,monospace",
                            color,
                            fontWeight: 600,
                            fontSize: 14,
                            display: "inline-block",
                            width: 50,
                          }}
                        >
                          {sign}
                          {m.delta}
                        </span>
                        <span style={{ fontWeight: 500, fontSize: 14, color: "#0a0a0a" }}>
                          {m.keyword}
                        </span>
                        {m.confidence < 0.5 && (
                          <span
                            style={{
                              background: "#f4f4f5",
                              color: "#737373",
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 9999,
                              marginLeft: 6,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {s.hypothese}
                          </span>
                        )}
                      </div>
                      <Text
                        style={{
                          marginTop: 4,
                          marginLeft: 50,
                          marginBottom: 0,
                          color: "#525252",
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        {m.probable_cause}
                      </Text>
                    </div>
                  );
                })}
              </Section>
            )}

            {/* Tickets */}
            {props.tickets.length > 0 && (
              <Section className="px-8 pt-6">
                <Text className="text-[11px] font-semibold text-[#737373] uppercase tracking-[0.06em] mb-2 mt-0">
                  {s.actions}
                </Text>
                {props.tickets.map((t, i) => {
                  const color =
                    t.priority === "high"
                      ? "#dc2626"
                      : t.priority === "medium"
                        ? "#ca8a04"
                        : "#737373";
                  const label =
                    s.priorities[t.priority as keyof typeof s.priorities] ?? t.priority;
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "14px 0",
                        borderBottom: "1px solid #e5e5e5",
                      }}
                    >
                      <div style={{ marginBottom: 6 }}>
                        <span
                          style={{
                            display: "inline-block",
                            background: color,
                            color: "#ffffff",
                            fontSize: 10,
                            padding: "2px 8px",
                            borderRadius: 9999,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            fontWeight: 600,
                          }}
                        >
                          {label}
                        </span>
                        <span
                          style={{
                            marginLeft: 8,
                            fontWeight: 600,
                            fontSize: 14,
                            color: "#0a0a0a",
                          }}
                        >
                          {t.action}
                        </span>
                      </div>
                      <Text
                        style={{
                          fontFamily: "ui-monospace,Menlo,Monaco,monospace",
                          color: "#737373",
                          fontSize: 12,
                          margin: 0,
                        }}
                      >
                        {t.target} · ~{t.estimated_effort_min}min
                      </Text>
                      <Text
                        style={{
                          marginTop: 6,
                          marginBottom: 0,
                          color: "#525252",
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        {t.why}
                      </Text>
                    </div>
                  );
                })}
              </Section>
            )}

            {/* Warnings */}
            {props.warnings.length > 0 && (
              <Section className="px-8 pt-6">
                <div
                  style={{
                    padding: 16,
                    background: "#fef3c7",
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#854d0e",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginTop: 0,
                      marginBottom: 8,
                    }}
                  >
                    {s.warnings}
                  </Text>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      color: "#713f12",
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    {props.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </Section>
            )}

            {/* CTA */}
            <Section className="px-8 py-8">
              <Link
                href={props.dashboardUrl}
                className="bg-[#0a0a0a] text-white no-underline rounded-full px-6 py-3 inline-block text-sm font-medium"
              >
                {s.openDashboard} →
              </Link>
            </Section>

            <Hr className="border-[#e5e5e5] m-0" />

            {/* Footer */}
            <Section className="px-8 py-6 bg-[#fafafa]">
              <Text className="text-[11px] text-[#a3a3a3] leading-[1.6] m-0">
                {s.footer}
                <br />
                <Link
                  href={`${props.dashboardUrl}/business`}
                  className="text-[#737373] underline"
                >
                  {s.preferences}
                </Link>
                .
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

// Plain text fallback for non-HTML mail clients
export function renderWeeklyBriefText(props: WeeklyBriefEmailProps): string {
  const s = STRINGS[props.language];
  const lines: string[] = [];
  lines.push(`${s.weekOf} ${props.periodStart} → ${props.periodEnd}`);
  lines.push(props.businessName ?? "SEO brief");
  lines.push("");
  lines.push(props.summary);
  lines.push("");
  if (props.topMovers.length) {
    lines.push(`— ${s.topMovers} —`);
    for (const m of props.topMovers) {
      const sign = m.delta > 0 ? "+" : "";
      lines.push(`${sign}${m.delta}  ${m.keyword}`);
      lines.push(`   ${m.probable_cause}`);
    }
    lines.push("");
  }
  if (props.tickets.length) {
    lines.push(`— ${s.actions} —`);
    for (const t of props.tickets) {
      const label = s.priorities[t.priority as keyof typeof s.priorities] ?? t.priority;
      lines.push(`[${label}] ${t.action}`);
      lines.push(`   ${t.target} · ~${t.estimated_effort_min}min`);
      lines.push(`   ${t.why}`);
    }
    lines.push("");
  }
  if (props.warnings.length) {
    lines.push(`— ${s.warnings} —`);
    for (const w of props.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  lines.push(`${s.openDashboard}: ${props.dashboardUrl}`);
  return lines.join("\n");
}
