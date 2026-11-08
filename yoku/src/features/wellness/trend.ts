import type { ISODate, WellnessEntry, WellnessScoreKey } from "../../db/types";
import { lastNDays } from "../../lib/date";

export type MetricKey = WellnessScoreKey | "sleepHours";

export interface TrendPoint {
  date: ISODate;
  /** 未回答は null(グラフでは線をつながない) */
  value: number | null;
}

export function buildTrend(entries: readonly WellnessEntry[], key: MetricKey, days: number, end?: ISODate): TrendPoint[] {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  return lastNDays(days, end).map((date) => {
    const v = byDate.get(date)?.[key];
    return { date, value: typeof v === "number" ? v : null };
  });
}

export function summarize(points: readonly TrendPoint[]) {
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (vals.length === 0) return { answered: 0, missing: points.length, avg: null as number | null, min: null as number | null, max: null as number | null };
  const sum = vals.reduce((a, b) => a + b, 0);
  return {
    answered: vals.length,
    missing: points.length - vals.length,
    avg: Math.round((sum / vals.length) * 10) / 10,
    min: Math.min(...vals),
    max: Math.max(...vals)
  };
}
