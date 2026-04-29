"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
}>({
  locale: "en",
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved) setLocale(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("locale", locale);
    // Mirror to a cookie so server components can read the user's choice.
    document.cookie = `locale=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
