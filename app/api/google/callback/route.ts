import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/google-oauth";
import { encrypt } from "@/lib/encryption";
import { tenantDb } from "@/db/client";
import { bootstrapGscForUser } from "@/lib/gsc-bootstrap";
import { bootstrapAdsForUser } from "@/lib/ads-bootstrap";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const isAds = state.startsWith("ads_");
  const failPath = isAds ? "/dashboard/settings" : "/dashboard/connect-google";

  if (error) {
    return NextResponse.redirect(
      new URL(`${failPath}?error=${encodeURIComponent(error)}`, req.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL(`${failPath}?error=no_code`, req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const refreshToken = tokens.refresh_token!;
    const encrypted = encrypt(refreshToken);
    const t = tenantDb(session.user.id);

    const granted = tokens.scope ?? "";
    const hasAds = isAds || granted.includes("adwords");

    if (isAds) {
      await t.upsertAdsToken(encrypted, granted || "adwords");
      let warning = "";
      try {
        const result = await bootstrapAdsForUser(session.user.id, refreshToken);
        if (result.warning) warning = result.warning;
      } catch (importErr) {
        console.warn("[google/callback] ads bootstrap failed:", importErr);
        warning = "import_failed";
      }
      const qs = new URLSearchParams({ ads: "1" });
      if (warning) qs.set("ads_warn", warning);
      return NextResponse.redirect(new URL(`/dashboard?${qs.toString()}`, req.url));
    }

    await t.upsertGscToken(encrypted, granted || "");

    let warning = "";
    try {
      const result = await bootstrapGscForUser(session.user.id, refreshToken);
      if (result.warning) warning = result.warning;
    } catch (importErr) {
      console.warn("[google/callback] bootstrap failed:", importErr);
      warning = "import_failed";
    }

    const qs = new URLSearchParams({ connected: "1" });
    if (warning) qs.set("gsc", warning);

    if (hasAds) {
      await t.upsertAdsToken(encrypted, granted);
      try {
        const adsResult = await bootstrapAdsForUser(session.user.id, refreshToken);
        qs.set("ads", "1");
        if (adsResult.warning) qs.set("ads_warn", adsResult.warning);
      } catch (importErr) {
        console.warn("[google/callback] ads bootstrap after GSC failed:", importErr);
        qs.set("ads", "1");
        qs.set("ads_warn", "import_failed");
      }
    }

    return NextResponse.redirect(new URL(`/dashboard?${qs.toString()}`, req.url));
  } catch (err) {
    console.error("[google/callback]", err);
    return NextResponse.redirect(
      new URL(`${failPath}?error=exchange_failed`, req.url),
    );
  }
}
