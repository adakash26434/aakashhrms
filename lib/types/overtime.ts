// Overtime (4.7): the company's overtime policy and its history.

/** How overtime is paid and decided. Rates are multiples of the hourly rate ((basic + grade) ÷ 240). */
export interface OvertimePolicy {
  /** Overtime on a working day (beyond the planned day). At least 1.5 (Labour Act §31). */
  workRate: number;
  /** Overtime on a weekly off or holiday, beyond a full day (the normal hours earn a substitute day off). At least 1.5. */
  offRate: number;
  /** Each day's overtime is rounded to whole blocks of this many minutes (0 = not rounded). */
  rounding: 0 | 15 | 30;
  /** "down": only full blocks are paid; "nearest": to the nearest block (a half block or more goes up). */
  roundingMode: "down" | "nearest";
  /** "required": only approved overtime is paid; "auto": detected overtime is paid, days over the legal limit wait for a decision. */
  approval: "required" | "auto";
}

/** One saved change to the policy (from the audit log). */
export interface OvertimePolicyChange {
  at: string;
  by: string;
  before: OvertimePolicy | null;
  after: OvertimePolicy;
}

/** What the Policies → Overtime tab shows. */
export interface OvertimePolicyData {
  policy: OvertimePolicy;
  /** True until the company saves its own policy (taken from System control, approval automatic). */
  isDefault: boolean;
  history: OvertimePolicyChange[];
  /** Employment types and whether each gets overtime (Organization → Employment types). */
  employmentTypes: { id: string; name: string; otEligible: boolean }[];
  /** Active shifts and the shortest overtime that counts on each (Attendance → Shifts). */
  shifts: { id: string; name: string; otMinimumMinutes: number }[];
  canEdit: boolean;
}
