import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export const emailColors = {
  canvas: "#fffcf7",
  cream: "#f4efe8",
  ink: "#1c1814",
  slate: "#4a433c",
  button: "#1c1814",
  ash: "#6f675f",
  hairline: "#e4d9ce",
  teal: "#0d6b7c",
  pink: "#9c2f5a",
} as const;

const font =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: emailColors.cream,
          margin: 0,
          padding: "40px 16px",
          fontFamily: font,
        }}
      >
        <Container
          style={{
            maxWidth: 520,
            margin: "0 auto",
            backgroundColor: emailColors.canvas,
            borderRadius: 20,
            border: `1px solid ${emailColors.hairline}`,
            overflow: "hidden",
          }}
        >
          <Section style={{ padding: "28px 32px 0" }}>
            <table cellPadding={0} cellSpacing={0} role="presentation">
              <tr>
                <td
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: emailColors.ink,
                    fontFamily: font,
                  }}
                >
                  240
                </td>
                <td
                  style={{
                    paddingLeft: 6,
                    fontSize: 14,
                    fontWeight: 500,
                    color: emailColors.ash,
                    fontFamily: font,
                  }}
                >
                  seo
                </td>
              </tr>
            </table>
          </Section>
          <Section style={{ padding: "24px 32px 32px" }}>{children}</Section>
          <Section
            style={{
              padding: "18px 32px 22px",
              backgroundColor: emailColors.cream,
              borderTop: `1px solid ${emailColors.hairline}`,
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: "18px",
                color: emailColors.ash,
                fontFamily: font,
              }}
            >
              SEO Dashboard · 240 Company
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const textStyles = {
  heading: {
    margin: "0 0 12px",
    fontSize: 22,
    fontWeight: 600,
    lineHeight: "28px",
    color: emailColors.ink,
    fontFamily: font,
  } as const,
  body: {
    margin: "0 0 16px",
    fontSize: 15,
    lineHeight: "24px",
    color: emailColors.slate,
    fontFamily: font,
  } as const,
  muted: {
    margin: "20px 0 0",
    fontSize: 12,
    lineHeight: "18px",
    color: emailColors.ash,
    fontFamily: font,
  } as const,
};

export function emailButton(label: string, href: string) {
  return {
    href,
    style: {
      display: "inline-block",
      backgroundColor: emailColors.button,
      color: emailColors.canvas,
      textDecoration: "none",
      padding: "12px 22px",
      borderRadius: 100,
      fontSize: 14,
      fontWeight: 500,
      fontFamily: font,
    } as const,
    label,
  };
}
