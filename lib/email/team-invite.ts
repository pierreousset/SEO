import { Resend } from "resend";

export async function sendTeamInviteEmail(opts: {
  to: string;
  inviterEmail: string;
  inviterName?: string | null;
  token: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[team-invite] RESEND_API_KEY missing — skip send");
    return { ok: false, error: "resend_not_configured" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL || "noreply@localhost";
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";
  const link = `${baseUrl}/invite/${opts.token}`;
  const who = opts.inviterName || opts.inviterEmail;

  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: `${who} vous invite sur SEO Dashboard`,
    html: `
      <div style="font-family: 'Geist', system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 0; background: #0A0A0A; color: #FFFFFF;">
        <div style="background: #1A1A1A; border-radius: 16px; padding: 32px; border: 1px solid #2A2A2A;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
            <div style="width: 28px; height: 28px; background: #A855F7; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 14px; font-weight: 700;">S</span>
            </div>
            <span style="font-size: 15px; font-weight: 600;">SEO Dashboard</span>
          </div>
          <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px; color: #FFFFFF;">
            Invitation
          </h2>
          <p style="color: #A1A1AA; line-height: 1.6; margin: 0 0 24px; font-size: 14px;">
            <strong style="color: #FFFFFF;">${who}</strong> vous invite à rejoindre son compte.
            Vous aurez accès aux mêmes données (sites, keywords, briefs, audits).
          </p>
          <a href="${link}" style="
            display: inline-block;
            background: #A855F7;
            color: white;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 500;
          ">
            Accepter l'invitation
          </a>
          <p style="color: #71717A; font-size: 11px; margin: 24px 0 0; font-family: 'Geist Mono', monospace;">
            Ce lien expire dans 7 jours.
          </p>
        </div>
      </div>
    `,
    text: `${who} vous invite sur SEO Dashboard. Acceptez ici : ${link}`,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
