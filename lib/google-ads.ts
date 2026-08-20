import { ADS_SCOPE, getOAuth2Client } from "@/lib/google-oauth";
const API_VERSION = process.env.GOOGLE_ADS_API_VERSION ?? "v25";

export function adsDeveloperTokenConfigured(): boolean {
  return Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
}

export function isAdsTestTokenError(err: unknown): boolean {
  const code = (err as { adsCode?: string } | undefined)?.adsCode;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    code === "DEVELOPER_TOKEN_NOT_APPROVED" ||
    msg.includes("test accounts") ||
    msg.includes("DEVELOPER_TOKEN_NOT_APPROVED")
  );
}

export function getAdsAuthUrl(state: string) {
  const client = getOAuth2Client();
  const tagged = state.startsWith("ads_") ? state : `ads_${state}`;
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [ADS_SCOPE],
    state: tagged,
  });
}

async function accessToken(refreshToken: string): Promise<string> {
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Could not refresh Google Ads access token.");
  return token;
}

function adsHeaders(token: string, loginCustomerId?: string): Record<string, string> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN is not set.");
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  const login = (loginCustomerId || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(
    /-/g,
    "",
  );
  if (login) headers["login-customer-id"] = login;
  return headers;
}

async function adsJson<T>(
  path: string,
  refreshToken: string,
  init?: RequestInit,
  loginCustomerId?: string,
): Promise<T> {
  const token = await accessToken(refreshToken);
  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/${path}`, {
    ...init,
    headers: {
      ...adsHeaders(token, loginCustomerId),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string; details?: Array<{ errors?: Array<{ message?: string }> }> };
  };
  if (!res.ok) {
    const gads = body.error?.details?.[0]?.errors?.[0];
    const authCode = (
      gads as { errorCode?: { authorizationError?: string } } | undefined
    )?.errorCode?.authorizationError;
    const detail = gads?.message;
    const msg = detail || body.error?.message || `Google Ads API ${res.status}`;
    const err = new Error(msg);
    if (authCode) (err as Error & { adsCode?: string }).adsCode = authCode;
    throw err;
  }
  return body as T;
}

export type AdsCustomer = {
  customerId: string;
  descriptiveName: string | null;
  currencyCode: string | null;
  manager: boolean;
};

export async function listAccessibleCustomers(refreshToken: string): Promise<string[]> {
  const data = await adsJson<{ resourceNames?: string[] }>(
    "customers:listAccessibleCustomers",
    refreshToken,
  );
  return (data.resourceNames ?? [])
    .map((n) => n.replace(/^customers\//, ""))
    .filter(Boolean);
}

export async function fetchCustomer(
  refreshToken: string,
  customerId: string,
  loginCustomerId?: string,
): Promise<AdsCustomer | null> {
  const tryOnce = async (login?: string) => {
    const data = await adsJson<{
      results?: Array<{
        customer?: {
          id?: string;
          descriptiveName?: string;
          currencyCode?: string;
          manager?: boolean;
        };
      }>;
    }>(
      `customers/${customerId}/googleAds:search`,
      refreshToken,
      {
        method: "POST",
        body: JSON.stringify({
          query:
            "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1",
        }),
      },
      login,
    );
    const c = data.results?.[0]?.customer;
    if (!c?.id) return null;
    return {
      customerId: String(c.id),
      descriptiveName: c.descriptiveName ?? null,
      currencyCode: c.currencyCode ?? null,
      manager: Boolean(c.manager),
    } satisfies AdsCustomer;
  };

  try {
    return await tryOnce(loginCustomerId ?? customerId);
  } catch (err) {
    if (isAdsTestTokenError(err)) throw err;
    try {
      return await tryOnce(undefined);
    } catch (err2) {
      if (isAdsTestTokenError(err2)) throw err2;
      return null;
    }
  }
}

export async function listCustomerClients(
  refreshToken: string,
  managerId: string,
): Promise<AdsCustomer[]> {
  const data = await adsJson<{
    results?: Array<{
      customerClient?: {
        id?: string;
        descriptiveName?: string;
        currencyCode?: string;
        manager?: boolean;
        status?: string;
      };
    }>;
  }>(
    `customers/${managerId}/googleAds:search`,
    refreshToken,
    {
      method: "POST",
      body: JSON.stringify({
        query:
          "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.status = 'ENABLED'",
      }),
    },
    managerId,
  );

  return (data.results ?? [])
    .map((row) => {
      const c = row.customerClient;
      if (!c?.id) return null;
      return {
        customerId: String(c.id),
        descriptiveName: c.descriptiveName ?? null,
        currencyCode: c.currencyCode ?? null,
        manager: Boolean(c.manager),
      } satisfies AdsCustomer;
    })
    .filter((c): c is AdsCustomer => c != null && c.customerId !== managerId);
}

export type AdsSearchTermRow = {
  query: string;
  clicks: number;
  impressions: number;
  costMicros: number;
  conversions: number;
};

export async function fetchSearchTerms(
  refreshToken: string,
  customerId: string,
  limit = 500,
  loginCustomerId?: string,
): Promise<AdsSearchTermRow[]> {
  const data = await adsJson<{
    results?: Array<{
      searchTermView?: { searchTerm?: string };
      metrics?: {
        clicks?: string | number;
        impressions?: string | number;
        costMicros?: string | number;
        conversions?: string | number;
      };
    }>;
  }>(
    `customers/${customerId}/googleAds:search`,
    refreshToken,
    {
      method: "POST",
      body: JSON.stringify({
        query: `SELECT search_term_view.search_term, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE segments.date DURING LAST_30_DAYS AND metrics.impressions > 0 ORDER BY metrics.cost_micros DESC LIMIT ${limit}`,
      }),
    },
    loginCustomerId ?? customerId,
  );

  return (data.results ?? [])
    .map((row) => {
      const q = row.searchTermView?.searchTerm?.trim() ?? "";
      const m = row.metrics ?? {};
      return {
        query: q,
        clicks: Number(m.clicks ?? 0) || 0,
        impressions: Number(m.impressions ?? 0) || 0,
        costMicros: Number(m.costMicros ?? 0) || 0,
        conversions: Number(m.conversions ?? 0) || 0,
      };
    })
    .filter((r) => r.query.length > 0);
}
