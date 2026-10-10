// F17 notification centre: what the title-bar bell shows. Counts, pay months and dates only —
// never the people a request is about, never pay figures.

export type NotificationGroup = "approvals" | "payroll" | "deadlines";
export type NotificationTone = "danger" | "warning" | "neutral";

/** Requests a person decides (each counted by its own module's rules). */
export type ApprovalKind =
  | "leave"
  | "salary"
  | "attendance"
  | "leavePolicy"
  | "details"
  | "reimbursements"
  | "travel"
  | "leaveSalary"
  | "evaluations"
  | "targets"
  | "teamTargets";

export interface NotificationItem {
  /** Stable key: the approval kind, `run:<id>` or `deadline:<id>`. */
  id: string;
  group: NotificationGroup;
  label: string;
  /** One line under the label: what to do, or when it is due. */
  detail: string;
  /** What the item adds to the number on the bell (0: listed, not counted). */
  count: number;
  href: string;
  tone: NotificationTone;
  /** Short text shown instead of a count: when a deposit is due ("Tomorrow"), or the step a run waits for ("Approve"). */
  tag?: string;
}

export interface NotificationCentre {
  items: NotificationItem[];
  /** Things waiting for this person: the number on the bell. */
  total: number;
  /** A deposit is due within three days: a dot on the bell when nothing is counted. */
  urgent: boolean;
  /** The person can receive anything at all; otherwise the bell is hidden. */
  enabled: boolean;
}

/** The next step on a pay run, as the server allows it (maker-checker, F2). */
export type RunStep = "send" | "approve" | "lock" | "publish" | "release";

/** A pay run waiting for this person's step. */
export interface RunWaiting {
  id: string;
  year: number;
  month: number;
  runType: string;
  step: RunStep;
  /** Payslips held back from employees (F3). */
  heldCount: number;
  generatedByName: string | null;
}
