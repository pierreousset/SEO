import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { tenantDb } from "@/db/client";
import { BusinessProfileForm } from "@/components/business-profile-form";

export const dynamic = "force-dynamic";

export default async function BusinessPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const t = tenantDb(session.user.id);
  const profile = await t.selectBusinessProfile();

  return (
    <div className="px-8 py-6 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Business context</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fill this once. Every AI brief uses it as system context, so recommendations are
          specific to your business instead of generic SEO advice.
        </p>
      </header>

      <BusinessProfileForm
        initial={
          profile
            ? {
                businessName: profile.businessName ?? "",
                primaryService: profile.primaryService ?? "",
                secondaryServices: profile.secondaryServices.join(", "),
                targetCities: profile.targetCities.join(", "),
                targetCustomer: profile.targetCustomer ?? "",
                averageCustomerValueEur: profile.averageCustomerValueEur ?? "",
                competitorUrls: profile.competitorUrls.join("\n"),
                biggestSeoProblem: profile.biggestSeoProblem ?? "",
                preferredLanguage: profile.preferredLanguage ?? "fr",
              }
            : {
                businessName: "",
                primaryService: "",
                secondaryServices: "",
                targetCities: "",
                targetCustomer: "",
                averageCustomerValueEur: "",
                competitorUrls: "",
                biggestSeoProblem: "",
                preferredLanguage: "fr",
              }
        }
      />
    </div>
  );
}
