@AGENTS.md

## i18n — per-page co-located locale files

Every dashboard page that has user-facing text owns a `locale.ts` next to its
`page.tsx`. Server components read the user's locale from a cookie and pick the
matching dictionary.

### File layout

```
app/dashboard/<page>/
  page.tsx
  locale.ts
```

### `locale.ts` shape

```ts
const fr = {
  title: "Mots-clés",
  subtitle: "Suivi des positions",
  // Functions for interpolated strings (better than string concat).
  countKeywords: (n: number) => `${n} mots-clés suivis`,
};

// Forces en to match fr's shape exactly — TypeScript fails the build on drift.
const en: typeof fr = {
  title: "Keywords",
  subtitle: "Rank tracking",
  countKeywords: (n: number) => `${n} keywords tracked`,
};

export const locale = { fr, en };
export type PageLocale = typeof fr;
```

### Page usage (server component)

```tsx
import { getLocale } from "@/lib/i18n-server";
import { locale } from "./locale";

export default async function Page() {
  const lng = await getLocale();
  const i = locale[lng];
  // Use `t` for tenantDb if needed — `i` is the locale.

  return <h1>{i.title}</h1>;
}
```

### Rules

- Lowercase mono labels stay lowercase in both languages (DESIGN.md rule).
- Use functions like `(n: number) => string` for any string with a number,
  count, name, or path — never concat in JSX.
- Do NOT add a top-level `lib/i18n.ts` key for page-specific strings. It's the
  central dict for shared things (nav, common actions, billing, errors).
- The reference example is `app/dashboard/locale.ts` + `app/dashboard/page.tsx`.

### Adding a new string

1. Add the key to both `fr` and `en` in the page's `locale.ts`. TypeScript
   will fail until both are present.
2. Reference it in JSX as `i.<key>`.
3. No need to register anywhere — the file is imported directly by the page.

## Design

See `DESIGN.md`. Dark bento, lowercase mono labels, no shadows, rounded-2xl.
