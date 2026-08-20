import Link from "next/link";
import type { PageLocale } from "@/app/locale";

export function SiteFooter({ i }: { i: PageLocale }) {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full max-w-[1200px] mx-auto px-5 sm:px-8 md:px-10 py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-hairline mt-8">
      <div className="space-y-1">
        <p className="text-sm text-ink-black">{i.footer.tagline}</p>
        <p className="text-caption text-ash-gray">{i.footer.copyright(year)}</p>
      </div>
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ash-gray">
        <Link href="/legal/mentions" className="hover:text-ink-black">
          {i.footer.mentions}
        </Link>
        <Link href="/legal/privacy" className="hover:text-ink-black">
          {i.footer.privacy}
        </Link>
        <Link href="/legal/terms" className="hover:text-ink-black">
          {i.footer.terms}
        </Link>
      </nav>
    </footer>
  );
}
