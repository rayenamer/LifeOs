import { MonthKey } from '../models';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

/** Local calendar date as YYYY-MM-DD (no timezone shift). */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return isoDate(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseIso(a).getTime() - parseIso(b).getTime()) / 86_400_000);
}

export function monthOf(iso: string): MonthKey {
  const d = parseIso(iso);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function currentMonth(): MonthKey {
  return monthOf(today());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function monthStart(year: number, month: number): string {
  return `${year}-${`${month}`.padStart(2, '0')}-01`;
}

export function monthEnd(year: number, month: number): string {
  return `${year}-${`${month}`.padStart(2, '0')}-${daysInMonth(year, month)}`;
}

/** All YYYY-MM-DD dates in [start, end] inclusive. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function sameMonth(a: MonthKey, b: MonthKey): boolean {
  return a.year === b.year && a.month === b.month;
}

export function isFutureMonth(m: MonthKey): boolean {
  const c = currentMonth();
  return m.year > c.year || (m.year === c.year && m.month > c.month);
}

/** Monday-based week start for a given date. */
export function weekStartOf(iso: string): string {
  const d = parseIso(iso);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  return addDays(iso, -dow);
}

export function weekEndOf(iso: string): string {
  return addDays(weekStartOf(iso), 6);
}

/** ISO-8601 week number. */
export function isoWeekNumber(iso: string): number {
  const d = parseIso(iso);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604_800_000);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** "25 AUG" style. */
export function shortDate(iso: string): string {
  const d = parseIso(iso);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3).toUpperCase()}`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
