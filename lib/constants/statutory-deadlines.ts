// Statutory monthly deposit deadlines shown on the dashboard. Counted from the
// end of each Bikram Sambat month. These are the commonly applied defaults;
// the company should confirm them with its tax advisor. They move to company
// configuration with F10 (compliance calendar).

export interface StatutoryRule {
  id: "tds" | "ssf";
  code: string;
  title: string;
  /** Days after the end of the BS month in which the deposit is due. */
  daysAfterMonthEnd: number;
  authority: string;
  basis: string;
}

export const STATUTORY_RULES: readonly StatutoryRule[] = [
  {
    id: "tds",
    code: "TDS",
    title: "Deposit salary TDS",
    daysAfterMonthEnd: 25,
    authority: "Inland Revenue Department",
    basis: "Income Tax Act 2058, s. 90: within 25 days after the end of the month",
  },
  {
    id: "ssf",
    code: "SSF",
    title: "Deposit SSF contributions",
    daysAfterMonthEnd: 15,
    authority: "Social Security Fund",
    basis: "Contributions are due within 15 days after the end of the month",
  },
];

/**
 * A deadline that passed this recently stays listed (as "was due"), so a
 * missed deposit does not silently disappear the day after. Deposits are not
 * tracked yet (F10), so the list cannot know whether it was paid.
 */
export const RECENTLY_PASSED_DAYS = 7;

/** A month-on-month swing at or beyond this share is flagged for a second look (F1 preview). */
export const VARIANCE_FLAG_PCT = 10;
