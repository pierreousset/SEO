import { ImageResponse } from "next/og";

export const alt = "SEO Dashboard — Quoi corriger. Dans quel ordre. Pourquoi.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#f4efe8",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 28, color: "#1c1814", fontWeight: 600 }}>240</span>
          <span style={{ fontSize: 20, color: "#6f675f", fontWeight: 500 }}>seo</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              color: "#1c1814",
              lineHeight: 1.1,
              letterSpacing: "-2px",
              maxWidth: 960,
            }}
          >
            Quoi corriger. Dans quel ordre. Pourquoi.
          </div>
          <div style={{ fontSize: 28, color: "#0d6b7c", maxWidth: 720 }}>
            Coach SEO branché sur Search Console. 99€/mois.
          </div>
        </div>
        <div style={{ fontSize: 22, color: "#6f675f" }}>240 Company</div>
      </div>
    ),
    { ...size },
  );
}
