import { render } from "@react-email/render";
import { fromAddress, getResend } from "@/lib/email/client";
import TeamInviteEmail, { renderTeamInviteText } from "@/emails/team-invite";

export async function sendTeamInviteEmail(opts: {
  to: string;
  inviterEmail: string;
  inviterName?: string | null;
  token: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.warn("[team-invite] RESEND_API_KEY missing — skip send");
    return { ok: false, error: "resend_not_configured" };
  }

  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";
  const link = `${baseUrl}/invite/${opts.token}`;
  const who = opts.inviterName || opts.inviterEmail;
  const html = await render(TeamInviteEmail({ who, link }));

  const { error } = await resend.emails.send({
    from: fromAddress(),
    to: opts.to,
    subject: `${who} vous invite sur SEO Dashboard`,
    html,
    text: renderTeamInviteText(who, link),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
