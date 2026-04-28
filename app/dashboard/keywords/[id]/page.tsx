import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { and, eq, desc } from "drizzle-orm";
import { ArrowLeft, ExternalLink, FileText, Loader2, XCircle } from "lucide-react";
import { GenerateContentBriefButton } from "@/components/generate-content-brief-button";
import { IntentStageBadge } from "@/components/intent-stage-badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PositionAlerts } from "@/components/position-alerts";
import { listAlerts } from "@/lib/actions/alerts";
import {
  SERP_FEATURE_LABELS,
  SERP_FEATURE_COLORS,
  type SerpFeature,
} from "@/lib/serp-features";

export const dynamic = "force-dynamic";

type Brief = NonNullable<typeof schema.contentBriefs.$inferSelect.content>;

export default async function KeywordBriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveAccountContext();

  const [keyword] = await db
    .select()
    .from(schema.keywords)
    .where(and(eq(schema.keywords.id, id), eq(schema.keywords.userId, ctx.ownerId)))
    .limit(1);
  if (!keyword) notFound();

  const [latestBrief] = await db
    .select()
    .from(schema.contentBriefs)
    .where(
      and(
        eq(schema.contentBriefs.keywordId, id),
        eq(schema.contentBriefs.userId, ctx.ownerId),
      ),
    )
    .orderBy(desc(schema.contentBriefs.queuedAt))
    .limit(1);

  const [latestPosition] = await db
    .select()
    .from(schema.positions)
    .where(
      and(
        eq(schema.positions.keywordId, id),
        eq(schema.positions.userId, ctx.ownerId),
      ),
    )
    .orderBy(desc(schema.positions.date))
    .limit(1);

  const alerts = await listAlerts(id);

  const [latestSerpFeature] = await db
    .select()
    .from(schema.serpFeatures)
    .where(
      and(
        eq(schema.serpFeatures.keywordId, id),
        eq(schema.serpFeatures.userId, ctx.ownerId),
      ),
    )
    .orderBy(desc(schema.serpFeatures.date))
    .limit(1);

  const serpFeatureList = (latestSerpFeature?.features ?? []) as SerpFeature[];
  const userInFeature = latestSerpFeature?.hasFeature ?? false;
  const userFeatureType = latestSerpFeature?.featureType as SerpFeature | null;

  const status = (latestBrief?.status ?? null) as
    | "queued"
    | "running"
    | "done"
    | "failed"
    | null;
  const brief = (latestBrief?.content ?? null) as Brief | null;
  const isActive = status === "queued" || status === "running";

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-8">
      {/* Auto-refresh while the job is running */}
      {isActive && <meta httpEquiv="refresh" content="5" />}

      <Breadcrumbs />

      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
            Keyword brief
          </p>
          <h1 className="font-display text-[40px] mt-2 break-words">
            {keyword.query}
          </h1>
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <IntentStageBadge stage={keyword.intentStage} />
            <span className="text-xs text-muted-foreground font-mono tabular">
              {keyword.country.toUpperCase()} · {keyword.device}
            </span>
            {latestPosition?.position != null && (
              <span className="text-xs text-muted-foreground font-mono tabular">
                rank #{latestPosition.position} as of {latestPosition.date}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <GenerateContentBriefButton
            keywordId={id}
            activeStatus={status}
            label={brief ? "Regenerate" : "Generate writer brief"}
          />
        </div>
      </header>

      {/* Status banner */}
      {status === "queued" && (
        <StatusBanner
          tone="info"
          icon={<Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
        >
          <strong>Brief queued…</strong>
        </StatusBanner>
      )}
      {status === "running" && (
        <StatusBanner
          tone="info"
          icon={<FileText className="h-4 w-4 animate-pulse" strokeWidth={2} />}
        >
          <strong>Generating brief</strong> — pulling SERP data, asking Claude. ~20-40s.
        </StatusBanner>
      )}
      {status === "failed" && (
        <StatusBanner
          tone="error"
          icon={<XCircle className="h-4 w-4" strokeWidth={2} />}
        >
          <strong>Generation failed.</strong>
          {latestBrief?.error && (
            <span className="ml-2 text-xs opacity-80 font-mono tabular">
              {latestBrief.error}
            </span>
          )}
        </StatusBanner>
      )}

      {!brief && status !== "queued" && status !== "running" && status !== "failed" && (
        <div className="rounded-2xl bg-card p-8 md:p-10 max-w-2xl">
          <p className="text-lg">
            Generate a <strong>writer-ready brief</strong> for this keyword — outline, entities,
            meta variants, and competitor takeaways. Uses your latest SERP fetch + GSC data +
            business profile.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Takes 20-40s and costs ~$0.02-$0.05 per brief.
          </p>
        </div>
      )}

      {brief && (
        <>
          {/* Hero summary */}
          <section className="rounded-2xl bg-card p-6 md:p-8">
            <div className="font-mono text-[10px] text-muted-foreground">
              target intent
            </div>
            <p className="mt-3 text-lg md:text-xl leading-relaxed">{brief.targetIntent}</p>
            <div className="mt-6 font-mono text-[10px] text-muted-foreground">
              your angle
            </div>
            <p className="mt-3 text-lg md:text-xl leading-relaxed">{brief.primaryAngle}</p>
            <div className="mt-6 flex items-center gap-6 text-sm font-mono tabular text-muted-foreground flex-wrap">
              <span>
                Word count: <strong className="text-foreground">{brief.wordCountMin}–{brief.wordCountMax}</strong>
              </span>
              {latestBrief?.costUsd && (
                <span>
                  Cost: <strong className="text-foreground">${Number(latestBrief.costUsd).toFixed(3)}</strong>
                </span>
              )}
              {latestBrief?.llmModel && (
                <span>
                  Model: <strong className="text-foreground">{latestBrief.llmModel}</strong>
                </span>
              )}
            </div>
          </section>

          {/* Main grid: outline 2/3 + side 1/3 */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Outline */}
            <div className="lg:col-span-2 rounded-2xl bg-card p-6 md:p-8">
              <h2 className="font-display text-2xl md:text-3xl">Outline</h2>
              <p className="text-sm text-muted-foreground mt-2 mb-6">
                {brief.outline.length} sections · follow top-down.
              </p>
              <ol className="space-y-4">
                {brief.outline.map((sec, i) => (
                  <li key={i} className="rounded-[12px] bg-background p-5">
                    <div className="flex items-start gap-3">
                      <div className="font-mono tabular text-xs text-muted-foreground mt-1 w-6 shrink-0">
                        H2.{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-lg">{sec.h2}</h3>
                        {sec.h3s.length > 0 && (
                          <ul className="mt-3 space-y-1.5 text-sm">
                            {sec.h3s.map((h3, j) => (
                              <li
                                key={j}
                                className="flex items-start gap-2 text-muted-foreground"
                              >
                                <span className="font-mono tabular text-xs shrink-0 w-10">
                                  H3.{j + 1}
                                </span>
                                <span>{h3}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {sec.notes && (
                          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                            {sec.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Side: meta, entities, questions */}
            <div className="space-y-6">
              <div className="rounded-2xl bg-card p-6">
                <h3 className="font-mono text-[10px] text-muted-foreground">
                  meta title variants
                </h3>
                <ul className="mt-3 space-y-2">
                  {brief.metaTitleVariants.map((t, i) => (
                    <li key={i} className="rounded-[12px] bg-background px-4 py-3 text-sm">
                      {t}
                      <span className="block font-mono text-[10px] text-muted-foreground mt-1 font-mono tabular">
                        {t.length} chars
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-card p-6">
                <h3 className="font-mono text-[10px] text-muted-foreground">
                  meta description
                </h3>
                <p className="mt-3 text-sm leading-relaxed">{brief.metaDescription}</p>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground font-mono tabular">
                  {brief.metaDescription.length} chars
                </p>
              </div>

              <div className="rounded-2xl bg-card p-6">
                <h3 className="font-mono text-[10px] text-muted-foreground">
                  entities to cover
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {brief.entitiesToCover.map((e, i) => (
                    <span
                      key={i}
                      className="inline-block text-xs px-3 py-1.5 rounded-full bg-background"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-card p-6">
                <h3 className="font-mono text-[10px] text-muted-foreground">
                  questions to answer
                </h3>
                <ul className="mt-3 space-y-2">
                  {brief.questionsToAnswer.map((q, i) => (
                    <li key={i} className="text-sm leading-snug">
                      <span className="text-muted-foreground font-mono tabular text-xs mr-2">
                        Q{i + 1}.
                      </span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Competitor insights */}
          {brief.competitorInsights.length > 0 && (
            <section className="rounded-2xl bg-card p-6 md:p-8">
              <h2 className="font-display text-2xl md:text-3xl">Competitor takeaways</h2>
              <p className="text-sm text-muted-foreground mt-2 mb-6">
                What each top-ranking page does + the gap you can exploit.
              </p>
              <div className="space-y-3">
                {brief.competitorInsights.map((c, i) => (
                  <div
                    key={`${c.url}-${i}`}
                    className="rounded-[12px] bg-background p-5 flex items-start gap-4"
                  >
                    <div className="font-mono tabular text-xs text-muted-foreground w-8 text-right shrink-0 mt-1">
                      #{c.position}
                    </div>
                    <div className="flex-1 min-w-0">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-mono tabular text-xs inline-flex items-center gap-1.5 hover:underline truncate max-w-full"
                        title={c.url}
                      >
                        <span className="truncate">{c.domain}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-50" strokeWidth={1.5} />
                      </a>
                      <p className="mt-2 text-sm leading-relaxed">{c.takeaway}</p>
                    </div>
                    <StrengthPill strength={c.strength} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Internal linking + warnings */}
          {(brief.internalLinkingHints.length > 0 || brief.warnings.length > 0) && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {brief.internalLinkingHints.length > 0 && (
                <div className="rounded-2xl bg-card p-6 md:p-8">
                  <h3 className="font-mono text-[10px] text-muted-foreground">
                    internal linking
                  </h3>
                  <ul className="mt-4 space-y-2 text-sm leading-relaxed list-disc pl-5">
                    {brief.internalLinkingHints.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}
              {brief.warnings.length > 0 && (
                <div className="rounded-2xl border border-[var(--down)]/30 bg-[var(--down)]/5 p-6 md:p-8">
                  <h3 className="font-mono text-[10px] text-[var(--down)]">
                    warnings
                  </h3>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground leading-relaxed list-disc pl-5">
                    {brief.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* SERP Features */}
      <section className="rounded-2xl bg-card p-6 md:p-8">
        <div className="font-mono text-[10px] text-muted-foreground">
          serp features
        </div>
        <h2 className="text-xl font-semibold mt-0.5">SERP Features</h2>
        {serpFeatureList.length > 0 ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {serpFeatureList.map((feature) => (
                <span
                  key={feature}
                  className={`inline-block text-xs px-3 py-1.5 rounded-full font-medium ${SERP_FEATURE_COLORS[feature] ?? "bg-muted text-muted-foreground"}`}
                >
                  {SERP_FEATURE_LABELS[feature] ?? feature}
                </span>
              ))}
            </div>
            <div className="mt-4 text-sm">
              {userInFeature && userFeatureType ? (
                <p className="text-[var(--up)]">
                  Your page appears in:{" "}
                  <strong>{SERP_FEATURE_LABELS[userFeatureType] ?? userFeatureType}</strong>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Not in any SERP feature
                </p>
              )}
            </div>
            {latestSerpFeature && (
              <p className="mt-2 text-xs text-muted-foreground font-mono tabular">
                as of {latestSerpFeature.date}
              </p>
            )}
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            SERP feature detection will be available after the next SERP fetch
          </p>
        )}
      </section>

      {/* Position alerts */}
      <PositionAlerts keywordId={id} initialAlerts={alerts} />
    </div>
  );
}

function StrengthPill({ strength }: { strength: "weak" | "medium" | "strong" }) {
  const map = {
    strong: "bg-[var(--down)]/15 text-[var(--down)]",
    medium: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
    weak: "bg-[var(--up)]/15 text-[var(--up)]",
  };
  return (
    <span
      className={`inline-block font-mono text-[10px] px-2.5 py-1 rounded-full shrink-0 ${map[strength]}`}
    >
      {strength}
    </span>
  );
}

function StatusBanner({
  tone,
  icon,
  children,
}: {
  tone: "info" | "error";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "bg-[var(--down)]/10 text-[var(--down)] border-[var(--down)]/30"
      : "bg-primary/10 text-primary border-primary/30";
  return (
    <div className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${cls}`}>
      {icon}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
