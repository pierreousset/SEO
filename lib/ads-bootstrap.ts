import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import {
  fetchCustomer,
  fetchSearchTerms,
  isAdsTestTokenError,
  listAccessibleCustomers,
  listCustomerClients,
  type AdsCustomer,
} from "@/lib/google-ads";

export type AdsBootstrapResult = {
  customerId: string | null;
  termCount: number;
  warning?: string;
};

function periodWindow(): { start: string; end: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export async function persistSearchTerms(
  userId: string,
  customerId: string,
  rows: Awaited<ReturnType<typeof fetchSearchTerms>>,
) {
  const { start, end } = periodWindow();
  await db
    .delete(schema.adsSearchTerms)
    .where(
      and(
        eq(schema.adsSearchTerms.userId, userId),
        eq(schema.adsSearchTerms.customerId, customerId),
      ),
    );

  if (rows.length === 0) return 0;

  const values = rows.map((r) => ({
    id: randomUUID(),
    userId,
    customerId,
    query: r.query.toLowerCase().trim().replace(/\s+/g, " "),
    clicks: r.clicks,
    impressions: r.impressions,
    costMicros: r.costMicros,
    conversions: r.conversions,
    periodStart: start,
    periodEnd: end,
  }));

  // Unique on (userId, customerId, query, periodStart) — merge dupes in JS.
  const merged = new Map<string, (typeof values)[number]>();
  for (const v of values) {
    const prev = merged.get(v.query);
    if (!prev) {
      merged.set(v.query, v);
      continue;
    }
    prev.clicks += v.clicks;
    prev.impressions += v.impressions;
    prev.costMicros += v.costMicros;
    prev.conversions += v.conversions;
  }

  await db.insert(schema.adsSearchTerms).values([...merged.values()]);
  return merged.size;
}

export async function bootstrapAdsForUser(
  userId: string,
  refreshToken: string,
): Promise<AdsBootstrapResult> {
  const ids = await listAccessibleCustomers(refreshToken);
  if (ids.length === 0) {
    console.warn("[ads/bootstrap] listAccessibleCustomers returned 0");
    return { customerId: null, termCount: 0, warning: "no_account" };
  }

  const seen = new Set<string>();
  const profiles: AdsCustomer[] = [];
  const managers: AdsCustomer[] = [];

  for (const id of ids.slice(0, 12)) {
    try {
      const c = await fetchCustomer(refreshToken, id, id);
      if (c && !seen.has(c.customerId)) {
        seen.add(c.customerId);
        if (c.manager) managers.push(c);
        else profiles.push(c);
      } else if (!c) {
        managers.push({
          customerId: id,
          descriptiveName: null,
          currencyCode: null,
          manager: true,
        });
      }
    } catch (err) {
      if (isAdsTestTokenError(err)) {
        return { customerId: id, termCount: 0, warning: "token_test_only" };
      }
      console.warn("[ads/bootstrap] fetchCustomer failed", id, err);
      managers.push({
        customerId: id,
        descriptiveName: null,
        currencyCode: null,
        manager: true,
      });
    }
  }

  for (const mcc of managers) {
    try {
      const children = await listCustomerClients(refreshToken, mcc.customerId);
      for (const child of children) {
        if (seen.has(child.customerId)) continue;
        seen.add(child.customerId);
        if (child.manager) managers.push(child);
        else profiles.push(child);
      }
    } catch (err) {
      if (isAdsTestTokenError(err)) {
        return { customerId: mcc.customerId, termCount: 0, warning: "token_test_only" };
      }
      console.warn("[ads/bootstrap] listCustomerClients failed", mcc.customerId, err);
    }
  }

  const clients = profiles.filter((p) => !p.manager);
  const chosen = clients[0] ?? null;
  if (!chosen) {
    console.warn("[ads/bootstrap] no client account under", ids);
    return { customerId: null, termCount: 0, warning: "no_account" };
  }

  const loginId = managers[0]?.customerId;
  const all = [...managers, ...clients];
  await db.delete(schema.adsAccounts).where(eq(schema.adsAccounts.userId, userId));
  for (const p of all) {
    await db.insert(schema.adsAccounts).values({
      id: randomUUID(),
      userId,
      customerId: p.customerId,
      descriptiveName: p.descriptiveName,
      currencyCode: p.currencyCode,
      manager: p.manager,
      selected: p.customerId === chosen.customerId,
    });
  }

  let termCount = 0;
  try {
    const rows = await fetchSearchTerms(refreshToken, chosen.customerId, 500, loginId);
    termCount = await persistSearchTerms(userId, chosen.customerId, rows);
  } catch (err) {
    console.warn("[ads/bootstrap] search terms failed:", err);
    return { customerId: chosen.customerId, termCount: 0, warning: "import_failed" };
  }

  return { customerId: chosen.customerId, termCount };
}
