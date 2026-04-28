import { resolveAccountContext } from "@/lib/account-context";
import { listWebhooks } from "@/lib/actions/webhooks";
import { listApiTokens } from "@/lib/actions/api-tokens";
import { WebhookForm } from "@/components/webhook-form";
import { WebhookRow } from "@/components/webhook-row";
import { ApiTokenSection } from "@/components/api-token-section";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const ctx = await resolveAccountContext();
  const webhooks = await listWebhooks();
  const tokens = await listApiTokens();

  return (
    <div className="px-4 md:px-9 py-7 max-w-[900px] mx-auto space-y-8">
      <header>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="h-3 w-3" strokeWidth={2} />
          Settings
        </Link>
        <h1 className="font-display text-[40px]">Webhooks & API</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send notifications to Slack, Discord, or any URL when events fire. Generate API keys for programmatic access.
        </p>
      </header>

      {/* Add webhook */}
      {ctx.isOwner && (
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-6">
            <h2 className="text-sm font-semibold mb-4">Add Webhook</h2>
            <WebhookForm />
          </div>
        </section>
      )}

      {/* Existing webhooks */}
      {webhooks.length > 0 && (
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-6">
            <h2 className="text-sm font-semibold mb-4">
              Configured Webhooks
              <span className="ml-2 text-xs text-muted-foreground font-mono">
                {webhooks.length}
              </span>
            </h2>
            <div className="space-y-2">
              {webhooks.map((hook) => (
                <WebhookRow
                  key={hook.id}
                  id={hook.id}
                  url={hook.url}
                  provider={hook.provider}
                  events={(hook.events ?? []) as string[]}
                  enabled={hook.enabled}
                  isOwner={ctx.isOwner}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* API Keys */}
      {ctx.isOwner && (
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-6">
            <h2 className="text-sm font-semibold mb-1">API Keys</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Generate Bearer tokens for the <code className="font-mono text-primary">/api/v1/*</code> REST API.
              Keys are shown once at creation.
            </p>
            <ApiTokenSection tokens={tokens} />
          </div>
        </section>
      )}
    </div>
  );
}
