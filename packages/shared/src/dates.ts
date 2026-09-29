import type { ISODate, Millis } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar date for a moment, as YYYY-MM-DD. */
export function toISODate(date: Date | Millis = new Date()): ISODate {
  const d = typeof date === "number" ? new Date(date) : date;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now: Date | Millis = new Date()): ISODate {
  return toISODate(now);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). Positive when `to` is later. */
export function daysBetween(from: ISODate, to: ISODate): number {
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

export function addDays(date: ISODate, days: number): ISODate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

/** "2026-10-10" -> "10 Oct 2026" (year omitted when it is the current year and `short` is set). */
export function formatDate(date: ISODate, options: { short?: boolean; today?: ISODate } = {}): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const base = `${d} ${MONTHS[m - 1]}`;
  if (options.short && options.today && options.today.slice(0, 4) === String(y)) return base;
  return `${base} ${y}`;
}

export type DueState =
  | { kind: "none" }
  | { kind: "overdue"; days: number }
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "soon"; days: number }
  | { kind: "later"; days: number; date: ISODate };

/** Days ahead that count as "due soon" for highlighting. */
export const DUE_SOON_DAYS = 7;

export function dueState(dueDate: ISODate | null | undefined, today: ISODate): DueState {
  if (!dueDate) return { kind: "none" };
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return { kind: "overdue", days: -diff };
  if (diff === 0) return { kind: "today" };
  if (diff === 1) return { kind: "tomorrow" };
  if (diff <= DUE_SOON_DAYS) return { kind: "soon", days: diff };
  return { kind: "later", days: diff, date: dueDate };
}

export type DayLabel = { kind: "today" } | { kind: "yesterday" } | { kind: "date"; text: string };

/** Label for when something happened: Today / Yesterday / 12 Sep. */
export function dayLabel(at: Millis, now: Date | Millis = new Date()): DayLabel {
  const today = toISODate(now);
  const day = toISODate(at);
  const diff = daysBetween(day, today);
  if (diff === 0) return { kind: "today" };
  if (diff === 1) return { kind: "yesterday" };
  return { kind: "date", text: formatDate(day, { short: true, today }) };
}
