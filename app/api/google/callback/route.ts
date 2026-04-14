import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import {
  exchangeCodeForTokens,
  listSites,
  fetchTopQueries,
  siteUrlToDomain,
} from "@/lib/google-oauth";
import { encrypt } from "@/lib/encryption";
import { tenantDb } from "@/db/client";
import { classifyIntentRule } from "@/lib/llm/intent-classifier";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/connect-google?error=${encodeURIComponent(error)}`, req.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard/connect-google?error=no_code", req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const refreshToken = tokens.refresh_token!;
    const encrypted = encrypt(refreshToken);
    const t = tenantDb(session.user.id);
    await t.upsertGscToken(encrypted, tokens.scope || "");

    // Auto-import: pick first verified GSC property + its top 20 queries as keywords.
    // Skip silently if the user has no existing data, no sites, or the API errors.
    try {
      const existingSites = await t.selectSites();
      if (existingSites.length === 0) {
        const sites = await listSites(refreshToken);
        if (sites.length > 0) {
          const property = sites[0];
          const siteUrl = property.siteUrl!;
          const domain = siteUrlToDomain(siteUrl);

          const [siteRow] = await t.insertSite({
            id: randomUUID(),
            domain,
            gscPropertyUri: siteUrl,
          });

          const topQueries = await fetchTopQueries(refreshToken, siteUrl, 20);
          const profile = await t.selectBusinessProfile();
          const cities = profile?.targetCities ?? [];
          for (const q of topQueries) {
            if (!q.query.trim()) continue;
            await t.insertKeyword({
              id: randomUUID(),
              siteId: siteRow.id,
              query: q.query,
              country: "fr",
              device: "desktop",
              intentStage: classifyIntentRule(q.query, cities),
            });
          }
        }
      }
    } catch (importErr) {
      // Auto-import is best-effort. User can add keywords manually if it fails.
      console.warn("[google/callback] auto-import failed:", importErr);
    }

    return NextResponse.redirect(new URL("/dashboard/keywords?imported=1", req.url));
  } catch (err) {
    console.error("[google/callback]", err);
    return NextResponse.redirect(
      new URL("/dashboard/connect-google?error=exchange_failed", req.url),
    );
  }
}
