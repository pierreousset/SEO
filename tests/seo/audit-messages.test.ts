import { describe, expect, it } from "vitest";
import {
  auditCopy,
  detectPageLang,
  inferLangFromUrls,
  localizeFinding,
  resolveAuditLang,
} from "@/lib/audit/messages";
import {
  extraWords,
  missingTrackedKeywords,
  titleFromDetail,
  titleRewritePrompt,
} from "@/lib/audit/keyword-context";

describe("detectPageLang", () => {
  it("reads html lang", () => {
    expect(detectPageLang('<html lang="fr-FR">', "https://example.com/")).toBe("fr");
    expect(detectPageLang('<html lang="en">', "https://example.com/")).toBe("en");
  });

  it("falls back to /fr/ or /en/ in the path", () => {
    expect(detectPageLang("<html>", "https://triadica.fr/fr/offres")).toBe("fr");
    expect(detectPageLang("<html>", "https://acme.com/en/pricing")).toBe("en");
  });
});

describe("inferLangFromUrls", () => {
  it("picks the majority locale segment", () => {
    expect(
      inferLangFromUrls(["https://triadica.fr/fr", "https://triadica.fr/fr/offres"]),
    ).toBe("fr");
  });
});

describe("auditCopy", () => {
  it("returns French for a FR site", () => {
    expect(auditCopy("h1_missing", "fr")?.message).toBe("H1 manquant");
  });

  it("returns English for an EN site", () => {
    expect(auditCopy("h1_missing", "en")?.message).toBe("Missing H1");
  });
});

describe("localizeFinding", () => {
  it("rewrites a stored English row into French", () => {
    const out = localizeFinding(
      {
        checkKey: "h1_missing",
        message: "Missing <h1>",
        fix: "Add exactly one <h1>...",
      },
      "fr",
    );
    expect(out.message).toBe("H1 manquant");
    expect(out.fix).toMatch(/H1/);
  });
});

describe("keyword context", () => {
  it("reads the quoted title", () => {
    expect(titleFromDetail('"Agence SEO Lyon"')).toBe("Agence SEO Lyon");
  });

  it("picks the keyword that adds the fewest new words, URL overlap first", () => {
    const out = missingTrackedKeywords(
      "https://example.com/audit-seo",
      "Bienvenue sur notre site",
      ["bienvenue", "audit seo", "brief contenu seo agence lyon"],
    );
    expect(out[0]).toBe("audit seo");
    expect(out.length).toBeLessThanOrEqual(2);
    expect(out).not.toContain("bienvenue");
  });

  it("prefers inserting one word into an existing title", () => {
    const out = missingTrackedKeywords(
      "https://example.com/",
      "Agence web Lyon",
      ["création de site internet pas cher", "agence seo lyon"],
    );
    expect(out[0]).toBe("agence seo lyon");
    expect(extraWords("agence seo lyon", "Agence web Lyon")).toEqual(["seo"]);
  });

  it("does not suggest a car keyword on a motorcycle page", () => {
    const out = missingTrackedKeywords(
      "https://example.com/motos/honda-cbr",
      "Honda CBR 500",
      ["voiture occasion", "assurance auto", "moto honda"],
    );
    expect(out).toEqual(["moto honda"]);
  });

  it("returns nothing when no tracked keyword matches the page", () => {
    const out = missingTrackedKeywords(
      "https://example.com/motos/honda-cbr",
      "Honda CBR 500",
      ["voiture occasion", "assurance auto"],
    );
    expect(out).toEqual([]);
  });

  it("builds a paste-ready AI prompt with only the new title as output", () => {
    const prompt = titleRewritePrompt({
      lang: "fr",
      url: "https://example.com/audit",
      title: "Agence web Lyon",
      keywords: ["agence seo lyon"],
    });
    expect(prompt).toContain("Agence web Lyon");
    expect(prompt).toContain("agence seo lyon");
    expect(prompt).toContain("Réponds uniquement avec le nouveau title.");
  });
});

describe("resolveAuditLang", () => {
  it("prefers html lang over profile", () => {
    expect(
      resolveAuditLang({ htmlLang: "en", profileLang: "fr", uiLang: "fr" }),
    ).toBe("en");
  });
});
