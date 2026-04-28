import Link from "next/link";
import { ArrowLeft, Download, Upload, ToggleRight, Settings, KeyRound, Globe } from "lucide-react";

export const dynamic = "force-dynamic";

const steps = [
  {
    number: "1",
    icon: Download,
    title: "Download the plugin",
    description: "Click the button below to download the SEO Dashboard WordPress plugin.",
  },
  {
    number: "2",
    icon: Upload,
    title: "Upload to WordPress",
    description:
      "In your WordPress admin, go to Plugins \u2192 Add New \u2192 Upload Plugin. Select the downloaded seo-dashboard.php file and click Install Now.",
  },
  {
    number: "3",
    icon: ToggleRight,
    title: "Activate the plugin",
    description: "After installation, click Activate to enable the plugin.",
  },
  {
    number: "4",
    icon: Settings,
    title: "Open plugin settings",
    description:
      "Go to Settings \u2192 SEO Dashboard in your WordPress admin sidebar.",
  },
  {
    number: "5",
    icon: KeyRound,
    title: "Enter your API key",
    description:
      "Generate an API key in Settings \u2192 Webhooks & API, then paste it into the plugin settings.",
  },
  {
    number: "6",
    icon: Globe,
    title: "Enter your dashboard URL",
    description:
      "Paste your SEO Dashboard URL (e.g. https://app.yourdomain.com) so the plugin knows where to send requests.",
  },
] as const;

export default function WordPressPluginPage() {
  return (
    <div className="px-4 md:px-9 py-7 max-w-[900px] mx-auto space-y-8">
      <header>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
          Settings
        </Link>
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          integrations
        </p>
        <h1 className="font-display text-[40px] mt-2">WordPress Plugin</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-[600px]">
          Connect your WordPress site to get AI-powered meta tag suggestions directly in the post
          editor, plus a health score widget on your WordPress dashboard.
        </p>
      </header>

      {/* Download card */}
      <section className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Download className="h-6 w-6 text-primary" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold">Download Plugin</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Single-file PHP plugin. No dependencies, works with any WordPress 5.0+ installation.
            </p>
            <a
              href="/wordpress-plugin/seo-dashboard.php"
              download="seo-dashboard.php"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4.5 py-2.5 rounded-full text-xs font-medium hover:opacity-85 transition mt-4"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              seo-dashboard.php
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-card rounded-2xl border border-border p-6">
        <h2 className="text-sm font-semibold mb-4">What the plugin does</h2>
        <ul className="space-y-3 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="font-mono text-primary mt-px">01</span>
            <span>
              Adds a <strong className="text-foreground">meta box</strong> on post/page edit
              screens with an &ldquo;Suggest with AI&rdquo; button that calls your dashboard API.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-primary mt-px">02</span>
            <span>
              Shows suggested title and description with{" "}
              <strong className="text-foreground">Apply</strong> buttons that fill Yoast SEO or
              RankMath fields automatically.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-primary mt-px">03</span>
            <span>
              Adds a <strong className="text-foreground">dashboard widget</strong> showing your
              current SEO health score at a glance.
            </span>
          </li>
        </ul>
      </section>

      {/* Setup steps */}
      <section>
        <h2 className="text-sm font-semibold mb-4">Setup instructions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-card rounded-2xl border border-border p-5 flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <step.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{step.number}.</span>
                  {step.title}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* API endpoints reference */}
      <section className="bg-card rounded-2xl border border-border p-6">
        <h2 className="text-sm font-semibold mb-4">API endpoints used</h2>
        <div className="space-y-3 font-mono text-xs">
          <div className="flex items-start gap-3">
            <span className="bg-primary/15 text-primary px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0">
              POST
            </span>
            <div>
              <code className="text-foreground">/api/v1/suggest-meta</code>
              <p className="text-muted-foreground font-sans mt-1">
                Returns AI-generated title and meta description for a URL.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-primary/15 text-primary px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0">
              POST
            </span>
            <div>
              <code className="text-foreground">/api/v1/schema</code>
              <p className="text-muted-foreground font-sans mt-1">
                Returns Schema.org JSON-LD markup for a URL.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-[var(--up)]/15 text-[var(--up)] px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0">
              GET
            </span>
            <div>
              <code className="text-foreground">/api/v1/health-score</code>
              <p className="text-muted-foreground font-sans mt-1">
                Returns the current SEO health score and breakdown.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
