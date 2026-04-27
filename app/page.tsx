"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export default function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

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
      router.push(`/verify?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't send code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center px-6 md:px-12 lg:px-20 py-16 lg:py-24">
      <div className="max-w-xl">
        <h1 className="font-display text-6xl md:text-7xl lg:text-8xl xl:text-[8.5rem] leading-none">
          SEO, done right.
        </h1>
        <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-md">
          Rank tracking and weekly AI briefs. An indie alternative to Semrush — built for operators.
        </p>
      </div>

      <div className="w-full max-w-md lg:justify-self-end">
        <div className="rounded-2xl bg-secondary p-8 md:p-10">
          <h2 className="font-display text-3xl md:text-4xl leading-none">Sign in</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            We send a 6-digit code to your email. No password.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <Label
                htmlFor="email"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 h-12 rounded-full bg-background px-5"
              />
            </div>
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? "Sending code…" : "Send sign-in code"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
