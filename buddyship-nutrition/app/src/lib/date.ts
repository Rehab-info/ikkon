/** 日付は利用者のタイムゾーン(Phase 1 は Asia/Tokyo)で扱う */
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayJst(now = new Date()): string {
  return fmt.format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
export function formatDateJa(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日(${WEEK[d.getUTCDay()]})`;
}

/** さかのぼって記録できる日数(D-30) */
export const BACKFILL_DAYS = 7;
