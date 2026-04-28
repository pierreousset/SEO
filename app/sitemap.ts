import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "https://seo.240company.com";
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/verify`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];
}
