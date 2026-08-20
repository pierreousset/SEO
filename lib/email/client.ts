import { Resend } from "resend";

export function fromAddress(): string {
  const raw = process.env.RESEND_FROM_EMAIL || "noreply@localhost";
  if (raw.includes("<")) return raw;
  return `SEO Dashboard <${raw}>`;
}

export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}
