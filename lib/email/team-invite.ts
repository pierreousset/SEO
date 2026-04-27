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
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">
          Invitation au SEO Dashboard
        </h2>
        <p style="color: #666; line-height: 1.6; margin: 0 0 24px;">
          <strong>${who}</strong> vous invite à rejoindre son compte sur SEO Dashboard.
          Vous aurez accès aux mêmes données (sites, keywords, briefs, audits, etc.).
        </p>
        <a href="${link}" style="
          display: inline-block;
          background: #0D9488;
          color: white;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 9999px;
          font-size: 14px;
          font-weight: 500;
        ">
          Accepter l'invitation
        </a>
        <p style="color: #999; font-size: 12px; margin: 24px 0 0;">
          Ce lien expire dans 7 jours. Si vous n'avez pas de compte, vous pourrez en créer un en cliquant.
        </p>
      </div>
    `,
    text: `${who} vous invite sur SEO Dashboard. Acceptez ici : ${link}`,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
