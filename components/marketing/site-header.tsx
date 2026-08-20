import { LocaleToggle } from "@/components/locale-toggle";
import { BrandMark } from "@/components/brand-mark";
import type { PageLocale } from "@/app/locale";

export function SiteHeader({
  i,
  variant = "marketing",
}: {
  i: PageLocale;
  variant?: "marketing" | "legal";
}) {
  return (
    <header className="w-full border-b border-hairline">
      <div className="w-full max-w-[1280px] mx-auto px-5 sm:px-8 md:px-10 py-6 flex items-center justify-between gap-3">
        <BrandMark href="/" />
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {variant === "marketing" && (
          <>
            <a
              href="#how"
              className="hidden md:inline-flex text-sm text-ash-gray hover:text-ink-black px-3 py-2"
            >
              {i.nav.how}
            </a>
            <a
              href="#pricing"
              className="hidden sm:inline-flex text-sm text-ash-gray hover:text-ink-black px-3 py-2"
            >
              {i.nav.pricing}
            </a>
          </>
        )}
        <LocaleToggle />
        <a
          href={variant === "marketing" ? "#get-started" : "/#get-started"}
          className="inline-flex items-center justify-center h-9 px-4 rounded-full bg-button-black text-canvas-white text-sm shadow-button"
        >
          {i.nav.cta}
        </a>
        </div>
      </div>
    </header>
  );
}
