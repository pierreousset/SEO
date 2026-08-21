import { getLocale } from "@/lib/i18n-server";
import { locale } from "./locale";
import { DiscoverTabs } from "@/components/discover-tabs";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { listSavedKeywordIdeas } from "@/lib/actions/discover";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const lng = await getLocale();
  const i = locale[lng];
  const saved = await listSavedKeywordIdeas();

  return (
    <div className="px-4 md:px-9 py-7 max-w-[1400px] mx-auto space-y-6">
      <div>
        <Breadcrumbs />
        <h1 className="text-heading-lg mt-2">{i.title}</h1>
        <p className="mt-3 text-base text-muted-foreground max-w-2xl">{i.subtitle}</p>
      </div>

      <DiscoverTabs lng={lng} initialIdeas={saved} />
    </div>
  );
}
