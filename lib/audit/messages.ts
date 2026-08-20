export type AuditLang = "fr" | "en";

export type FindingVars = {
  n?: number;
  n2?: number;
  pct?: number;
  kb?: string;
  ms?: number;
  status?: number;
  missing?: string;
};

type Copy = {
  message: string | ((v: FindingVars) => string);
  fix: string | ((v: FindingVars) => string);
  detail?: string | ((v: FindingVars) => string);
  impact?: string | ((v: FindingVars) => string);
};

const fr = {
  title_missing: {
    message: "Balise <title> manquante",
    fix: "Ajoutez un title unique de 30 à 60 caractères qui décrit la page.",
    impact: "Ajouter des titres pourrait améliorer la visibilité des pages concernées",
  },
  title_short: {
    message: (v) => `Title trop court (${v.n ?? 0} caractères)`,
    fix: "Allongez à 30–60 caractères avec le mot-clé principal et un bénéfice.",
  },
  title_long: {
    message: (v) => `Title trop long (${v.n ?? 0} caractères), Google tronque`,
    fix: "Coupez à 50–60 caractères. Placez le mot-clé au début.",
  },
  title_no_keyword: {
    message: "Le title ne contient aucun de vos mots-clés suivis",
    fix: (v) =>
      v.missing
        ? `Ajoutez par exemple « ${v.missing.split(",")[0]!.trim()} » dans le title.`
        : "Incluez au moins un mot-clé suivi (ou une variante proche) dans le title.",
  },
  meta_missing: {
    message: "Meta description manquante",
    fix: "Ajoutez une meta description de 120 à 160 caractères, avec une promesse claire et un CTA.",
    impact: "Les meta descriptions améliorent le CTR de 5 à 10%",
  },
  meta_short: {
    message: (v) => `Meta description trop courte (${v.n ?? 0} caractères)`,
    fix: "Allongez à 120–160 caractères avec des mots-clés et un bénéfice clair.",
  },
  meta_long: {
    message: (v) => `Meta description trop longue (${v.n ?? 0} caractères), Google tronque`,
    fix: "Coupez à 150–160 caractères.",
  },
  h1_missing: {
    message: "H1 manquant",
    fix: "Ajoutez exactement un H1 en haut de page, qui dit de quoi elle parle.",
    impact: "Des H1 manquants nuisent à la hiérarchie du contenu et à la crawlabilité",
  },
  h1_multiple: {
    message: (v) => `${v.n ?? 0} balises H1 — il n'en faut qu'une`,
    fix: "Transformez les H1 en trop en H2/H3. Gardez un seul H1.",
  },
  h1_empty: {
    message: "Le H1 est vide",
    fix: "Mettez un texte descriptif dans le H1.",
  },
  canonical_missing: {
    message: "Lien canonical manquant",
    fix: 'Ajoutez <link rel="canonical" href="..."> vers l\'URL canonique.',
    impact: "Les canonicals évitent les pénalités pour contenu dupliqué",
  },
  robots_noindex: {
    message: "La page est en noindex",
    fix: "Retirez le noindex si vous voulez que Google indexe cette page.",
  },
  og_incomplete: {
    message: "Balises Open Graph incomplètes",
    detail: (v) => `Manque : ${v.missing ?? ""}`,
    fix: "Ajoutez og:title, og:description et og:image pour un aperçu propre au partage.",
    impact: "Les balises Open Graph améliorent le rendu sur les réseaux sociaux",
  },
  schema_missing: {
    message: "Pas de balisage schema.org dans le HTML initial",
    detail:
      "JSON-LD, microdata et RDFa absents de la réponse SSR. Si le schema est injecté en JavaScript ou via un tag manager, notre crawler ne le voit pas — Google, oui.",
    fix: "Ajoutez du JSON-LD LocalBusiness / Organization / Article / Product / BreadcrumbList côté serveur. Vérifiez avec le test des résultats enrichis Google.",
    impact: "Les données structurées activent les rich snippets dans les SERP",
  },
  alt_missing: {
    message: (v) =>
      `${v.n ?? 0}/${v.n2 ?? 0} images sans texte alt (${v.pct ?? 0}%)`,
    fix: 'Ajoutez un alt descriptif à chaque image utile. Images déco : alt="".',
    impact: "Le texte alt améliore la visibilité en image search et l'accessibilité",
  },
  low_internal_links: {
    message: (v) => `Seulement ${v.n ?? 0} liens internes sur cette page`,
    fix: "Ajoutez 5 à 15 liens internes contextuels vers des pages liées. Ça aide le crawl et le ranking.",
  },
  thin_content: {
    message: (v) => `Contenu trop mince : seulement ${v.n ?? 0} mots`,
    fix: "Visez au moins 300 mots de contenu utile. 600–1200 est le bon intervalle.",
  },
  bad_status: {
    message: (v) => `La page renvoie HTTP ${v.status ?? 0}`,
    fix: "Corrigez l'erreur ou redirigez vers une page qui fonctionne.",
  },
  heavy_html: {
    message: (v) => `HTML trop lourd (${v.kb ?? "0"} Ko)`,
    fix: "Réduisez les scripts/styles inline, différer le JS non critique, lazy-load des images.",
  },
  slow_response: {
    message: (v) => `Réponse serveur lente (${v.ms ?? 0} ms)`,
    fix: "Visez <500 ms de TTFB. Regardez le serveur d'origine, le cache et le middleware.",
  },
  no_https: {
    message: "Le site n'est pas servi en HTTPS",
    fix: "Passez en HTTPS. Google favorise HTTPS et les navigateurs affichent un avertissement en HTTP.",
  },
  robots_missing: {
    message: "robots.txt introuvable",
    fix: "Ajoutez un robots.txt à la racine, avec le sitemap et les chemins à bloquer.",
  },
  robots_no_sitemap: {
    message: "robots.txt ne déclare pas de sitemap",
    fix: "Ajoutez une ligne Sitemap: vers votre sitemap.xml dans robots.txt.",
  },
  robots_unreachable: {
    message: "robots.txt injoignable",
    fix: "Vérifiez que /robots.txt répond en 200.",
  },
  sitemap_missing: {
    message: "sitemap.xml introuvable",
    fix: "Générez un sitemap.xml de toutes les URL indexables et soumettez-le dans Search Console.",
  },
  sitemap_unreachable: {
    message: "sitemap.xml injoignable",
    fix: "Faites en sorte que /sitemap.xml réponde en 200.",
  },
  fetch_failed: {
    message: "Impossible de récupérer la page",
    fix: "Vérifiez que l'URL est joignable et non bloquée par un pare-feu.",
  },
} satisfies Record<string, Copy>;

