"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { tenantDb } from "@/db/client";

const profileSchema = z.object({
  businessName: z.string().max(120).optional(),
  primaryService: z.string().max(120).optional(),
  secondaryServices: z.array(z.string().max(120)).max(10).default([]),
  targetCities: z.array(z.string().max(80)).max(10).default([]),
  targetCustomer: z.string().max(500).optional(),
  averageCustomerValueEur: z.number().int().nonnegative().optional(),
  competitorUrls: z.array(z.string().url().max(200)).max(3).default([]),
  biggestSeoProblem: z.string().max(300).optional(),
  preferredLanguage: z.enum(["fr", "en"]).default("fr"),
});

export async function saveBusinessProfile(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("unauthorized");

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
  };

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }

  const t = tenantDb(session.user.id);
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
