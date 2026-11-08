import type { ISODate } from "../db/types";

const pad = (n: number) => String(n).padStart(2, "0");

/** 端末のローカルタイムゾーンでの YYYY-MM-DD */
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** YYYY-MM-DD をローカル日付の Date に(UTC 解釈によるずれを避ける) */
export function parseISODate(value: ISODate): Date {
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(value: ISODate, days: number): ISODate {
  const d = parseISODate(value);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** end を含む直近 n 日の日付列(古い順) */
export function lastNDays(n: number, end: ISODate = todayISO()): ISODate[] {
  const out: ISODate[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export function formatJaDate(value: ISODate, withWeekday = true): string {
  const d = parseISODate(value);
  const base = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return withWeekday ? `${base}(${WEEK[d.getDay()]})` : base;
}

export function formatShortDate(value: ISODate): string {
  const d = parseISODate(value);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatMonth(value: ISODate): string {
  const d = parseISODate(value);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function nowISO(): string {
  return new Date().toISOString();
}