const en: { [K in keyof typeof fr]: Copy } = {
  title_missing: {
    message: "Missing <title> tag",
    fix: "Add a unique title tag describing the page in 30-60 characters.",
    impact: "Adding titles could improve visibility for affected pages",
  },
  title_short: {
    message: (v) => `Title too short (${v.n ?? 0} chars)`,
    fix: "Expand to 30-60 chars with the primary keyword and a benefit.",
  },
  title_long: {
    message: (v) => `Title too long (${v.n ?? 0} chars). Google truncates`,
    fix: "Trim to 50-60 chars. Front-load the keyword.",
  },
  title_no_keyword: {
    message: "Title contains none of your tracked keywords",
    fix: (v) =>
      v.missing
        ? `Add "${v.missing.split(",")[0]!.trim()}" to the title, for example.`
        : "Include at least one tracked keyword (or a close variant) in the title.",
  },
  meta_missing: {
    message: "Missing meta description",
    fix: "Add a 120-160 character meta description with a clear value prop and CTA.",
    impact: "Meta descriptions improve CTR by 5-10%",
  },
  meta_short: {
    message: (v) => `Meta description short (${v.n ?? 0} chars)`,
    fix: "Expand to 120-160 chars with keywords + a clear benefit.",
  },
  meta_long: {
    message: (v) => `Meta description long (${v.n ?? 0} chars). Google truncates`,
    fix: "Trim to 150-160 chars.",
  },
  h1_missing: {
    message: "Missing H1",
    fix: "Add exactly one H1 at the top of the page describing what it's about.",
    impact: "Missing H1 tags hurt content hierarchy and crawlability",
  },
  h1_multiple: {
    message: (v) => `${v.n ?? 0} H1 tags — should be exactly 1`,
    fix: "Convert extra H1s to H2/H3. Keep one H1 only.",
  },
  h1_empty: {
    message: "H1 is empty",
    fix: "Put descriptive content in the H1.",
  },
  canonical_missing: {
    message: "Missing canonical link",
    fix: 'Add <link rel="canonical" href="..."> pointing to the canonical URL.',
    impact: "Canonicals prevent duplicate content penalties",
  },
  robots_noindex: {
    message: "Page is set to noindex",
    fix: "Remove the noindex directive if you want this page in Google.",
  },
  og_incomplete: {
    message: "Open Graph tags incomplete",
    detail: (v) => `Missing: ${v.missing ?? ""}`,
    fix: "Add all three OG tags so social shares render with a preview card.",
    impact: "Open Graph tags improve social media sharing appearance",
  },
  schema_missing: {
    message: "No schema.org markup detected in initial HTML",
    detail:
      "Checked JSON-LD, microdata, and RDFa in the SSR response. If you inject schema via client-side JavaScript or a tag manager, our crawler can't see it, but Google can.",
    fix: "Add LocalBusiness/Organization/Article/Product/BreadcrumbList JSON-LD server-side. Verify with Google Rich Results Test.",
    impact: "Structured data enables rich snippets in SERPs",
  },
  alt_missing: {
    message: (v) =>
      `${v.n ?? 0}/${v.n2 ?? 0} images missing alt text (${v.pct ?? 0}%)`,
    fix: 'Add descriptive alt to every meaningful image. Decorative images: alt="".',
    impact: "Alt text improves image search visibility and accessibility",
  },
  low_internal_links: {
    message: (v) => `Only ${v.n ?? 0} internal links on this page`,
    fix: "Add 5-15 contextual internal links to related pages. Helps crawl + ranking.",
  },
  thin_content: {
    message: (v) => `Thin content: only ${v.n ?? 0} words`,
    fix: "Add at least 300 words of substantive content. 600-1200 is the sweet spot.",
  },
  bad_status: {
    message: (v) => `Page returns HTTP ${v.status ?? 0}`,
    fix: "Fix the underlying error or redirect to a working page.",
  },
  heavy_html: {
    message: (v) => `HTML is ${v.kb ?? "0"} KB, heavy`,
    fix: "Reduce inline scripts/styles, defer non-critical JS, lazy-load images.",
  },
  slow_response: {
    message: (v) => `Server response slow (${v.ms ?? 0}ms)`,
    fix: "Aim for <500ms TTFB. Check origin server, cache, and middleware.",
  },
  no_https: {
    message: "Site is not served over HTTPS",
    fix: "Move to HTTPS. Google ranks HTTPS pages higher and modern browsers warn on HTTP.",
  },
  robots_missing: {
    message: "robots.txt not found",
    fix: "Add a robots.txt at site root listing your sitemap and any disallowed paths.",
  },
  robots_no_sitemap: {
    message: "robots.txt does not declare a sitemap",
    fix: "Add a Sitemap: line pointing to your sitemap.xml in robots.txt.",
  },
  robots_unreachable: {
    message: "robots.txt unreachable",
    fix: "Check that /robots.txt returns a 200 response.",
  },
  sitemap_missing: {
    message: "sitemap.xml not found",
    fix: "Generate a sitemap.xml listing all indexable URLs and submit to GSC.",
  },
  sitemap_unreachable: {
    message: "sitemap.xml unreachable",
    fix: "Make /sitemap.xml return a 200 response.",
  },
  fetch_failed: {
    message: "Failed to fetch page",
    fix: "Check that the URL is reachable and not blocked by your firewall.",
  },
};

