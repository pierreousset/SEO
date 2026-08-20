"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const redirectTo = params.get("redirect") || "/dashboard";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const res = await authClient.signIn.emailOtp({ email, otp: code });
      if (res.error) throw new Error(res.error.message);
      router.push(redirectTo);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid code.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (res.error) throw new Error(res.error.message);
      toast.success("New code sent.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Couldn't resend.";
      toast.error(message);
    }
  }

  return (
    <div className="w-full max-w-[400px] sheet p-8">
      <div className="mb-8">
        <BrandMark href="/" />
      </div>

      {/* Heading */}
      <h1 className="text-lg font-semibold text-ink-black mb-1">
        Enter your code
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Check{" "}
        <span className="text-ink-black font-medium">{email || "your email"}</span>{" "}
        for a 6-digit code.
      </p>

      {/* Form */}
      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <Input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            autoFocus
            autoComplete="one-time-code"
            maxLength={6}
            placeholder=""
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="h-11 rounded-xl text-sm px-4 border border-hairline bg-canvas-white text-center text-lg tracking-[0.28em] tabular-nums text-foreground placeholder:text-ash-gray"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full shadow-button"
        >
          {loading ? "Verifying..." : "Verify & sign in"}
        </Button>
      </form>

      <button
        onClick={handleResend}
        className="mt-6 text-xs text-muted-foreground hover:text-ink-black transition-colors"
      >
        Didn't get it? Resend code
      </button>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 bg-background">
      <Suspense
        fallback={
          <div className="text-sm text-muted-foreground">Loading...</div>
        }
      >
        <VerifyForm />
      </Suspense>

      <p className="mt-6 text-xs text-muted-foreground">
        240 Company
      </p>
    </main>
  );
}
