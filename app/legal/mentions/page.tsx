import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n-server";
import { LegalArticle } from "@/components/marketing/legal-article";
import { locale } from "./locale";

export async function generateMetadata(): Promise<Metadata> {
  const i = locale[await getLocale()];
  return { title: i.title, description: i.sections[0]?.body.slice(0, 155) };
}

export default async function MentionsPage() {
  const i = locale[await getLocale()];
  return <LegalArticle title={i.title} updated={i.updated} sections={i.sections} />;
}