const dict = { fr, en };

function render(part: Copy[keyof Copy], vars: FindingVars): string | undefined {
  if (part == null) return undefined;
  return typeof part === "function" ? part(vars) : part;
}

export function auditCopy(
  checkKey: string,
  lang: AuditLang,
  vars: FindingVars = {},
): { message: string; fix: string; detail?: string; impact?: string } | null {
  const entry = dict[lang][checkKey as keyof typeof fr] as Copy | undefined;
  if (!entry) return null;
  return {
    message: render(entry.message, vars) ?? "",
    fix: render(entry.fix, vars) ?? "",
    detail: render(entry.detail, vars),
    impact: render(entry.impact, vars),
  };
}

/** Read lang from html[lang] or /fr/ /en/ in the URL. */
export function detectPageLang(html: string, url?: string): AuditLang | null {
  const fromAttr = html.match(/<html\b[^>]*\slang=["']?([a-zA-Z-]+)/i)?.[1]?.toLowerCase();
  if (fromAttr?.startsWith("fr")) return "fr";
  if (fromAttr?.startsWith("en")) return "en";
  if (url) {
    if (/\/fr(\/|$|\?)/i.test(url)) return "fr";
    if (/\/en(\/|$|\?)/i.test(url)) return "en";
  }
  return null;
}

export function inferLangFromUrls(urls: string[]): AuditLang | null {
  let frN = 0;
  let enN = 0;
  for (const u of urls) {
    if (/\/fr(\/|$|\?)/i.test(u)) frN++;
    if (/\/en(\/|$|\?)/i.test(u)) enN++;
  }
  if (frN === 0 && enN === 0) return null;
  return frN >= enN ? "fr" : "en";
}

export function resolveAuditLang(opts: {
  htmlLang?: AuditLang | null;
  urls?: string[];
  profileLang?: string | null;
  uiLang?: AuditLang;
}): AuditLang {
  if (opts.htmlLang === "fr" || opts.htmlLang === "en") return opts.htmlLang;
  const fromUrls = opts.urls?.length ? inferLangFromUrls(opts.urls) : null;
  if (fromUrls) return fromUrls;
  if (opts.profileLang === "en" || opts.profileLang === "fr") return opts.profileLang;
  return opts.uiLang ?? "fr";
}

export function varsFromFinding(f: {
  checkKey: string;
  message: string;
  detail?: string | null;
}): FindingVars {
  const blob = `${f.message} ${f.detail ?? ""}`;
  const vars: FindingVars = {};
  const chars = blob.match(/\((\d+)\s*(?:chars|caractères)\)/i);
  if (chars) vars.n = Number(chars[1]);
  const alt = blob.match(/(\d+)\s*\/\s*(\d+).+?\((\d+)\s*%\)/);
  if (alt) {
    vars.n = Number(alt[1]);
    vars.n2 = Number(alt[2]);
    vars.pct = Number(alt[3]);
  }
  const links = blob.match(/(?:Only|Seulement)\s+(\d+)/i);
  if (links) vars.n = Number(links[1]);
  const words = blob.match(/(\d+)\s*(?:words|mots)/i);
  if (words) vars.n = Number(words[1]);
  const h1n = blob.match(/^(\d+)\s*(?:<h1>|balises H1|H1)/i);
  if (h1n) vars.n = Number(h1n[1]);
  const status = blob.match(/HTTP\s+(\d+)/i);
  if (status) vars.status = Number(status[1]);
  const kb = blob.match(/\((\d+)\s*K[oB]\)/i);
  if (kb) vars.kb = kb[1];
  const ms = blob.match(/\((\d+)\s*ms\)/i);
  if (ms) vars.ms = Number(ms[1]);
  const missing = (f.detail ?? "").replace(/^(Missing:|Manque\s*:)\s*/i, "").trim();
  if (missing && f.checkKey === "og_incomplete") vars.missing = missing;
  return vars;
}

export function localizeFinding<T extends { checkKey: string; message: string; detail?: string | null; fix?: string | null }>(
  f: T,
  lang: AuditLang,
): T {
  const copy = auditCopy(f.checkKey, lang, varsFromFinding(f));
  if (!copy) return f;
  return {
    ...f,
    message: copy.message,
    fix: copy.fix,
    detail: copy.detail ?? f.detail,
  };
}
