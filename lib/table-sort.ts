// Generic SSR table sort. Reads `sort` + `dir` from search params, applies a
// per-field extractor, returns sorted rows. Null values always sort last.

export type SortDir = "asc" | "desc";

export function parseSort(
  sp: Record<string, string | string[] | undefined>,
  defaultField: string | null = null,
  defaultDir: SortDir = "desc",
): { field: string | null; dir: SortDir } {
  const rawField = typeof sp.sort === "string" ? sp.sort : null;
  const rawDir = typeof sp.dir === "string" ? sp.dir : null;
  return {
    field: rawField ?? defaultField,
    dir: rawDir === "asc" || rawDir === "desc" ? rawDir : defaultDir,
  };
}

export function sortRows<T>(
  rows: T[],
  field: string | null,
  dir: SortDir,
  extractors: Record<string, (r: T) => string | number | null | undefined>,
): T[] {
  if (!field || !extractors[field]) return rows;
  const get = extractors[field];
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = get(a);
    const bv = get(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulls last
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return sign * (av - bv);
    return sign * String(av).localeCompare(String(bv));
  });
}
