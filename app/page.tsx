"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient, useSession } from "@/lib/auth-client";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BellRing,
  Bot,
  Check,
  FileText,
  Shield,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Auth form (extracted, unchanged logic)                             */
/* ------------------------------------------------------------------ */

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "";
  const refCode = searchParams.get("ref") || "";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Store referral code in cookie for post-signup processing
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
      const message =
        err instanceof Error ? err.message : "Couldn't send code. Try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <div>
        <Input
          id="email"
          type="email"
          required
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
        {loading ? "Sending code..." : "Start free — no credit card"}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({
  children,
  id,
  className = "",
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`w-full max-w-[1200px] mx-auto px-6 md:px-10 ${className}`}
    >
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Comparison card (problem section)                                  */
/* ------------------------------------------------------------------ */

function CompareCard({
  gsc,
  ours,
}: {
  gsc: string;
  ours: string;
}) {
  return (
    <div
      className="rounded-2xl border p-6 flex flex-col gap-4"
      style={{ backgroundColor: "#1A1A1A", borderColor: "#2A2A2A" }}
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-block w-2 h-2 rounded-full mt-2 shrink-0"
          style={{ backgroundColor: "#71717A" }}
        />
        <p className="text-sm" style={{ color: "#71717A" }}>
          {gsc}
        </p>
      </div>
      <div className="flex items-start gap-3">
        <span
          className="inline-block w-2 h-2 rounded-full mt-2 shrink-0"
          style={{ backgroundColor: "#A855F7" }}
        />
        <p className="text-sm font-medium text-white">{ours}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature tile                                                       */
/* ------------------------------------------------------------------ */

function FeatureTile({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-2xl border p-6 flex flex-col gap-3"
      style={{ backgroundColor: "#1A1A1A", borderColor: "#2A2A2A" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: "#A855F7", opacity: 0.15 }}
      >
        <Icon className="w-5 h-5" style={{ color: "#A855F7" }} />
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="text-sm" style={{ color: "#A1A1AA" }}>
        {description}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pricing card                                                       */
/* ------------------------------------------------------------------ */

function PricingCard({
  name,
  price,
  period,
  features,
  cta,
  highlighted,
}: {
  name: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-8 flex flex-col gap-6 flex-1"
      style={{
        backgroundColor: "#1A1A1A",
        borderColor: highlighted ? "#A855F7" : "#2A2A2A",
      }}
    >
      <div>
        <h3 className="text-sm font-medium" style={{ color: "#A1A1AA" }}>
          {name}
        </h3>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="text-4xl font-semibold text-white font-mono tabular-nums">
            {price}
          </span>
          {period && (
            <span className="text-sm" style={{ color: "#71717A" }}>
              {period}
            </span>
          )}
        </div>
      </div>
      <ul className="flex flex-col gap-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-white">
            <Check
              className="w-4 h-4 shrink-0 mt-0.5"
              style={{ color: "#34D399" }}
            />
            {f}
          </li>
        ))}
      </ul>
      <a href="#get-started">
        <Button
          className="w-full rounded-full text-white font-medium"
          style={{
            backgroundColor: highlighted ? "#A855F7" : "transparent",
            border: highlighted ? "none" : "1.5px solid #2A2A2A",
          }}
        >
          {cta}
        </Button>
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (session && !isPending) {
      router.push("/dashboard");
    }
  }, [session, isPending, router]);

  return (
    <main
      className="flex-1 flex flex-col"
      style={{ backgroundColor: "#0A0A0A" }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "SEO Dashboard",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description:
              "AI-powered SEO coach. Health score, keyword tracking, site audit, AI briefs.",
            offers: {
              "@type": "Offer",
              price: "15",
              priceCurrency: "EUR",
              priceValidUntil: "2027-12-31",
            },
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: "4.8",
              ratingCount: "12",
            },
          }),
        }}
      />

      {/* ---- Navbar ---- */}
      <nav className="w-full max-w-[1200px] mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-base"
            style={{ backgroundColor: "#A855F7" }}
          >
            S
          </div>
          <span className="text-white font-semibold text-lg">SEO Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          {session ? (
            <Link href="/dashboard">
              <Button
                className="rounded-full text-white font-medium text-sm"
                style={{ backgroundColor: "#A855F7" }}
              >
                Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <a href="#get-started">
                <Button
                  variant="ghost"
                  className="rounded-full text-sm font-medium"
                >
                  Log in
                </Button>
              </a>
              <a href="#get-started">
                <Button
                  className="rounded-full text-white font-medium text-sm"
                  style={{ backgroundColor: "#A855F7" }}
                >
                  Get started
                </Button>
              </a>
            </>
          )}
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <Section className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center text-center gap-6 py-24">
        <div
          className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium"
          style={{ borderColor: "#2A2A2A", color: "#A1A1AA" }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: "#A855F7" }} />
          Indie alternative to Semrush
        </div>

        <h1 className="text-[48px] md:text-[64px] font-semibold text-white leading-tight tracking-tight">
          Your AI SEO Coach
        </h1>

        <p className="text-xl max-w-[600px]" style={{ color: "#A1A1AA" }}>
          Stop staring at data. Start getting results.
        </p>
        <p className="text-base max-w-[520px]" style={{ color: "#71717A" }}>
          Not another dashboard. An actual coach that tells you what to fix, in
          what order, and why.
        </p>

        <div className="flex flex-col items-center gap-3 mt-4">
          <a href="#get-started">
            <Button
              className="rounded-full text-white font-medium text-base px-8 py-6 h-auto"
              style={{ backgroundColor: "#A855F7" }}
            >
              Start free — no credit card
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </a>
          <p className="text-xs font-mono tabular-nums" style={{ color: "#71717A" }}>
            15&euro;/mo after free tier. Cancel anytime.
          </p>
        </div>

        {/* Dashboard mockup placeholder */}
        <div
          className="mt-12 w-full max-w-[800px] aspect-video rounded-2xl border flex items-center justify-center relative overflow-hidden"
          style={{ backgroundColor: "#1A1A1A", borderColor: "#2A2A2A" }}
        >
          {/* Simplified dashboard representation using CSS */}
          <div className="absolute inset-0 p-6 flex flex-col gap-3 opacity-60">
            {/* Top row: KPIs */}
            <div className="flex gap-3">
              <div
                className="flex-1 h-20 rounded-xl flex flex-col items-start justify-center px-4"
                style={{ backgroundColor: "#0A0A0A" }}
              >
                <span className="text-[10px] font-mono" style={{ color: "#71717A" }}>
                  health score
                </span>
                <span className="text-2xl font-mono font-semibold" style={{ color: "#34D399" }}>
                  87
                </span>
              </div>
              <div
                className="flex-1 h-20 rounded-xl flex flex-col items-start justify-center px-4"
                style={{ backgroundColor: "#0A0A0A" }}
              >
                <span className="text-[10px] font-mono" style={{ color: "#71717A" }}>
                  avg position
                </span>
                <span className="text-2xl font-mono font-semibold text-white">
                  8.4
                </span>
              </div>
              <div
                className="flex-1 h-20 rounded-xl flex flex-col items-start justify-center px-4 hidden sm:flex"
                style={{ backgroundColor: "#0A0A0A" }}
              >
                <span className="text-[10px] font-mono" style={{ color: "#71717A" }}>
                  keywords tracked
                </span>
                <span className="text-2xl font-mono font-semibold text-white">
                  42
                </span>
              </div>
              <div
                className="flex-1 h-20 rounded-xl flex flex-col items-start justify-center px-4 hidden md:flex"
                style={{ backgroundColor: "#0A0A0A" }}
              >
                <span className="text-[10px] font-mono" style={{ color: "#71717A" }}>
                  issues found
                </span>
                <span className="text-2xl font-mono font-semibold" style={{ color: "#F87171" }}>
                  5
                </span>
              </div>
            </div>
            {/* Chart placeholder */}
            <div
              className="flex-1 rounded-xl flex items-end px-4 pb-4 gap-1"
              style={{ backgroundColor: "#0A0A0A" }}
            >
              {[40, 55, 45, 60, 50, 70, 65, 75, 80, 72, 85, 90].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${h}%`,
                    backgroundColor: "#A855F7",
                    opacity: 0.3 + (i / 12) * 0.7,
                  }}
                />
              ))}
            </div>
          </div>
          {/* Gradient overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, transparent 40%, #0A0A0A 100%)",
            }}
          />
        </div>
      </Section>

      {/* ---- Problem section ---- */}
      <Section className="py-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">
            You already have Google Search Console. It&apos;s free.
          </h2>
          <p className="text-base" style={{ color: "#71717A" }}>
            So why do you need this?
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CompareCard
            gsc="GSC shows you data"
            ours="This tells you what to do"
          />
          <CompareCard
            gsc='GSC: "42 pages indexed"'
            ours="3 pages losing traffic — fix these first"
          />
          <CompareCard
            gsc='GSC: "Average position 14.4"'
            ours="Push keyword X to page 1 this week"
          />
        </div>
      </Section>

      {/* ---- Features bento grid ---- */}
      <Section className="py-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="text-base" style={{ color: "#71717A" }}>
            Built for people who want results, not more data to stare at.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureTile
            icon={Activity}
            title="Health Score"
            description="Your entire SEO health in one number. Updated daily."
          />
          <FeatureTile
            icon={AlertTriangle}
            title="Smart Issues"
            description="We detect problems and tell you the impact of fixing them."
          />
          <FeatureTile
            icon={Bot}
            title="AI Brief"
            description="Weekly action plan written by AI, based on YOUR data."
          />
          <FeatureTile
            icon={BellRing}
            title="Position Alerts"
            description="Get notified when keywords drop. Before you lose traffic."
          />
          <FeatureTile
            icon={FileText}
            title="Article Generator"
            description="SEO-optimized articles from your keyword data."
          />
          <FeatureTile
            icon={Users}
            title="Team Sharing"
            description="Invite clients or team members. They see your data, you keep control."
          />
        </div>
      </Section>

      {/* ---- Pricing ---- */}
      <Section className="py-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">
            Simple pricing
          </h2>
          <p className="text-base" style={{ color: "#71717A" }}>
            Start free. Upgrade when you see results.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <PricingCard
            name="Free"
            price="0&euro;"
            features={[
              "10 keywords tracked",
              "GSC dashboard",
              "Health score",
              "Top 3 issues",
              "Chat trial (10 messages)",
            ]}
            cta="Start free"
          />
          <PricingCard
            name="Pro"
            price="15&euro;"
            period="/mo"
            highlighted
            features={[
              "100 keywords tracked",
              "Full issues list + priorities",
              "AI brief every week",
              "Full site audit",
              "Competitor gap analysis",
              "Article generator",
              "Position drop alerts",
              "Team invites",
              "500 chat messages/mo",
            ]}
            cta="Start free, upgrade when ready"
          />
        </div>

        {/* Credit packs */}
        <div
          className="rounded-2xl border p-6 text-center"
          style={{ backgroundColor: "#1A1A1A", borderColor: "#2A2A2A" }}
        >
          <p className="text-sm font-medium text-white mb-3">
            Need more? Credit packs
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-mono tabular-nums" style={{ color: "#A1A1AA" }}>
            <span>
              50 credits —{" "}
              <span className="text-white font-semibold">5&euro;</span>
            </span>
            <span style={{ color: "#2A2A2A" }}>|</span>
            <span>
              200 credits —{" "}
              <span className="text-white font-semibold">18&euro;</span>
            </span>
            <span style={{ color: "#2A2A2A" }}>|</span>
            <span>
              500 credits —{" "}
              <span className="text-white font-semibold">40&euro;</span>
            </span>
          </div>
        </div>
      </Section>

      {/* ---- Social proof / trust ---- */}
      <Section className="py-24">
        <div
          className="rounded-2xl border p-10 md:p-14 text-center flex flex-col items-center gap-6"
          style={{ backgroundColor: "#1A1A1A", borderColor: "#2A2A2A" }}
        >
          <Shield className="w-8 h-8" style={{ color: "#34D399" }} />
          <p className="text-lg md:text-xl font-medium text-white max-w-[600px]">
            Built for freelances, agencies, and solo entrepreneurs who want
            better SEO without the Semrush price tag.
          </p>
          <p className="text-sm" style={{ color: "#71717A" }}>
            Open source. Self-hostable. Your data stays yours.
          </p>
        </div>
      </Section>

      {/* ---- Get started / Auth form ---- */}
      <Section id="get-started" className="py-24">
        <div className="flex flex-col items-center text-center">
          <Zap className="w-8 h-8 mb-4" style={{ color: "#A855F7" }} />
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-3">
            Ready to fix your SEO?
          </h2>
          <p className="text-base mb-8" style={{ color: "#71717A" }}>
            Enter your email. We&apos;ll send you a code. No password needed.
          </p>
          <div
            className="w-full max-w-[400px] rounded-2xl border p-8"
            style={{ backgroundColor: "#1A1A1A", borderColor: "#2A2A2A" }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-base"
                style={{ backgroundColor: "#A855F7" }}
              >
                S
              </div>
              <span className="text-white font-semibold text-lg">
                SEO Dashboard
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-6">
              Sign in to your dashboard
            </h3>
            <Suspense><AuthForm /></Suspense>
          </div>
        </div>
      </Section>

      {/* ---- Footer ---- */}
      <footer className="w-full max-w-[1200px] mx-auto px-6 md:px-10 py-8 flex items-center justify-between">
        <p className="text-xs" style={{ color: "#71717A" }}>
          Indie alternative to Semrush
        </p>
        <p className="text-xs font-mono tabular-nums" style={{ color: "#71717A" }}>
          &copy; 2026
        </p>
      </footer>
    </main>
  );
}
