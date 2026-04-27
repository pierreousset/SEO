import { Resend } from "resend";
import { render } from "@react-email/render";
import WeeklyBriefEmail, {
  renderWeeklyBriefText,
  type WeeklyBriefEmailProps,
} from "@/emails/weekly-brief";

export type WeeklyBriefEmailInput = WeeklyBriefEmailProps & { to: string };

const SUBJECTS = {
  fr: (period: string) => `Votre brief SEO hebdo — ${period}`,
  en: (period: string) => `Your weekly SEO brief — ${period}`,
};

export async function sendWeeklyBriefEmail(
  input: WeeklyBriefEmailInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[weekly-brief-email] RESEND_API_KEY missing — skip send");
    return { ok: false, error: "resend_not_configured" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL || "noreply@localhost";
  const subject = SUBJECTS[input.language](
    `${input.periodStart} → ${input.periodEnd}`,
  );

  const { to, ...templateProps } = input;
  const html = await render(WeeklyBriefEmail(templateProps));
  const text = renderWeeklyBriefText(templateProps);

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    return { ok: false, error: String((error as any).message ?? error) };
  }
  return { ok: true };
}
