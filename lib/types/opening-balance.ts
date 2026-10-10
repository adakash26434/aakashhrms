import type { OpeningAmounts } from "@/lib/engines/opening-balance.engine";

/** One opening balance as the Opening balances screen shows it (4.8 / F15). */
export interface OpeningBalanceView extends OpeningAmounts {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchName: string;
  /** "Shrawan–Aswin". */
  covered: string;
  /** Social security tax + income tax. */
  tds: string;
  note: string | null;
  updatedAt: string;
  updatedByName: string | null;
  /** The viewer's own record: someone else removes it (S21). */
  own: boolean;
}

export interface OpeningBalancesPage {
  /** The fiscal year payroll runs in; null when none is active. */
  fiscalYear: { id: string; label: string } | null;
  rows: OpeningBalanceView[];
  permissions: { import: boolean; remove: boolean };
}
