import { render } from "@react-email/render";
import { fromAddress, getResend } from "@/lib/email/client";
import PositionAlertEmail, {
  conditionLabel,
  renderPositionAlertText,
} from "@/emails/position-alert";

export type PositionAlertInput = {
  to: string;
  keyword: string;
  oldPosition: number | null;
  newPosition: number | null;
  condition: string;
  dashboardUrl: string;
};

export async function sendPositionAlertEmail(
  input: PositionAlertInput,
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.warn("[position-alert] RESEND_API_KEY missing — skip send");
    return { ok: false, error: "resend_not_configured" };
  }

  const html = await render(
    PositionAlertEmail({
      keyword: input.keyword,
      oldPosition: input.oldPosition,
      newPosition: input.newPosition,
      condition: input.condition,
      dashboardUrl: input.dashboardUrl,
    }),
  );

  const { error } = await resend.emails.send({
    from: fromAddress(),
    to: input.to,
    subject: `Alerte : « ${input.keyword} » ${conditionLabel(input.condition)}`,
    html,
    text: renderPositionAlertText(input),
  });

  if (error) return { ok: false, error: (error as { message?: string }).message ?? String(error) };
  return { ok: true };
}
