// "Today" for a Nepal company, independent of the server's time zone (cPanel
// hosts usually run in UTC, which is 5:45 behind Kathmandu).

const NEPAL_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kathmandu",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Kathmandu calendar date as YYYY-MM-DD. */
export function nepalDateIso(now: Date = new Date()): string {
  return NEPAL_DATE.format(now);
}

/** Local-midnight Date for the Kathmandu calendar date (safe for adToBS / day maths). */
export function nepalToday(now: Date = new Date()): Date {
  const [y, m, d] = nepalDateIso(now).split("-").map(Number);
  return new Date(y, m - 1, d);
}

const DAY_MS = 86_400_000;

/** Whole calendar days from `from` to `to` (both treated as local dates). */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY_MS);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/** Parses YYYY-MM-DD (or a Date) into a local-midnight Date; null when invalid. */
export function toLocalDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
