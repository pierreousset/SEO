import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { PLAN_PRICE_EUR } from "@/lib/billing-constants";
import { locale } from "./locale";
import { AuthForm } from "@/components/marketing/auth-form";
import { SessionRedirect } from "@/components/marketing/session-redirect";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ProductPreview } from "@/components/marketing/product-preview";
import { CompoundWidget } from "@/components/marketing/compound-widget";
import { BrandMark } from "@/components/brand-mark";

const baseUrl = process.env.BETTER_AUTH_URL ?? "https://seo.240company.com";

export async function generateMetadata(): Promise<Metadata> {
  const lng = await getLocale();
  const i = locale[lng];
  return {
    title: { absolute: i.meta.title },
    description: i.meta.description,
    openGraph: {
      title: i.meta.title,
      description: i.meta.description,
      locale: lng === "fr" ? "fr_FR" : "en_US",
      alternateLocale: lng === "fr" ? "en_US" : "fr_FR",
    },
    twitter: {
      title: i.meta.title,
      description: i.meta.description,
    },
    alternates: { canonical: "/" },
  };
}

export default async function LandingPage() {
  const lng = await getLocale();
  const i = locale[lng];
  const price = PLAN_PRICE_EUR;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        name: "240 Company",
        url: baseUrl,
      },
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        name: i.brand,
        url: baseUrl,
        inLanguage: lng === "fr" ? "fr-FR" : "en-US",
        publisher: { "@id": `${baseUrl}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${baseUrl}/#app`,
        name: i.brand,
        url: baseUrl,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "SEO software",
        operatingSystem: "Web",
        description: i.meta.description,
        author: { "@id": `${baseUrl}/#organization` },
        publisher: { "@id": `${baseUrl}/#organization` },
        offers: {
          "@type": "OfferCatalog",
          name: i.pricing.title,
          itemListElement: [
            {
              "@type": "Offer",
              name: i.pricing.free.name,
              price: "0",
              priceCurrency: "EUR",
              url: `${baseUrl}#get-started`,
              availability: "https://schema.org/InStock",
            },
            {
              "@type": "Offer",
              name: i.pricing.pro.name,
              price: String(price),
              priceCurrency: "EUR",
              url: `${baseUrl}#pricing`,
              availability: "https://schema.org/InStock",
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: String(price),
                priceCurrency: "EUR",
                unitText: "MONTH",
              },
            },
          ],
        },
      },
    ],
  };

  return (
    <main className="flex-1 flex flex-col bg-background">
      <SessionRedirect />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <SiteHeader i={i} />

      <section className="w-full max-w-[1280px] mx-auto px-5 sm:px-8 md:px-10 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-start">
          <div className="lg:col-span-5 min-w-0 lg:pt-4">
            <p className="font-caveat text-[1.75rem] md:text-[2rem] text-ink-black leading-none">
              {i.hero.eyebrow}
            </p>
            <h1 className="text-heading-lg md:text-display font-semibold text-ink-black mt-5 leading-[1.08]">
              {i.hero.titleLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <p className="text-body md:text-subheading text-deep-slate mt-6 max-w-[32rem] text-pretty">
              {i.hero.subtitle}
            </p>
            <div className="mt-10 flex flex-col items-start gap-3">
              <a
                href="#get-started"
                className="group inline-flex items-center gap-3 h-12 pl-6 pr-1.5 rounded-full bg-button-black text-canvas-white text-sm shadow-button transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                {i.hero.cta}
                <span className="w-9 h-9 rounded-full bg-canvas-white/12 flex items-center justify-center">
                  <ArrowRight
                    className="w-4 h-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                    strokeWidth={1.75}
                  />
                </span>
              </a>
              <p className="text-caption text-ash-gray">{i.hero.micro(price)}</p>
            </div>
          </div>
          <div className="lg:col-span-7 min-w-0">
            <ProductPreview i={i} />
          </div>
        </div>
      </section>

      <section className="w-full bg-canvas-white">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 md:px-10 py-20 md:py-28">
          <p className="text-caption text-ash-gray">{i.problem.eyebrow}</p>
          <h2 className="text-heading md:text-heading-lg font-semibold text-ink-black mt-2 max-w-[36rem] text-balance">
            {i.problem.title}
          </h2>
          <p className="text-body text-ash-gray mt-3">{i.problem.subtitle}</p>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
            <div>
              <p className="text-caption text-ash-gray">{i.problem.leftLabel}</p>
              <ul className="mt-5 space-y-6">
                {i.problem.rows.map((row) => (
                  <li key={row.gsc} className="text-body text-ash-gray">
                    {row.gsc}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-caption text-sky-teal">{i.problem.rightLabel}</p>
              <ul className="mt-5 space-y-6">
                {i.problem.rows.map((row) => (
                  <li key={row.ours} className="text-body md:text-subheading font-medium text-ink-black leading-snug">
                    {row.ours}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full max-w-[1200px] mx-auto px-5 sm:px-8 md:px-10 py-20 md:py-28">
        <p className="text-caption text-ash-gray">{i.compound.eyebrow}</p>
        <h2 className="text-heading md:text-heading-lg font-semibold text-ink-black mt-2 max-w-[36rem] text-balance">
          {i.compound.title}
        </h2>
        <p className="text-body text-ash-gray mt-3 max-w-[36rem]">{i.compound.subtitle}</p>
        <div className="mt-12 max-w-[560px] mx-auto">
          <CompoundWidget lng={lng} />
          <p className="text-caption text-ash-gray mt-3 px-1">{i.compound.footnote}</p>
        </div>
      </section>

      <section id="how" className="w-full max-w-[1200px] mx-auto px-5 sm:px-8 md:px-10 py-20 md:py-28">
        <p className="text-caption text-ash-gray">{i.how.eyebrow}</p>
        <h2 className="text-heading md:text-heading-lg font-semibold text-ink-black mt-2 text-balance">
          {i.how.title}
        </h2>
        <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {i.how.steps.map((step) => (
            <li key={step.n} className="sheet min-w-0 px-6 py-8">
              <p className="text-heading font-semibold text-ink-black tabular-nums">{step.n}</p>
              <h3 className="text-subheading font-semibold text-ink-black mt-4">{step.title}</h3>
              <p className="text-body-sm text-ash-gray mt-2 max-w-[28rem]">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="w-full bg-canvas-white">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 md:px-10 py-20 md:py-28">
          <p className="text-caption text-ash-gray">{i.capabilities.eyebrow}</p>
          <h2 className="text-heading md:text-heading-lg font-semibold text-ink-black mt-2 max-w-[32rem] text-balance">
            {i.capabilities.title}
          </h2>
          <p className="text-body text-ash-gray mt-3 max-w-[32rem]">{i.capabilities.lead}</p>
          <ul className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8">
            {i.capabilities.items.map((item) => (
              <li key={item.title} className="min-w-0">
                <h3 className="text-body font-semibold text-ink-black">{item.title}</h3>
                <p className="text-body-sm text-ash-gray mt-1.5">{item.body}</p>
              </li>
            ))}
          </ul>
          <p className="font-caveat text-4xl md:text-5xl text-ink-black mt-20 max-w-[28rem] leading-tight">
            {i.quote}
          </p>
        </div>
      </section>

      <section id="pricing" className="w-full max-w-[1200px] mx-auto px-5 sm:px-8 md:px-10 py-20 md:py-28">
        <p className="text-caption text-ash-gray">{i.pricing.eyebrow}</p>
        <h2 className="text-heading md:text-heading-lg font-semibold text-ink-black mt-2 text-balance">
          {i.pricing.title}
        </h2>
        <p className="text-body text-ash-gray mt-3">{i.pricing.subtitle}</p>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <PricingCard
            name={i.pricing.free.name}
            price={i.pricing.free.price}
            period={i.pricing.free.period}
            features={i.pricing.free.features}
            cta={i.pricing.free.cta}
          />
          <PricingCard
            name={i.pricing.pro.name}
            price={`${price}€`}
            period={i.pricing.pro.period}
            features={i.pricing.pro.features}
            cta={i.pricing.pro.cta}
            highlighted
          />
        </div>
        <p className="text-caption text-ash-gray mt-6">{i.pricing.vat}</p>
      </section>

      <section className="w-full bg-canvas-white">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 md:px-10 py-20 md:py-28">
          <p className="text-caption text-ash-gray">{i.faq.eyebrow}</p>
          <h2 className="text-heading md:text-heading-lg font-semibold text-ink-black mt-2">
            {i.faq.title}
          </h2>
          <div className="mt-10 max-w-[720px] divide-y divide-hairline">
            {i.faq.items.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="cursor-pointer list-none text-body font-medium text-ink-black flex items-start justify-between gap-4">
                  <span>{item.q}</span>
                  <span className="text-ash-gray group-open:hidden shrink-0">+</span>
                  <span className="text-ash-gray hidden group-open:inline shrink-0">−</span>
                </summary>
                <p className="text-body-sm text-ash-gray mt-3 max-w-[60ch]">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="get-started" className="w-full max-w-[1200px] mx-auto px-5 sm:px-8 md:px-10 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-6">
            <h2 className="text-heading md:text-heading-lg font-semibold text-ink-black text-balance">
              {i.close.title}
            </h2>
            <p className="text-body text-ash-gray mt-3">{i.close.subtitle}</p>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <div className="sheet p-6 sm:p-8">
              <BrandMark href="/" />
              <h3 className="text-subheading font-semibold text-ink-black mb-5 mt-5">
                {i.close.formTitle}
              </h3>
              <AuthForm copy={i.auth} />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter i={i} />
    </main>
  );
}

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
  period: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}) {
  return (
    <div className="sheet flex flex-col gap-6 px-8 py-10">
      <div>
        <h3 className="text-caption text-ash-gray">{name}</h3>
        <div className="flex items-baseline gap-1 mt-3">
          <span className="text-heading-lg font-semibold text-ink-black tabular-nums leading-none">
            {price}
          </span>
          {period ? (
            <span className="text-body-sm text-ash-gray">{period}</span>
          ) : null}
        </div>
      </div>
      <ul className="flex flex-col gap-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-body-sm text-ink-black">
            <Check className="w-4 h-4 shrink-0 mt-0.5 text-sky-teal" strokeWidth={1.75} />
            {f}
          </li>
        ))}
      </ul>
      <a
        href="#get-started"
        className={`inline-flex items-center justify-center h-11 px-5 rounded-full text-sm w-full ${
          highlighted
            ? "bg-button-black text-canvas-white shadow-button"
            : "border-[1.5px] border-hairline text-ink-black"
        }`}
      >
        {cta}
      </a>
    </div>
  );
}
