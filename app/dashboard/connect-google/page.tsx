import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { tenantDb } from "@/db/client";
import { getAuthUrl } from "@/lib/google-oauth";
import { randomBytes } from "node:crypto";
import { Check, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ConnectGooglePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const t = tenantDb(session.user.id);
  const [gsc] = await t.selectGscToken();
  const error = (await searchParams).error;

  const state = randomBytes(16).toString("hex");
  const authUrl = process.env.GOOGLE_CLIENT_ID ? getAuthUrl(state) : null;

  return (
    <div className="px-8 py-6 max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Connections</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Grant read-only access to your Google Search Console data.
      </p>

      <div className="mt-6 border border-border rounded-md bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Google Search Console</h2>
              {gsc && (
                <span className="inline-flex items-center gap-1 text-[var(--up)] text-xs">
                  <Check className="h-3 w-3" strokeWidth={2} />
                  connected
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Scope: <code className="font-mono text-xs">webmasters.readonly</code>. We never
              modify anything, we only read positions and queries.
            </p>
            {gsc && (
              <p className="mt-2 text-xs text-muted-foreground font-mono tabular">
                Connected {new Date(gsc.connectedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          {authUrl && (
            <a
              href={authUrl}
              className="shrink-0 inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90"
            >
              {gsc ? "Re-connect" : "Connect"}
            </a>
          )}
          {!authUrl && (
            <div className="shrink-0 text-xs text-muted-foreground max-w-[200px] text-right">
              Set <code>GOOGLE_CLIENT_ID</code> in .env to enable
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded border border-[var(--down)]/30 bg-[var(--down)]/5 p-3 text-sm text-[var(--down)]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={2} />
            <div>
              <div className="font-medium">Connection failed</div>
              <div className="text-xs opacity-80 font-mono tabular">{error}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
