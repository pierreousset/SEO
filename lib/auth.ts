import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL || "noreply@localhost";

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
      ? undefined // let Better Auth throw loudly at runtime if not set in prod
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
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: `Your sign-in code: ${otp}`,
          text: `Your sign-in code is ${otp}. It expires in 10 minutes. If you didn't request this, ignore this email.`,
        });
      },
      otpLength: 6,
      expiresIn: 600, // 10 min
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
