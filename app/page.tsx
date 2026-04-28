"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Couldn't send code. Try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#0A0A0A" }}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl p-8"
        style={{ backgroundColor: "#1A1A1A" }}
      >
        {/* Logo + Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-base"
            style={{ backgroundColor: "#A855F7" }}
          >
            S
          </div>
          <span className="text-white font-semibold text-lg">SEO Dashboard</span>
        </div>

        {/* Heading */}
        <h1 className="text-lg font-semibold text-white mb-6">
          Sign in to your dashboard
        </h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl text-sm px-4 border text-white placeholder:text-neutral-500"
              style={{
                backgroundColor: "#0A0A0A",
                borderColor: "#2A2A2A",
              }}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-full text-white font-medium"
            style={{ backgroundColor: "#A855F7" }}
          >
            {loading ? "Sending code..." : "Send sign-in code"}
          </Button>
        </form>
      </div>

      {/* Tagline */}
      <p className="mt-6 text-xs text-muted-foreground">
        Indie alternative to Semrush
      </p>
    </main>
  );
}
