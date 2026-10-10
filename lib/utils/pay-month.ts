import { adToBS, BS_MONTHS_EN } from "@/lib/utils/bs-calendar";

// A pay month is a BS month written "YYYY-MM" (2083-07 = Kartik 2083): the month a regular pay run
// pays. Leave salary (4.9) is paid with one; loans (4.10) start their deductions in one. Plain
// strings compare in calendar order.

const PAY_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const isPayMonth = (v: unknown): v is string => typeof v === "string" && PAY_MONTH.test(v);
export const payMonthOf = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

/** The BS month a day falls in (pass the Nepal day, e.g. `nepalToday()`). */
export function bsMonthOf(day: Date): { year: number; month: number } {
  const bs = adToBS(day);
  return { year: bs.year, month: bs.month };
}

/** "Kartik 2083" for a pay month; anything else (free text from before) as it was written. */
export function payMonthLabel(value: string): string {
  const m = PAY_MONTH.exec(value);
  return m ? `${BS_MONTHS_EN[Number(m[2])]} ${m[1]}` : value;
}

/** This BS month and the ones after it (`count` in all), across the year end. */
export function payMonthOptions(today: { year: number; month: number }, count = 3): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  let { year, month } = today;
  for (let i = 0; i < count; i++) {
    const value = payMonthOf(year, month);
    out.push({ value, label: payMonthLabel(value) });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}
