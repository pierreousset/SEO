import type { PageLocale } from "@/app/locale";

export function ProductPreview({ i }: { i: PageLocale }) {
  return (
    <figure className="w-full">
      <div className="sheet px-6 py-8 sm:px-9 sm:py-10">
        <p className="font-caveat text-2xl text-ink-black leading-none">{i.preview.kicker}</p>
        <p className="text-caption text-ash-gray mt-7">{i.preview.scoreLabel}</p>
        <p className="mt-1 font-semibold tabular-nums text-ink-black leading-[0.86] tracking-[-0.05em] text-[clamp(4.5rem,8vw,7rem)]">
          {i.preview.score}
        </p>
        <p className="font-caveat text-[1.75rem] text-sky-teal mt-3 leading-tight">
          {i.preview.coach}
        </p>
        <ol className="mt-8">
          {i.preview.items.map((item, idx) => (
            <li key={item.title} className="border-t border-hairline py-4 flex gap-4">
              <span className="text-subheading font-semibold tabular-nums text-ink-black leading-none w-8 shrink-0">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-ink-black">{item.title}</p>
                <p className="text-caption text-ash-gray mt-1">{item.subtitle}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="text-caption text-ash-gray mt-3 px-1">
        {i.preview.footnote}
      </figcaption>
    </figure>
  );
}
