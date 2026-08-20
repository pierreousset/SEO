"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";
import { locale } from "@/app/locale";
import { compoundSeries } from "@/lib/seo/compound";

const RATES = [4, 7, 10] as const;
const HORIZONS = [20, 30, 40] as const;
const MONTHLY_MIN = 50;
const MONTHLY_MAX = 400;
const CONTRIBUTED = "#5b87d6";
const GROWTH = "#3dbe78";

type Props = {
  lng: "fr" | "en";
};

function formatCount(n: number, lng: "fr" | "en") {
  return new Intl.NumberFormat(lng === "fr" ? "fr-FR" : "en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function CompoundWidget({ lng }: Props) {
  const i = locale[lng].compound;
  const [monthly, setMonthly] = useState(200);
  const [rate, setRate] = useState<(typeof RATES)[number]>(10);
  const [years, setYears] = useState<(typeof HORIZONS)[number]>(40);
  const [currentYear, setCurrentYear] = useState(40);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number>(0);

  const series = useMemo(
    () => compoundSeries(monthly, rate / 100, years),
    [monthly, rate, years],
  );

  const visible = series.points[Math.min(currentYear, years) - 1] ?? series.points[0];
  const maxTotal = series.points[series.points.length - 1]?.total ?? 1;
  const contribFloor = ((series.points[series.points.length - 1]?.contributed ?? 0) / maxTotal) * 100;
  const sliderPct = ((monthly - MONTHLY_MIN) / (MONTHLY_MAX - MONTHLY_MIN)) * 100;
  const crossover = series.crossoverYear;

  useEffect(() => {
    setPlaying(false);
    setCurrentYear(years);
  }, [monthly, rate, years]);

  useEffect(() => {
    if (!playing) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCurrentYear(years);
      setPlaying(false);
      return;
    }
    const start = performance.now();
    const duration = Math.max(1100, years * 36);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setCurrentYear(Math.max(1, Math.round(1 + (years - 1) * eased)));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    setCurrentYear(1);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, years]);

  function play() {
    if (playing) {
      cancelAnimationFrame(raf.current);
      setPlaying(false);
      return;
    }
    setPlaying(true);
  }

  const markerLeft =
    crossover != null ? ((crossover - 0.5) / years) * 100 : 0;

  return (
    <div className="sheet px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-body font-medium text-ink-black">{i.widgetTitle}</h3>
        <p className="text-caption text-ash-gray rounded-full bg-subtle-cream px-2.5 py-1 shrink-0">
          {i.yearOf(currentYear, years)}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-caption text-ash-gray">{i.endBalance}</p>
          <p className="mt-1 font-semibold tabular-nums text-ink-black leading-none tracking-[-0.04em] text-[clamp(2rem,5vw,2.75rem)]">
            {formatCount(visible.total, lng)}
          </p>
        </div>
        <ul className="flex flex-col gap-1.5 text-caption sm:items-end">
          <li className="flex items-center gap-2 text-deep-slate">
            <span className="size-2 rounded-full" style={{ background: CONTRIBUTED }} />
            {i.contributed}
            <span className="tabular-nums text-ink-black font-medium">
              {formatCount(visible.contributed, lng)}
            </span>
          </li>
          <li className="flex items-center gap-2 text-deep-slate">
            <span className="size-2 rounded-full" style={{ background: GROWTH }} />
            {i.growth}
            <span className="tabular-nums text-ink-black font-medium">
              {formatCount(visible.growth, lng)}
            </span>
          </li>
        </ul>
      </div>

      <div className="relative mt-6 h-[200px] sm:h-[220px]">
        <div
          className="absolute left-0 right-0 border-t border-dashed"
          style={{
            bottom: `${contribFloor}%`,
            borderColor: `${CONTRIBUTED}99`,
          }}
        />
        <div className="absolute inset-0 flex items-end gap-[2px] sm:gap-[3px]">
          {series.points.map((p) => {
            const h = Math.max(1.2, (p.total / maxTotal) * 100);
            const growthShare = p.total > 0 ? (p.growth / p.total) * 100 : 0;
            const on = p.year <= currentYear;
            return (
              <div
                key={p.year}
                className="relative flex-1 h-full flex items-end"
                style={{ opacity: on ? 1 : 0.14 }}
              >
                <div
                  className="w-full overflow-hidden rounded-t-[3px] flex flex-col justify-end"
                  style={{ height: `${h}%` }}
                >
                  <div className="w-full" style={{ height: `${growthShare}%`, background: GROWTH }} />
                  <div
                    className="w-full"
                    style={{ height: `${Math.max(4, 100 - growthShare)}%`, background: CONTRIBUTED }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {crossover != null && crossover <= currentYear ? (
          <>
            <div
              className="absolute top-2 bottom-0 w-px border-l border-dashed border-vivid-violet pointer-events-none"
              style={{ left: `${markerLeft}%` }}
            />
            <span
              className="absolute top-1 size-2 rounded-full bg-vivid-violet pointer-events-none"
              style={{ left: `${markerLeft}%`, transform: "translateX(-50%)" }}
            />
          </>
        ) : null}
      </div>
      {crossover != null && crossover <= currentYear ? (
        <p className="mt-3 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-vivid-violet/10 text-vivid-violet text-caption px-2.5 py-1">
            <span className="size-1.5 rounded-full bg-vivid-violet" />
            {i.crossover(crossover)}
          </span>
        </p>
      ) : (
        <div className="mt-3 h-[22px]" />
      )}

      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="compound-monthly" className="text-caption text-ash-gray">
            {i.monthly}
          </label>
          <p className="text-body-sm font-medium tabular-nums text-ink-black">
            {i.perMonth(monthly)}
          </p>
        </div>
        <input
          id="compound-monthly"
          className="compound-slider mt-3 w-full"
          type="range"
          min={MONTHLY_MIN}
          max={MONTHLY_MAX}
          step={50}
          value={monthly}
          onChange={(e) => setMonthly(Number(e.target.value))}
          style={{ ["--compound-pct" as string]: `${sliderPct}%` }}
        />
      </div>

      <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <PillGroup
          label={i.returnLabel}
          value={rate}
          options={RATES.map((n) => ({ value: n, label: i.rate(n) }))}
          onChange={setRate}
        />
        <PillGroup
          label={i.horizonLabel}
          value={years}
          options={HORIZONS.map((n) => ({ value: n, label: i.yearsShort(n) }))}
          onChange={setYears}
        />
      </div>

      <div className="mt-7 flex items-center justify-between gap-3">
        <p className="text-caption text-ash-gray min-w-0 truncate">
          {i.summary(monthly, rate, years)}
        </p>
        <button
          type="button"
          onClick={play}
          className="inline-flex items-center gap-1.5 h-9 pl-3.5 pr-4 rounded-full bg-button-black text-canvas-white text-caption shadow-button shrink-0"
        >
          <Play className="size-3.5" fill="currentColor" strokeWidth={0} />
          {i.play}
        </button>
      </div>
    </div>
  );
}

function PillGroup<T extends number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <p className="text-caption text-ash-gray uppercase tracking-[0.06em] shrink-0">
        {label}
      </p>
      <div className="flex items-center gap-1">
        {options.map((opt) => {
          const on = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(opt.value)}
              className={`h-8 px-3 rounded-full text-caption whitespace-nowrap transition-colors ${
                on
                  ? "bg-ink-black text-canvas-white"
                  : "bg-subtle-cream text-deep-slate hover:text-ink-black"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
