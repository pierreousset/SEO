"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const res = await authClient.signIn.emailOtp({ email, otp: code });
      if (res.error) throw new Error(res.error.message);
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err?.message ?? "Invalid code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
      if (res.error) throw new Error(res.error.message);
      toast.success("New code sent.");
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't resend.");
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Enter your code</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Check <span className="text-foreground font-medium">{email || "your email"}</span> for a
          6-digit code.
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <Label
            htmlFor="code"
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Code
          </Label>
          <Input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            autoFocus
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="mt-2 font-mono text-center text-lg tracking-widest"
          />
        </div>
        <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
          {loading ? "Verifying…" : "Verify & sign in"}
        </Button>
      </form>

      <button
        onClick={handleResend}
        className="mt-6 text-xs text-muted-foreground hover:text-foreground"
      >
        Didn't get it? Resend code
      </button>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <VerifyForm />
      </Suspense>
    </main>
  );
}
