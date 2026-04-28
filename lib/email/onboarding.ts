import { Resend } from "resend";
import { getBaseUrl } from "@/lib/base-url";

const FROM = () => process.env.RESEND_FROM_EMAIL || "noreply@localhost";

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[onboarding-email] RESEND_API_KEY missing — skip send");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

// ---------------------------------------------------------------------------
// Shared dark email wrapper — matches team-invite style
// ---------------------------------------------------------------------------
function wrap(body: string): string {
  return `
    <div style="font-family: 'Geist', system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 0; background: #0A0A0A; color: #FFFFFF;">
      <div style="background: #1A1A1A; border-radius: 16px; padding: 32px; border: 1px solid #2A2A2A;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
          <div style="width: 28px; height: 28px; background: #A855F7; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 14px; font-weight: 700;">S</span>
          </div>
          <span style="font-size: 15px; font-weight: 600;">SEO Dashboard</span>
        </div>
        ${body}
      </div>
    </div>
  `;
}

function ctaButton(label: string, href: string): string {
  return `
    <a href="${href}" style="
      display: inline-block;
      background: #A855F7;
      color: white;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 500;
    ">${label}</a>
  `;
}

function p(text: string): string {
  return `<p style="color: #A1A1AA; line-height: 1.6; margin: 0 0 16px; font-size: 14px;">${text}</p>`;
}

function strong(text: string): string {
  return `<strong style="color: #FFFFFF;">${text}</strong>`;
}

// ---------------------------------------------------------------------------
// Email 1 — Welcome (immediately after first login)
// ---------------------------------------------------------------------------
export async function sendOnboardingEmail1(
  to: string,
  name?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "resend_not_configured" };

  const baseUrl = getBaseUrl();
  const greeting = name ? `Hi ${name}` : "Welcome";

  const html = wrap(`
    <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px; color: #FFFFFF;">
      ${greeting}, welcome to SEO Dashboard!
    </h2>
    ${p("You're all set. Here's how to get started in 3 steps:")}
    <ol style="color: #A1A1AA; line-height: 1.8; margin: 0 0 24px; font-size: 14px; padding-left: 20px;">
      <li>${strong("Connect Google Search Console")} — link your GSC account so we can pull real data.</li>
      <li>${strong("Add your keywords")} — tell us what you're tracking.</li>
      <li>${strong("Run your first fetch")} — we'll grab your positions and start monitoring.</li>
    </ol>
    ${ctaButton("Connect Google Search Console", `${baseUrl}/dashboard/settings`)}
    <p style="color: #71717A; font-size: 11px; margin: 24px 0 0; font-family: 'Geist Mono', monospace;">
      Need help? Just reply to this email.
    </p>
  `);

  const { error } = await resend.emails.send({
    from: FROM(),
    to,
    subject: "Welcome to SEO Dashboard — here's what to do first",
    html,
    text: `${greeting}, welcome to SEO Dashboard!\n\n1. Connect Google Search Console\n2. Add your keywords\n3. Run your first fetch\n\nGet started: ${baseUrl}/dashboard/settings`,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Email 2 — Day 2: Your first analysis (24h after signup, if no fetch yet)
// ---------------------------------------------------------------------------
export async function sendOnboardingEmail2(
  to: string,
  hasGscConnected: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "resend_not_configured" };

  const baseUrl = getBaseUrl();

  const bodyConnected = `
    <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px; color: #FFFFFF;">
      You're connected! Time to fetch.
    </h2>
    ${p("Your Google Search Console is linked — great job. Now run your first SERP fetch to see your keyword positions and start tracking changes.")}
    ${ctaButton("Go to dashboard", `${baseUrl}/dashboard`)}
  `;

  const bodyNotConnected = `
    <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px; color: #FFFFFF;">
      Your SEO data is waiting
    </h2>
    ${p("Connect Google Search Console to unlock your dashboard. It takes 30 seconds and gives you access to real position tracking, click data, and AI-powered briefs.")}
    ${ctaButton("Connect GSC now", `${baseUrl}/dashboard/settings`)}
  `;

  const html = wrap(hasGscConnected ? bodyConnected : bodyNotConnected);
  const textContent = hasGscConnected
    ? `You're connected! Run your first fetch: ${baseUrl}/dashboard`
    : `Connect GSC to unlock your dashboard: ${baseUrl}/dashboard/settings`;

  const { error } = await resend.emails.send({
    from: FROM(),
    to,
    subject: "Your SEO data is waiting",
    html,
    text: textContent,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Email 3 — Day 7: Weekly brief ready
// ---------------------------------------------------------------------------
export async function sendOnboardingEmail3(
  to: string,
  isFreePlan: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "resend_not_configured" };

  const baseUrl = getBaseUrl();

  const upsellBlock = isFreePlan
    ? `
      <div style="margin-top: 24px; padding: 16px; background: #1F1F2E; border-radius: 12px; border: 1px solid #A855F733;">
        ${p(`${strong("Want the full picture?")} Upgrade to Pro for unlimited keyword tracking, daily SERP updates, and complete AI analysis.`)}
        <a href="${baseUrl}/dashboard/settings" style="color: #A855F7; font-size: 13px; text-decoration: underline;">See Pro plans →</a>
      </div>
    `
    : "";

  const html = wrap(`
    <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px; color: #FFFFFF;">
      Your first weekly SEO brief is ready
    </h2>
    ${p("Your AI coach has analyzed your site and prepared personalized recommendations. The brief covers position changes, opportunities, and specific actions to improve your rankings.")}
    ${ctaButton("Read your brief", `${baseUrl}/dashboard/brief`)}
    ${upsellBlock}
    <p style="color: #71717A; font-size: 11px; margin: 24px 0 0; font-family: 'Geist Mono', monospace;">
      You'll receive a new brief every week. Manage preferences in Settings.
    </p>
  `);

  const { error } = await resend.emails.send({
    from: FROM(),
    to,
    subject: "Your first weekly SEO brief is ready",
    html,
    text: `Your AI coach has analyzed your site and has recommendations. Read your brief: ${baseUrl}/dashboard/brief`,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
