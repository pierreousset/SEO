import { getLocale } from "@/lib/i18n-server";
import { locale } from "@/app/locale";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lng = await getLocale();
  const i = locale[lng];
  return (
    <div className="flex-1 flex flex-col bg-canvas-white">
      <SiteHeader i={i} variant="legal" />
      <div className="flex-1 w-full max-w-[720px] mx-auto px-5 sm:px-8 py-12 md:py-16">
        {children}
      </div>
      <SiteFooter i={i} />
    </div>
  );
}
