import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { render } from "@react-email/render";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { fromAddress, getResend } from "@/lib/email/client";
import OtpEmail, { renderOtpText, type OtpType } from "@/emails/otp";

const resend = getResend();
const FROM = fromAddress();

function asOtpType(type: string): OtpType {
  if (type === "email-verification" || type === "forget-password") return type;
  return "sign-in";
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      verification: schema.verifications,
    },
  }),
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "dev-only-placeholder-secret-not-for-production-use-change-me"),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3100",
  emailAndPassword: { enabled: false },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (!resend) {
          console.warn("[auth] RESEND_API_KEY missing — OTP for", email, "is:", otp);
          return;
        }
        const kind = asOtpType(type);
        const html = await render(OtpEmail({ otp, type: kind }));
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: "Votre code de connexion",
          html,
          text: renderOtpText(otp, kind),
        });
      },
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 5,
    }),
  ],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },
});

export type Session = typeof auth.$Infer.Session;
