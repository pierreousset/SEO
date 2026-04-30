"use client";
import { useLocale } from "@/components/locale-provider";
import { useRouter } from "next/navigation";

export function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  const router = useRouter();

  function toggle() {
    const next = locale === "en" ? "fr" : "en";
    // Write the cookie synchronously so the next server render sees it.
    // The provider's effect also writes it, but that runs after the render
    // we'd refresh against — write it here too to avoid the race.
    document.cookie = `locale=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    setLocale(next);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors font-semibold text-xs"
      title={locale === "en" ? "Passer en français" : "Switch to English"}
    >
      {locale === "en" ? "FR" : "EN"}
    </button>
  );
}
