import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { tenantDb } from "@/db/client";
import { db, schema } from "@/db/client";
import { and, eq, isNull } from "drizzle-orm";
import { getAuthUrl } from "@/lib/google-oauth";
import { getApiKeyStatus } from "@/lib/actions/api-keys";
import { randomBytes } from "node:crypto";
import {
  Check,
  AlertCircle,
  KeyRound,
  Globe,
  Users,
  Briefcase,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { ApiKeysForm } from "./api-keys/api-keys-form";
import { saveApiKeys } from "@/lib/actions/api-keys";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await resolveAccountContext();
  const t = tenantDb(ctx.ownerId);
  const [gsc] = await t.selectGscToken();
  const error = (await searchParams).error;
  const profile = await t.selectBusinessProfile();

  const state = randomBytes(16).toString("hex");
  const authUrl = process.env.GOOGLE_CLIENT_ID ? getAuthUrl(state) : null;

  // API keys status
  const apiKeyStatus = ctx.isOwner ? await getApiKeyStatus(ctx.ownerId) : null;
  const configuredKeys = apiKeyStatus
    ? Object.values(apiKeyStatus).filter(Boolean).length
    : 0;

  // Team members count
  const members = await db
    .select({ id: schema.teamMembers.id })
    .from(schema.teamMembers)
    .where(eq(schema.teamMembers.ownerId, ctx.ownerId));

  const pendingInvites = await db
    .select({ id: schema.teamInvites.id })
    .from(schema.teamInvites)
    .where(
      and(
        eq(schema.teamInvites.ownerId, ctx.ownerId),
        isNull(schema.teamInvites.acceptedAt),
      ),
    );

  return (
    <div className="px-4 md:px-9 py-7 max-w-[900px] mx-auto space-y-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          account
        </p>
        <h1 className="font-display text-[40px] mt-2">Settings</h1>
      </header>

      {/* Google Search Console */}
      <section className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Google Search Console</h2>
              <p className="text-xs text-muted-foreground">
                Read-only access to your search performance data.
              </p>
            </div>
            {gsc && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-[var(--up)] text-xs font-mono">
                <Check className="h-3 w-3" strokeWidth={2} />
                connected
              </span>
            )}
          </div>

          {gsc && (
            <p className="text-xs text-muted-foreground font-mono mb-4">
              Connected {new Date(gsc.connectedAt).toLocaleDateString()} · Scope: webmasters.readonly
            </p>
          )}

          {ctx.isOwner ? (
            <>
              {authUrl && (
                <a
                  href={authUrl}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium hover:opacity-85 transition"
                >
                  {gsc ? "Re-connect" : "Connect GSC"}
                </a>
              )}
              {!authUrl && (
                <p className="text-xs text-muted-foreground">
                  Set <code className="font-mono">GOOGLE_CLIENT_ID</code> in env to enable.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {gsc ? "Connected by the account owner." : "Only the account owner can connect GSC."}
            </p>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--down)]/30 bg-[var(--down)]/5 p-3 text-sm text-[var(--down)]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={2} />
              <div>
                <div className="font-medium">Connection failed</div>
                <div className="text-xs opacity-80 font-mono">{error}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* API Keys — owner only */}
      {ctx.isOwner && apiKeyStatus && (
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <KeyRound className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-sm font-semibold">API Keys</h2>
                <p className="text-xs text-muted-foreground">
                  Use your own keys for Claude, Gemini, HuggingFace, or Nvidia.
                  {configuredKeys > 0 && (
                    <span className="ml-2 text-[var(--up)] font-mono">{configuredKeys}/4 configured</span>
                  )}
                </p>
              </div>
            </div>
            <ApiKeysForm status={apiKeyStatus} saveApiKeys={saveApiKeys} />
            <p className="text-xs text-muted-foreground mt-4">
              Your keys are encrypted at rest (AES-256-GCM). When configured, your keys are used instead of ours.
            </p>
          </div>
        </section>
      )}

      {/* Quick links to other settings pages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SettingsLink
          href="/dashboard/business"
          icon={Briefcase}
          title="Business Profile"
          description={profile?.businessName ?? "Not configured"}
        />
        <SettingsLink
          href="/dashboard/team"
          icon={Users}
          title="Team"
          description={`${members.length} member${members.length !== 1 ? "s" : ""}${pendingInvites.length > 0 ? ` · ${pendingInvites.length} pending` : ""}`}
        />
        {ctx.isOwner && (
          <SettingsLink
            href="/dashboard/billing"
            icon={CreditCard}
            title="Billing"
            description="Plan & credits"
          />
        )}
      </div>
    </div>
  );
}

function SettingsLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Briefcase;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="bg-card rounded-2xl border border-border p-5 hover:bg-secondary/50 transition-colors flex items-center gap-3"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{description}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
    </Link>
  );
}
