export function LegalArticle({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
}) {
  return (
    <article>
      <p className="text-caption text-ash-gray">{updated}</p>
      <h1 className="text-heading font-semibold text-ink-black mt-2">{title}</h1>
      <div className="mt-10 space-y-8">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-subheading font-semibold text-ink-black">{s.heading}</h2>
            <p className="text-body-sm text-deep-slate mt-2 leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
