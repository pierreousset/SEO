import { render } from "@react-email/render";
import { getBaseUrl } from "@/lib/base-url";
import { fromAddress, getResend } from "@/lib/email/client";
import {
  OnboardingBriefEmail,
  OnboardingFetchEmail,
  OnboardingWelcomeEmail,
} from "@/emails/onboarding";

export async function sendOnboardingEmail1(
  to: string,
  name?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.warn("[onboarding-email] RESEND_API_KEY missing — skip send");
    return { ok: false, error: "resend_not_configured" };
  }

  const baseUrl = getBaseUrl();
  const settingsUrl = `${baseUrl}/dashboard/settings`;
  const html = await render(OnboardingWelcomeEmail({ name, settingsUrl }));
  const greeting = name ? `Bonjour ${name}` : "Bienvenue";

  const { error } = await resend.emails.send({
    from: fromAddress(),
    to,
    subject: "Bienvenue. Trois étapes pour démarrer.",
    html,
    text: `${greeting}.\n\n1. Connectez Google Search Console\n2. Ajoutez vos mots-clés\n3. Lancez la première récupération\n\n${settingsUrl}`,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function sendOnboardingEmail2(
  to: string,
  hasGscConnected: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "resend_not_configured" };

  const baseUrl = getBaseUrl();
  const dashboardUrl = `${baseUrl}/dashboard`;
  const settingsUrl = `${baseUrl}/dashboard/settings`;
  const html = await render(
    OnboardingFetchEmail({ hasGscConnected, dashboardUrl, settingsUrl }),
  );

  const { error } = await resend.emails.send({
    from: fromAddress(),
    to,
    subject: hasGscConnected
      ? "Search Console est liée. Lancez la récupération."
      : "Connectez Search Console pour débloquer le coach",
    html,
    text: hasGscConnected
      ? `Lancez la première récupération : ${dashboardUrl}`
      : `Connectez Search Console : ${settingsUrl}`,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function sendOnboardingEmail3(
  to: string,
  isFreePlan: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "resend_not_configured" };

  const baseUrl = getBaseUrl();
  const briefUrl = `${baseUrl}/dashboard/brief`;
  const billingUrl = `${baseUrl}/dashboard/billing`;
  const html = await render(
    OnboardingBriefEmail({ isFreePlan, briefUrl, billingUrl }),
  );

  const { error } = await resend.emails.send({
    from: fromAddress(),
    to,
    subject: "Votre premier brief SEO est prêt",
    html,
    text: `Votre premier brief est prêt : ${briefUrl}`,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
