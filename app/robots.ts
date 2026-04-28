import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "https://seo.240company.com";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/dashboard", "/api", "/invite", "/share", "/verify"] },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
