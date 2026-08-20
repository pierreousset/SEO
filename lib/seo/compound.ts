/** Future value of a monthly contribution at an annual rate, over whole years. */

export type CompoundPoint = {
  year: number;
  contributed: number;
  growth: number;
  total: number;
};

export type CompoundSeries = {
  points: CompoundPoint[];
  crossoverYear: number | null;
};

export function yearTotal(monthly: number, annualRate: number, year: number): number {
  if (year <= 0) return 0;
  const months = year * 12;
  if (annualRate <= 0) return monthly * months;
  const r = annualRate / 12;
  return monthly * ((Math.pow(1 + r, months) - 1) / r);
}

export function compoundSeries(
  monthly: number,
  annualRate: number,
  years: number,
): CompoundSeries {
  const points: CompoundPoint[] = [];
  let crossoverYear: number | null = null;

  for (let year = 1; year <= years; year++) {
    const contributed = monthly * year * 12;
    const total = yearTotal(monthly, annualRate, year);
    const growth = Math.max(0, total - contributed);
    points.push({ year, contributed, growth, total });
    if (crossoverYear === null && growth > contributed) crossoverYear = year;
  }

  return { points, crossoverYear };
}
