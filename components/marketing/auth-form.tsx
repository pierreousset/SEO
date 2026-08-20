"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

type Copy = {
  placeholder: string;
  submit: string;
  sending: string;
  error: string;
};

function AuthFormInner({ copy }: { copy: Copy }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "";
  const refCode = searchParams.get("ref") || "";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (refCode) {
      document.cookie = `ref_code=${encodeURIComponent(refCode)};path=/;max-age=${60 * 60 * 24 * 30}`;
    }
  }, [refCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (res.error) throw new Error(res.error.message);
      const verifyUrl = `/verify?email=${encodeURIComponent(email)}${redirectTo ? `&redirect=${encodeURIComponent(redirectTo)}` : ""}`;
      router.push(verifyUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : copy.error;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 w-full">
      <Input
        id="email"
        type="email"
        required
        autoComplete="email"
        placeholder={copy.placeholder}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 rounded-xl text-sm px-4 bg-canvas-white border-hairline"
      />
      <Button type="submit" disabled={loading} className="w-full shadow-button">
        {loading ? copy.sending : copy.submit}
      </Button>
    </form>
  );
}

export function AuthForm({ copy }: { copy: Copy }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3 w-full">
          <div className="h-11 rounded-xl border border-hairline bg-canvas-white" />
          <div className="h-12 rounded-full bg-button-black/80" />
        </div>
      }
    >
      <AuthFormInner copy={copy} />
    </Suspense>
  );
}
