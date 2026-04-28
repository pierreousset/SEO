import { Resend } from "resend";

export type PositionAlertInput = {
  to: string;
  keyword: string;
  oldPosition: number | null;
  newPosition: number | null;
  condition: string;
  dashboardUrl: string;
};

const CONDITION_LABELS: Record<string, string> = {
  exits_top_3: "dropped out of top 3",
  exits_top_10: "dropped out of top 10",
  exits_top_20: "dropped out of top 20",
  drops_by_5: "dropped by 5+ positions",
  drops_by_10: "dropped by 10+ positions",
};

export async function sendPositionAlertEmail(
  input: PositionAlertInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[position-alert] RESEND_API_KEY missing — skip send");
    return { ok: false, error: "resend_not_configured" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL || "noreply@localhost";
  const label = CONDITION_LABELS[input.condition] ?? input.condition;
  const subject = `Alert: "${input.keyword}" ${label}`;

  const oldPos = input.oldPosition != null ? `#${input.oldPosition}` : "not ranked";
  const newPos = input.newPosition != null ? `#${input.newPosition}` : "not ranked";

  const html = `
    <div style="font-family: 'Geist', system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 0; background: #0A0A0A; color: #FFFFFF;">
      <div style="background: #1A1A1A; border-radius: 16px; padding: 32px; border: 1px solid #2A2A2A;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
          <div style="width: 28px; height: 28px; background: #A855F7; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 14px; font-weight: 700;">S</span>
          </div>
          <span style="font-size: 15px; font-weight: 600;">SEO Dashboard</span>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px; color: #FFFFFF;">
          Position Alert
        </h2>
        <p style="color: #A1A1AA; line-height: 1.6; margin: 0 0 8px; font-size: 14px;">
          Your keyword <strong style="color: #FFFFFF;">"${input.keyword}"</strong> has ${label}.
        </p>
        <div style="background: #0A0A0A; border-radius: 12px; padding: 16px; margin: 16px 0; display: flex; gap: 24px;">
          <div>
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #71717A; margin-bottom: 4px;">Previous</div>
            <div style="font-family: 'Geist Mono', monospace; font-size: 20px; font-weight: 600; color: #FFFFFF;">${oldPos}</div>
          </div>
          <div style="color: #71717A; font-size: 20px; align-self: center;">→</div>
          <div>
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #71717A; margin-bottom: 4px;">Current</div>
            <div style="font-family: 'Geist Mono', monospace; font-size: 20px; font-weight: 600; color: #EF4444;">${newPos}</div>
          </div>
        </div>
        <a href="${input.dashboardUrl}" style="
          display: inline-block;
          background: #A855F7;
          color: white;
          text-decoration: none;
          padding: 12px 28px;
          border-radius: 9999px;
          font-size: 14px;
          font-weight: 500;
          margin-top: 8px;
        ">
          View keyword
        </a>
        <p style="color: #71717A; font-size: 11px; margin: 24px 0 0; font-family: 'Geist Mono', monospace;">
          You can manage alerts from the keyword detail page.
        </p>
      </div>
    </div>
  `;

  const text = `Position Alert: "${input.keyword}" ${label}. Was ${oldPos}, now ${newPos}. View: ${input.dashboardUrl}`;

  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject,
    html,
    text,
  });

  if (error) return { ok: false, error: (error as any).message ?? String(error) };
  return { ok: true };
}
