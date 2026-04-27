"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tenantDb } from "@/db/client";
import { requireAccountContext } from "@/lib/account-context";

const profileSchema = z.object({
  businessName: z.string().max(120).optional(),
  primaryService: z.string().max(120).optional(),
  secondaryServices: z.array(z.string().max(120)).max(10).default([]),
  targetCities: z.array(z.string().max(80)).max(10).default([]),
  targetCustomer: z.string().max(500).optional(),
  averageCustomerValueEur: z.number().int().nonnegative().optional(),
  competitorUrls: z.array(z.string().url().max(200)).max(5).default([]),
  biggestSeoProblem: z.string().max(300).optional(),
  preferredLanguage: z.enum(["fr", "en"]).default("fr"),
  weeklyEmailEnabled: z.boolean().default(true),
  weeklyEmailRecipient: z
    .string()
    .email()
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function saveBusinessProfile(formData: FormData) {
  const ctx = await requireAccountContext();

  const raw = {
    businessName: (formData.get("businessName") || "").toString().trim() || undefined,
    primaryService: (formData.get("primaryService") || "").toString().trim() || undefined,
    secondaryServices: splitList(formData.get("secondaryServices")),
    targetCities: splitList(formData.get("targetCities")),
    targetCustomer: (formData.get("targetCustomer") || "").toString().trim() || undefined,
    averageCustomerValueEur:
      formData.get("averageCustomerValueEur")
        ? Number(formData.get("averageCustomerValueEur"))
        : undefined,
    competitorUrls: splitList(formData.get("competitorUrls")),
    biggestSeoProblem: (formData.get("biggestSeoProblem") || "").toString().trim() || undefined,
    preferredLanguage: ((formData.get("preferredLanguage") || "fr").toString() as "fr" | "en"),
    weeklyEmailEnabled: formData.get("weeklyEmailEnabled") === "on",
    weeklyEmailRecipient:
      (formData.get("weeklyEmailRecipient") || "").toString().trim() || undefined,
  };

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }

  const t = tenantDb(ctx.ownerId);
  await t.upsertBusinessProfile(parsed.data);
  revalidatePath("/dashboard/business");
  revalidatePath("/dashboard");
  return { ok: true };
}

function splitList(v: FormDataEntryValue | null): string[] {
  if (!v) return [];
  return v
    .toString()
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Add a single competitor URL from the discovery UI. Preserves the existing
 * list (up to the 5 cap). Used by the "Add" buttons on /dashboard/business.
 */
export async function addCompetitorFromDiscovery(domain: string) {
  const ctx = await requireAccountContext();

  const clean = domain.trim().replace(/^www\./, "").toLowerCase();
  if (!clean) return { error: "empty domain" };

  const t = tenantDb(ctx.ownerId);
  const profile = await t.selectBusinessProfile();
  const existing = (profile?.competitorUrls ?? []) as string[];

  // De-dupe by normalised hostname — the stored value is a full URL.
  const existingDomains = new Set(
    existing.map((u) => {
      try {
        return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
      } catch {
        return u.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
      }
    }),
  );
  if (existingDomains.has(clean)) return { error: "already added" };
  if (existing.length >= 5) {
    return { error: "max 5 competitors. Remove one in the form first." };
  }

  const url = `https://${clean}`;
  const next = [...existing, url];

  await t.upsertBusinessProfile({
    businessName: profile?.businessName ?? null,
    primaryService: profile?.primaryService ?? null,
    secondaryServices: profile?.secondaryServices ?? [],
    targetCities: profile?.targetCities ?? [],
    targetCustomer: profile?.targetCustomer ?? null,
    averageCustomerValueEur: profile?.averageCustomerValueEur ?? null,
    competitorUrls: next,
    biggestSeoProblem: profile?.biggestSeoProblem ?? null,
    preferredLanguage: profile?.preferredLanguage ?? "fr",
    weeklyEmailEnabled: profile?.weeklyEmailEnabled ?? true,
    weeklyEmailRecipient: profile?.weeklyEmailRecipient ?? null,
  });

  revalidatePath("/dashboard/business");
  revalidatePath("/dashboard/gap");
  revalidatePath("/dashboard/aeo");
  return { ok: true, domain: clean };
}
