import type { AuditLang } from "@/lib/audit/messages";

export type InspectHint = {
  selector: string;
  snippet: string;
  hint: string;
  tool?: { label: string; href: (url: string) => string };
};

const HINT: Record<
  string,
  {
    selector: string;
    snippet: string;
    hint: { fr: string; en: string };
    tool?: { label: { fr: string; en: string }; href: (url: string) => string };
  }
> = {
  title_missing: {
    selector: "head > title",
    snippet: `<head>\n  <title>  ← absent\n</head>`,
    hint: {
      fr: "Clic droit → Inspecter. Dans <head>, cherche la balise title.",
      en: "Right-click → Inspect. In <head>, look for the title tag.",
    },
  },
  title_short: {
    selector: "head > title",
    snippet: `<head>\n  <title>…</title>  ← trop court\n</head>`,
    hint: {
      fr: "Clic droit → Inspecter. Le title est dans <head>.",
      en: "Right-click → Inspect. The title lives in <head>.",
    },
  },
  title_long: {
    selector: "head > title",
    snippet: `<head>\n  <title>…</title>  ← trop long\n</head>`,
    hint: {
      fr: "Clic droit → Inspecter. Le title est dans <head>.",
      en: "Right-click → Inspect. The title lives in <head>.",
    },
  },
  title_no_keyword: {
    selector: "head > title",
    snippet: `<head>\n  <title>…</title>  ← mot-clé absent\n</head>`,
    hint: {
      fr: "Clic droit → Inspecter. Compare le title aux mots-clés suivis.",
      en: "Right-click → Inspect. Compare the title to your tracked keywords.",
    },
  },
  meta_missing: {
    selector: 'meta[name="description"]',
    snippet: `<head>\n  <meta name="description">  ← absent\n</head>`,
    hint: {
      fr: "Clic droit → Inspecter. Dans <head>, cherche meta name=\"description\".",
      en: "Right-click → Inspect. In <head>, look for meta name=\"description\".",
    },
  },
  meta_short: {
    selector: 'meta[name="description"]',
    snippet: `<head>\n  <meta name="description" content="…">  ← trop court\n</head>`,
    hint: {
      fr: "Clic droit → Inspecter. La meta description est dans <head>.",
      en: "Right-click → Inspect. The meta description is in <head>.",
    },
  },
  meta_long: {
    selector: 'meta[name="description"]',
    snippet: `<head>\n  <meta name="description" content="…">  ← trop long\n</head>`,
    hint: {
      fr: "Clic droit → Inspecter. La meta description est dans <head>.",
      en: "Right-click → Inspect. The meta description is in <head>.",
    },
  },
  h1_missing: {
    selector: "h1",
    snippet: `<body>\n  <h1>  ← absent\n</body>`,
    hint: {
      fr: "Clic droit → Inspecter. Dans le body, il n'y a pas de h1.",
      en: "Right-click → Inspect. There is no h1 in the body.",
    },
  },
  h1_multiple: {
    selector: "h1",
    snippet: `<body>\n  <h1>…</h1>\n  <h1>…</h1>  ← en trop\n</body>`,
    hint: {
      fr: "Clic droit → Inspecter, Cmd+F (Ctrl+F) puis tape h1. Il doit n'y en avoir qu'un.",
      en: "Right-click → Inspect, Cmd+F (Ctrl+F), type h1. There should be only one.",
    },
  },
  h1_empty: {
    selector: "h1",
    snippet: `<body>\n  <h1></h1>  ← vide\n</body>`,
    hint: {
      fr: "Clic droit → Inspecter. Le h1 existe mais n'a pas de texte.",
      en: "Right-click → Inspect. The h1 exists but has no text.",
    },
  },
  canonical_missing: {
    selector: 'link[rel="canonical"]',
    snippet: `<head>\n  <link rel="canonical">  ← absent\n</head>`,
    hint: {
      fr: "Clic droit → Inspecter. Dans <head>, cherche link rel=\"canonical\".",
      en: "Right-click → Inspect. In <head>, look for link rel=\"canonical\".",
    },
  },
  robots_noindex: {
    selector: 'meta[name="robots"]',
    snippet: `<head>\n  <meta name="robots" content="noindex">  ← bloque l'index\n</head>`,
    hint: {
      fr: "Clic droit → Inspecter. Dans <head>, cherche meta name=\"robots\".",
      en: "Right-click → Inspect. In <head>, look for meta name=\"robots\".",
    },
  },
  og_incomplete: {
    selector: 'meta[property^="og:"]',
    snippet: `<head>\n  <meta property="og:title">\n  <meta property="og:description">\n  <meta property="og:image">  ← incomplet\n</head>`,
    hint: {
      fr: "Clic droit → Inspecter. Dans <head>, cherche les meta property=\"og:…\".",
      en: "Right-click → Inspect. In <head>, look for meta property=\"og:…\".",
    },
  },
  schema_missing: {
    selector: 'script[type="application/ld+json"]',
    snippet: `<head>\n  <script type="application/ld+json">  ← absent\n</head>`,
    hint: {
      fr: "Clic droit → Inspecter. Cherche un script type=\"application/ld+json\".",
      en: "Right-click → Inspect. Look for a script type=\"application/ld+json\".",
    },
    tool: {
      label: { fr: "Test résultats enrichis", en: "Rich results test" },
      href: (url) => `https://search.google.com/test/rich-results?url=${encodeURIComponent(url)}`,
    },
  },
  alt_missing: {
    selector: "img:not([alt]), img[alt=\"\"]",
    snippet: `<img src="…" >  ← sans alt`,
    hint: {
      fr: "Clic droit sur une image → Inspecter. L'attribut alt doit être renseigné.",
      en: "Right-click an image → Inspect. The alt attribute should be set.",
    },
  },
  low_internal_links: {
    selector: "a[href]",
    snippet: `<a href="/page">  ← trop peu de liens internes`,
    hint: {
      fr: "Clic droit → Inspecter, Cmd+F puis a[href]. Compte les liens vers ton propre domaine.",
      en: "Right-click → Inspect, Cmd+F then a[href]. Count links to your own domain.",
    },
  },
  thin_content: {
    selector: "body",
    snippet: `<body>\n  …  ← trop peu de texte\n</body>`,
    hint: {
      fr: "Ouvre la page et regarde le contenu visible. L'inspecteur montre le texte dans body.",
      en: "Open the page and look at the visible copy. The inspector shows text in body.",
    },
  },
  bad_status: {
    selector: "network",
    snippet: `HTTP status  ← erreur`,
    hint: {
      fr: "Ouvre l'onglet Réseau de l'inspecteur, recharge, et lis le code de la requête document.",
      en: "Open the Network tab, reload, and read the document request status.",
    },
  },
  heavy_html: {
    selector: "document",
    snippet: `document  ← HTML trop lourd`,
    hint: {
      fr: "Inspecteur → Réseau → la requête HTML. Regarde la taille.",
      en: "Inspector → Network → the HTML request. Check the size.",
    },
    tool: {
      label: { fr: "PageSpeed", en: "PageSpeed" },
      href: (url) => `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}`,
    },
  },
  slow_response: {
    selector: "TTFB",
    snippet: `TTFB  ← trop lent`,
    hint: {
      fr: "Inspecteur → Réseau → Timing de la requête document (TTFB).",
      en: "Inspector → Network → Timing on the document request (TTFB).",
    },
    tool: {
      label: { fr: "PageSpeed", en: "PageSpeed" },
      href: (url) => `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}`,
    },
  },
  no_https: {
    selector: "location.protocol",
    snippet: `http://  ← pas https`,
    hint: {
      fr: "Regarde la barre d'adresse : le cadenas doit être présent.",
      en: "Look at the address bar: the lock icon should be there.",
    },
  },
  robots_missing: {
    selector: "/robots.txt",
    snippet: `/robots.txt  ← 404`,
    hint: {
      fr: "Ouvre /robots.txt sur le domaine. La page doit exister.",
      en: "Open /robots.txt on the domain. The file should exist.",
    },
  },
  robots_no_sitemap: {
    selector: "/robots.txt",
    snippet: `Sitemap: https://…/sitemap.xml  ← absent`,
    hint: {
      fr: "Ouvre /robots.txt et cherche une ligne Sitemap.",
      en: "Open /robots.txt and look for a Sitemap line.",
    },
  },
  robots_unreachable: {
    selector: "/robots.txt",
    snippet: `/robots.txt  ← injoignable`,
    hint: {
      fr: "Ouvre /robots.txt. S'il ne charge pas, le fichier ou le serveur bloque.",
      en: "Open /robots.txt. If it does not load, the file or the server is blocking it.",
    },
  },
  sitemap_missing: {
    selector: "/sitemap.xml",
    snippet: `/sitemap.xml  ← 404`,
    hint: {
      fr: "Ouvre /sitemap.xml sur le domaine.",
      en: "Open /sitemap.xml on the domain.",
    },
  },
  sitemap_unreachable: {
    selector: "/sitemap.xml",
    snippet: `/sitemap.xml  ← injoignable`,
    hint: {
      fr: "Ouvre /sitemap.xml. S'il ne charge pas, le fichier ou le serveur bloque.",
      en: "Open /sitemap.xml. If it does not load, the file or the server is blocking it.",
    },
  },
  fetch_failed: {
    selector: "document",
    snippet: `fetch  ← échec`,
    hint: {
      fr: "Ouvre le lien. Si la page ne charge pas, le crawler n'a pas pu l'analyser.",
      en: "Open the link. If the page does not load, the crawler could not analyze it.",
    },
  },
};

export function inspectHint(checkKey: string, lang: AuditLang, url: string): InspectHint | null {
  const row = HINT[checkKey];
  if (!row) return null;
  return {
    selector: row.selector,
    snippet: row.snippet,
    hint: row.hint[lang],
    tool: row.tool
      ? { label: row.tool.label[lang], href: row.tool.href(url) }
      : undefined,
  };
}
