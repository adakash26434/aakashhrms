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

// ---------------------------------------------------------------------------
// 4.7b Overtime approvals
// ---------------------------------------------------------------------------

/** How a month's (or a payslip's) overtime amount was worked out. */
export interface OvertimeDetail {
  amount: number;
  /** (basic + grade) ÷ 240. */
  hourlyRate: number;
  workHours: number;
  offHours: number;
  workRate: number;
  offRate: number;
}

/** A decided overtime day as stored (overtime_entries). */
export interface OvertimeEntry {
  id: string;
  employeeId: string;
  workDate: string;
  /** "detected": from the punches, written when decided; "manual": added by hand. */
  source: "detected" | "manual";
  dayKind: "work" | "off";
  /** Detected rows: the minutes the punches showed when decided. */
  detectedMinutes: number;
  /** Manual rows: the minutes asked for. */
  requestedMinutes: number;
  approvedMinutes: number;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  overLimit: boolean;
  reason: string | null;
  preparedBy: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  approvalRoute: string | null;
  createdAt: string;
}

/**
 * Where an overtime day stands:
 * - auto: paid as detected (approval automatic, within the legal limits);
 * - waiting: needs a decision before it is paid (and before the month closes);
 * - changed: decided, but the punches have changed since; waits again;
 * - approved / rejected / withdrawn: decided.
 */
export type OvertimeState = "auto" | "waiting" | "changed" | "approved" | "rejected" | "withdrawn";

/** One overtime day (detected or added by hand) with what it pays. */
export interface OvertimeLine {
  employeeId: string;
  date: string;
  source: "detected" | "manual";
  kind: "work" | "off";
  /** Detected now (detected) or asked for (manual). */
  minutes: number;
  /** Minutes approved (decided rows). */
  approvedMinutes: number | null;
  /** Minutes paid after the policy's rounding (0 while waiting or rejected). */
  paidMinutes: number;
  state: OvertimeState;
  /** More than 4 hours that day, or in a week with more than 24 hours (Labour Act §30). */
  overLimit: boolean;
  /** "Over 4 hours this day" / "Week over 24 hours". */
  limitText: string | null;
  entry: OvertimeEntry | null;
}

/** One overtime day on the Attendance → Overtime tab. */
export interface OvertimeDayView extends OvertimeLine {
  /** `${employeeId}|${date}|${source}`: what a decision is sent with. */
  key: string;
  employeeName: string;
  employeeCode: string;
  branchId: string;
  /** The day's punches and shift. */
  firstIn: string | null;
  lastOut: string | null;
  workMinutes: number;
  shiftText: string | null;
  dayText: string;
  /** The month is closed for this person's branch. */
  locked: boolean;
  preparedByName: string | null;
  decidedByName: string | null;
  timeline: import("@/lib/types/approval").ApprovalTimelineEntry[];
  can: { approve: boolean; finalApprove: boolean; reject: boolean; withdraw: boolean; reason: string | null };
}
