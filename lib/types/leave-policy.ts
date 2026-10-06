// Leave policies (4.6c): the settings of a statutory leave type a company may
// change, only in the employees' favour (Labour Act 2074 is the minimum; a
// platform exception can lower one setting for a regulated company). Every
// change is a version: proposed by one person, approved by another.

import type { ApprovalTimelineEntry, AvailableActions } from "@/lib/types/approval";
import type { DayBasis } from "@/lib/types/leave";

export const POLICY_SETTINGS = ["days", "paidDays", "cap", "accrualEveryDays", "certificateAfter", "expiryDays", "allowHalfDay", "dayBasis"] as const;
export type PolicySetting = (typeof POLICY_SETTINGS)[number];

/** A statutory type's settings as people read them (null certificate = never asked for). */
export interface PolicyValues {
  /** Days a year (sick) or each time (maternity, maternity care, mourning). */
  days: number;
  /** Maternity: the first N days are paid. */
  paidDays: number | null;
  /** Can be saved up to (home, sick). */
  cap: number | null;
  /** Home leave: 1 day for every N paid days. */
  accrualEveryDays: number | null;
  /** A certificate is needed after N days in a row; null = never. */
  certificateAfter: number | null;
  /** Substitute leave must be taken within N days. */
  expiryDays: number | null;
  allowHalfDay: boolean;
  dayBasis: DayBasis;
}

/** The law's minimum on a date (lower days / caps, higher home rate N are worse for employees). */
export type PolicyFloor = Partial<Record<"days" | "paidDays" | "cap" | "accrualEveryDays" | "certificateAfter" | "expiryDays", number>>;

/** When a change takes effect: on approval, or (days a year) from the next leave year, or now with a top-up. */
export type PolicyApplies = "approval" | "next_year" | "top_up";

export type PolicyChangeStatus = "pending" | "approved" | "rejected" | "withdrawn" | "replaced";

/** A platform exception as the company sees it (read-only). */
export interface PolicyException {
  id: string;
  statutoryCode: string;
  setting: PolicySetting;
  value: number | null;
  legalBasis: string;
  reference: string | null;
  validFrom: string;
  validUntil: string | null;
  revokedAt: string | null;
  /** Why the platform withdrew it (shown to the company). */
  revokeReason?: string | null;
}

export interface PolicyChangeView {
  id: string;
  leaveTypeId: string;
  before: Partial<PolicyValues>;
  after: Partial<PolicyValues>;
  reason: string;
  applies: PolicyApplies;
  effectiveFrom: string | null;
  status: PolicyChangeStatus;
  source: "company" | "system";
  preparedBy: string;
  preparedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  appliedAt: string | null;
  /** Approved, but a part waits for its date. */
  scheduled: boolean;
  timeline: ApprovalTimelineEntry[];
  can: AvailableActions;
}

/** A company's request to the platform for an exception (4.6d). */
export interface ExceptionRequestRow {
  id: string;
  setting: PolicySetting;
  value: number | null;
  legalBasis: string;
  reference: string;
  validFrom: string;
  validUntil: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requestedBy: string;
  requestedAt: string;
  rejectionReason: string | null;
  /** What the platform granted (it may adjust the value and dates). */
  granted: { value: number | null; validFrom: string; validUntil: string | null } | null;
}

export interface PolicyTypeRow {
  id: string;
  name: string;
  statutoryCode: string;
  /** What the law calls it, for the guide and the window ("Labour Act §44"). */
  law: string;
  values: PolicyValues;
  /** The minimum today (the law, lowered by any active exception). */
  floor: PolicyFloor;
  /** Where each minimum comes from ("Labour Act §44", or "Exception: …"). */
  floorSource: Partial<Record<string, string>>;
  /** The settings this type has (sick: days, cap, certificate, half days). */
  editable: PolicySetting[];
  /** Days a year are credited at the year opening (sick): those can wait for the next leave year. */
  creditedYearly: boolean;
  exceptions: PolicyException[];
  /** Settings an exception can lower (those the Labour Act sets a minimum for). */
  exceptionSettings: PolicySetting[];
  exceptionRequests: ExceptionRequestRow[];
  pending: PolicyChangeView | null;
  scheduled: PolicyChangeView | null;
  history: PolicyChangeView[];
}

export interface LeavePolicyPageData {
  today: string;
  /** Current leave year, and the first day of the next one. */
  leaveYear: { label: string; start: string; end: string } | null;
  nextYearStart: string | null;
  types: PolicyTypeRow[];
  permissions: {
    /** Propose changes: Leave types → Edit, company-wide, not support view. */
    propose: boolean;
    approve: boolean;
    isAdministrator: boolean;
    /** Ask the platform for an exception (same as propose). */
    askException: boolean;
  };
  /** Exceptions in force that end within 30 days, with the leave type's name. */
  endingSoon: { typeName: string; exception: PolicyException }[];
  /** The platform could not be reached: exception requests aren't shown. */
  platformUnavailable: boolean;
  /** Other people who could approve a change this user proposes (company-wide, Leave types → Approve). */
  otherApprovers: string[];
  waitingForMe: number;
}

/** What a proposal would do, in words, with the problems that stop it. */
export interface PolicyPreview {
  /** "Days: 12 days → 15 days", one per changed setting. */
  lines: { setting: PolicySetting; text: string }[];
  /** Settings that wait for the next leave year (the rest apply on approval). */
  deferred: PolicySetting[];
  applies: PolicyApplies;
  effectiveFrom: string | null;
  topUp: { people: number; examples: { name: string; days: number }[] } | null;
  errors: Record<string, string>;
}
