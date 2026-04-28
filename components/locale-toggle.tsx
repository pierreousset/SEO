"use client";
import { useLocale } from "@/components/locale-provider";

export function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <button
      onClick={() => setLocale(locale === "en" ? "fr" : "en")}
      className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors font-semibold text-xs"
      title={locale === "en" ? "Passer en français" : "Switch to English"}
    >
      {locale === "en" ? "FR" : "EN"}
    </button>
  );
}
