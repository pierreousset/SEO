import { describe, expect, it } from "vitest";
import { inferBusinessProfile } from "@/lib/seo/infer-profile";

describe("inferBusinessProfile", () => {
  it("reads Triadica as immobilier Madrid from the homepage", () => {
    const inferred = inferBusinessProfile({
      domain: "triadica.fr",
      siteName: "Triadica",
      homepageTitle: "Agence immobilière française à Madrid | Achat, gestion locative",
      homepageH1s: ["Achetez, rénovez et gérez votre bien à Madrid"],
      homepageDescription:
        "Achetez, rénovez et gérez votre bien à Madrid avec Triadica. Équipe francophone sur place.",
      topQueries: ["agence immobilière madrid", "achat appartement madrid", "gestion locative madrid"],
    });
    expect(inferred.businessName).toBe("Triadica");
    expect(inferred.primaryService).toMatch(/immobilier/);
    expect(inferred.targetCities.map((c) => c.toLowerCase())).toContain("madrid");
    expect(inferred.preferredLanguage).toBe("fr");
  });

  it("does not turn admin paperwork queries into the service", () => {
    const inferred = inferBusinessProfile({
      domain: "triadica.fr",
      homepageTitle: "Agence immobilière française à Madrid",
      topQueries: ["justificatifs de domicile", "certificat de cession", "demande rsa"],
    });
    expect(inferred.primaryService).toMatch(/immobilier|agence/);
    expect(inferred.primaryService).not.toMatch(/rsa|cession|justificatif/);
  });
});
