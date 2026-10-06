import type {
  LeaveTypeRecord,
  LeaveTypeFormData,
  LeaveTypeValidationErrors,
  LeaveTypeKPIs,
  GenderApplicable,
} from "@/lib/types/leave-type";
import { CREDIT_MODES, DAY_BASES, LEAVE_KINDS } from "@/lib/types/leave";

// Company leave types (4.6e): the company's own leave (unpaid, study,
// special…). The law sets no minimum for them, so they apply when saved;
// these rules keep each one coherent. Pure: no database access.

const PAY_TYPES = ["Pay", "Non-Pay", "Partial-Pay"] as const;
const GENDERS = ["All", "Male", "Female"] as const;
const half = (n: number) => Math.round(n * 2) === n * 2;
const whole = (n: number) => Number.isInteger(n);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

/**
 * Validate a company leave type (after `normalizeLeaveTypeForm`). Each
 * error is keyed by its field, in words the window shows under it.
 */
export function validateLeaveTypeForm(data: LeaveTypeFormData): LeaveTypeValidationErrors {
  const errors: LeaveTypeValidationErrors = {};
  const days = Number(data.noOfDays);

  if (!data.name?.trim()) errors.name = "Enter a name";
  else if (data.name.trim().length > 100) errors.name = "At most 100 characters";

  if (!data.code?.trim()) errors.code = "Enter a code";
  else if (!/^[A-Z_]+$/.test(data.code.trim())) errors.code = "Capital letters and _ only (e.g. STUDY_LEAVE)";
  else if (data.code.trim().length > 40) errors.code = "At most 40 characters";

  if (!(PAY_TYPES as readonly string[]).includes(data.leaveType)) errors.leaveType = "Choose how it is paid";
  if (!(LEAVE_KINDS as readonly string[]).includes(data.kind)) errors.kind = "Choose how days are given";
  else if (data.kind === "balance" && data.leaveType === "Non-Pay") errors.kind = "Unpaid leave has no balance: choose No balance (with a yearly limit if needed)";
  if (!(DAY_BASES as readonly string[]).includes(data.dayBasis)) errors.dayBasis = "Choose how days are counted";
  if (!(GENDERS as readonly string[]).includes(data.genderApplicable)) errors.genderApplicable = "Choose who can take it";

  if (data.kind === "balance" || data.kind === "event") {
    if (!Number.isFinite(days) || days <= 0 || days > 365 || !half(days)) errors.noOfDays = data.kind === "event" ? "Days each time: more than 0, up to 365, whole or half days" : "Days a year: more than 0, up to 365, whole or half days";
  }
  if (data.kind === "event" && data.paidDaysPerEvent !== null) {
    if (data.paidDaysPerEvent < 0 || !half(data.paidDaysPerEvent)) errors.paidDaysPerEvent = "Whole or half days";
    else if (Number.isFinite(days) && data.paidDaysPerEvent > days) errors.paidDaysPerEvent = "No more than the days each time";
  }
  if (data.kind === "balance" && !(CREDIT_MODES as readonly string[]).includes(data.creditMode)) errors.creditMode = "Choose when the days are given";
  if (data.kind === "balance" && data.carryForward && data.accumulationCap !== null && (data.accumulationCap <= 0 || data.accumulationCap > 999 || !half(data.accumulationCap))) {
    errors.accumulationCap = "More than 0 and up to 999 days (empty: no limit)";
  }
  if (data.kind === "balance" && data.isEncashable) {
    if (data.encashmentBasis !== "BasicSalary" && data.encashmentBasis !== "Fixed") errors.encashmentBasis = "Choose the rate";
    else if (data.encashmentBasis === "Fixed" && (data.payoutFixedAmount === null || !(data.payoutFixedAmount > 0) || data.payoutFixedAmount > 10_000_000)) errors.payoutFixedAmount = "Enter the amount per day";
  }

  if (data.maxDaysPerRequest !== null && (data.maxDaysPerRequest <= 0 || data.maxDaysPerRequest > 365 || !half(data.maxDaysPerRequest))) errors.maxDaysPerRequest = "More than 0 and up to 365 days (empty: no limit)";
  if (data.requiresDocument && (data.documentThresholdDays === null || data.documentThresholdDays < 1 || data.documentThresholdDays > 365 || !whole(data.documentThresholdDays))) {
    errors.documentThresholdDays = "After how many days in a row (1 or more)";
  }
  if (data.noticeDays !== null && (data.noticeDays < 0 || data.noticeDays > 365 || !whole(data.noticeDays))) errors.noticeDays = "Whole days, up to 365";
  if (data.eligibleAfterDays !== null && (data.eligibleAfterDays < 0 || data.eligibleAfterDays > 3650 || !whole(data.eligibleAfterDays))) errors.eligibleAfterDays = "Whole days, up to 3650 (10 years)";
  if (data.maxDaysPerYear !== null && (data.maxDaysPerYear <= 0 || data.maxDaysPerYear > 365 || !half(data.maxDaysPerYear))) errors.maxDaysPerYear = "More than 0 and up to 365 days (empty: no limit)";
  if (data.maxDaysInService !== null) {
    if (data.maxDaysInService <= 0 || data.maxDaysInService > 3650 || !half(data.maxDaysInService)) errors.maxDaysInService = "More than 0 and up to 3650 days (empty: no limit)";
    else if (data.maxDaysPerYear !== null && data.maxDaysInService < data.maxDaysPerYear) errors.maxDaysInService = "At least the yearly limit";
  }
  if (!Array.isArray(data.applicableDepartments) || data.applicableDepartments.length > 200) errors.applicableDepartments = "Choose departments again";
  if (!Array.isArray(data.applicableDesignations) || data.applicableDesignations.length > 200) errors.applicableDesignations = "Choose designations again";

  return errors;
}

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const zeroToNull = (v: number | null) => (v === 0 ? null : v);
const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64))] : []);

/**
 * The form as the server keeps it: fields that mean nothing for the kind are
 * cleared (no balance: no days, carry-over or payout; event: no carry-over;
 * balance: no yearly or service limit), and 0 means "no limit". Never trusts
 * what the browser left in hidden fields.
 */
export function normalizeLeaveTypeForm(raw: Partial<LeaveTypeFormData>): LeaveTypeFormData {
  const kind = (LEAVE_KINDS as readonly string[]).includes(String(raw.kind)) ? (raw.kind as LeaveTypeFormData["kind"]) : "balance";
  const f: LeaveTypeFormData = {
    name: String(raw.name ?? "").trim(),
    code: String(raw.code ?? "").trim().toUpperCase(),
    leaveType: (raw.leaveType ?? "Pay") as LeaveTypeFormData["leaveType"],
    noOfDays: numOrNull(raw.noOfDays) ?? 0,
    kind,
    dayBasis: raw.dayBasis === "calendar" ? "calendar" : raw.dayBasis === "working" || raw.dayBasis === undefined ? "working" : (raw.dayBasis as LeaveTypeFormData["dayBasis"]),
    allowHalfDay: raw.allowHalfDay !== false,
    maxDaysPerRequest: zeroToNull(numOrNull(raw.maxDaysPerRequest)),
    paidDaysPerEvent: numOrNull(raw.paidDaysPerEvent),
    creditMode: raw.creditMode === "monthly" ? "monthly" : "yearly",
    proRataForNewJoinees: raw.proRataForNewJoinees !== false,
    carryForward: raw.carryForward === true,
    accumulationCap: zeroToNull(numOrNull(raw.accumulationCap)),
    isEncashable: raw.isEncashable === true,
    encashmentBasis: raw.encashmentBasis === "Fixed" ? "Fixed" : "BasicSalary",
    payoutFixedAmount: numOrNull(raw.payoutFixedAmount),
    requiresDocument: raw.requiresDocument === true,
    documentThresholdDays: numOrNull(raw.documentThresholdDays),
    noticeDays: zeroToNull(numOrNull(raw.noticeDays)),
    eligibleAfterDays: zeroToNull(numOrNull(raw.eligibleAfterDays)),
    maxDaysPerYear: zeroToNull(numOrNull(raw.maxDaysPerYear)),
    maxDaysInService: zeroToNull(numOrNull(raw.maxDaysInService)),
    genderApplicable: (raw.genderApplicable ?? "All") as LeaveTypeFormData["genderApplicable"],
    applicableDepartments: ids(raw.applicableDepartments),
    applicableDesignations: ids(raw.applicableDesignations),
    isActive: raw.isActive !== false,
  };
  if (kind !== "balance") {
    f.creditMode = "yearly";
    f.carryForward = false;
    f.accumulationCap = null;
    f.isEncashable = false;
  } else {
    f.paidDaysPerEvent = null;
    f.maxDaysPerYear = null;
    f.maxDaysInService = null;
  }
  if (kind === "none") {
    f.noOfDays = 0;
    f.paidDaysPerEvent = null;
  }
  if (kind !== "event") f.paidDaysPerEvent = null;
  if (!f.carryForward) f.accumulationCap = null;
  if (!f.isEncashable) f.encashmentBasis = "BasicSalary";
  if (f.encashmentBasis !== "Fixed") f.payoutFixedAmount = null;
  if (!f.requiresDocument) f.documentThresholdDays = null;
  return f;
}

const PAY_WORD: Record<string, string> = { Pay: "paid", "Non-Pay": "unpaid", "Partial-Pay": "half-paid" };
const days = (n: number) => `${fmt(n)} day${n === 1 ? "" : "s"}`;

/**
 * The whole type in one sentence, as the window and the pane show it:
 * "Study leave: 10 paid days a year, given at the start of the leave year
 * (a share for joiners), carried over up to 20 days, the rest lapses;
 * 7 days' notice."
 */
export function describeLeaveType(f: LeaveTypeFormData, names?: { departments?: number; designations?: number }): string {
  const name = f.name.trim() || "This leave";
  const pay = PAY_WORD[f.leaveType] ?? "paid";
  const parts: string[] = [];
  if (f.kind === "none") parts.push(`${pay}, no balance`);
  else if (f.kind === "event") {
    parts.push(`${days(f.noOfDays)} each time, ${f.paidDaysPerEvent !== null && f.paidDaysPerEvent < f.noOfDays ? `the first ${days(f.paidDaysPerEvent)} paid, the rest unpaid` : pay}`);
  } else {
    parts.push(`${fmt(f.noOfDays)} ${pay} day${f.noOfDays === 1 ? "" : "s"} a year`);
    parts.push(f.creditMode === "monthly" ? `earned ${fmt(Math.round((f.noOfDays / 12) * 100) / 100)} a month as each attendance month closes` : `given at the start of the leave year${f.proRataForNewJoinees ? " (a share for joiners)" : " (joiners get the whole year)"}`);
    if (f.carryForward) parts.push(`carried over${f.accumulationCap ? ` up to ${days(f.accumulationCap)}` : ""}${f.accumulationCap ? (f.isEncashable ? ", the rest paid out" : ", the rest lapses") : ""}`);
    else parts.push(f.isEncashable ? "what is left is paid out at the year end" : "what is left lapses at the year end");
    if (f.isEncashable && f.encashmentBasis === "Fixed" && f.payoutFixedAmount) parts.push(`paid out at Rs ${f.payoutFixedAmount.toLocaleString("en-IN")} a day (never less than basic)`);
  }
  if (f.dayBasis === "calendar") parts.push("calendar days counted");
  if (!f.allowHalfDay) parts.push("no half days");
  if (f.maxDaysPerRequest) parts.push(`at most ${days(f.maxDaysPerRequest)} a request`);
  if (f.maxDaysPerYear) parts.push(`at most ${days(f.maxDaysPerYear)} a year`);
  if (f.maxDaysInService) parts.push(`${days(f.maxDaysInService)} over the whole service`);
  const rules: string[] = [];
  if (f.noticeDays) rules.push(`${days(f.noticeDays)}' notice`);
  if (f.eligibleAfterDays) rules.push(`after ${days(f.eligibleAfterDays)} of service`);
  if (f.requiresDocument && f.documentThresholdDays) rules.push(`a certificate after ${days(f.documentThresholdDays)} in a row`);
  const who: string[] = [];
  if (f.genderApplicable === "Female") who.push("women only");
  if (f.genderApplicable === "Male") who.push("men only");
  const dep = names?.departments ?? f.applicableDepartments.length;
  const des = names?.designations ?? f.applicableDesignations.length;
  if (dep) who.push(`${dep} department${dep === 1 ? "" : "s"}`);
  if (des) who.push(`${des} designation${des === 1 ? "" : "s"}`);
  if (who.length) rules.push(`for ${who.join(", ")}`);
  return `${name}: ${parts.join(", ")}${rules.length ? `; ${rules.join("; ")}` : ""}.`;
}

/** Labels of the fields, for the history. */
const FIELD_LABEL: Partial<Record<keyof LeaveTypeFormData, string>> = {
  name: "Name",
  code: "Code",
  leaveType: "Pay",
  noOfDays: "Days",
  kind: "How days are given",
  dayBasis: "Days counted",
  allowHalfDay: "Half days",
  maxDaysPerRequest: "Most days a request",
  paidDaysPerEvent: "Paid days each time",
  creditMode: "Given",
  proRataForNewJoinees: "A share for joiners",
  carryForward: "Carried over",
  accumulationCap: "Can be saved up to",
  isEncashable: "What is left",
  encashmentBasis: "Payout rate",
  payoutFixedAmount: "Payout per day",
  requiresDocument: "Certificate",
  documentThresholdDays: "Certificate after",
  noticeDays: "Notice",
  eligibleAfterDays: "After service of",
  maxDaysPerYear: "Most days a year",
  maxDaysInService: "Most days in the whole service",
  genderApplicable: "Who",
  applicableDepartments: "Departments",
  applicableDesignations: "Designations",
  isActive: "In use",
};

const VALUE_WORD: Record<string, Record<string, string>> = {
  leaveType: { Pay: "Paid", "Non-Pay": "Unpaid", "Partial-Pay": "Half paid" },
  kind: { balance: "A balance", event: "Each time it happens", none: "No balance" },
  dayBasis: { working: "Working days", calendar: "Calendar days" },
  creditMode: { yearly: "At the start of the year", monthly: "Month by month" },
  isEncashable: { true: "Paid out", false: "Lapses" },
  encashmentBasis: { BasicSalary: "Basic salary", Fixed: "Fixed amount" },
  genderApplicable: { All: "Everyone", Female: "Women", Male: "Men" },
  isActive: { true: "On", false: "Off" },
};

function valueWord(key: keyof LeaveTypeFormData, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? `${v.length} chosen` : "All";
  const word = VALUE_WORD[key]?.[String(v)];
  if (word) return word;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return fmt(v);
  return String(v);
}

/** What changed between two versions, one line each ("Days: 10 → 12"). */
export function leaveTypeChangeLines(before: Partial<LeaveTypeFormData>, after: Partial<LeaveTypeFormData>): string[] {
  const out: string[] = [];
  for (const key of Object.keys(FIELD_LABEL) as (keyof LeaveTypeFormData)[]) {
    if (!(key in after)) continue;
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue;
    out.push(key in before ? `${FIELD_LABEL[key]}: ${valueWord(key, a)} → ${valueWord(key, b)}` : `${FIELD_LABEL[key]}: ${valueWord(key, b)}`);
  }
  return out;
}

/** The fields that differ (for the history row: only what changed is kept). */
export function changedFields(before: LeaveTypeFormData, after: LeaveTypeFormData): { before: Partial<LeaveTypeFormData>; after: Partial<LeaveTypeFormData> } {
  const b: Partial<LeaveTypeFormData> = {};
  const a: Partial<LeaveTypeFormData> = {};
  for (const key of Object.keys(after) as (keyof LeaveTypeFormData)[]) {
    if (JSON.stringify(before[key] ?? null) === JSON.stringify(after[key] ?? null)) continue;
    (b as Record<string, unknown>)[key] = before[key] ?? null;
    (a as Record<string, unknown>)[key] = after[key] ?? null;
  }
  return { before: b, after: a };
}

/** A saved type as the form holds it. */
export function formOfRecord(t: LeaveTypeRecord): LeaveTypeFormData {
  return normalizeLeaveTypeForm({
    name: t.name,
    code: t.code,
    leaveType: t.leaveType,
    noOfDays: t.noOfDays,
    kind: t.kind,
    dayBasis: t.dayBasis,
    allowHalfDay: t.allowHalfDay,
    maxDaysPerRequest: t.maxDaysPerRequest,
    paidDaysPerEvent: t.paidDaysPerEvent,
    creditMode: t.creditMode,
    proRataForNewJoinees: t.proRataForNewJoinees,
    carryForward: t.carryForward,
    accumulationCap: t.accumulationCap,
    isEncashable: t.isEncashable,
    encashmentBasis: t.encashmentBasis === "Fixed" ? "Fixed" : "BasicSalary",
    payoutFixedAmount: t.payoutFixedAmount,
    requiresDocument: t.requiresDocument,
    documentThresholdDays: t.documentThresholdDays,
    noticeDays: t.noticeDays,
    eligibleAfterDays: t.eligibleAfterDays,
    maxDaysPerYear: t.maxDaysPerYear,
    maxDaysInService: t.maxDaysInService,
    genderApplicable: t.genderApplicable,
    applicableDepartments: t.applicableDepartments,
    applicableDesignations: t.applicableDesignations,
    isActive: t.isActive,
  });
}

/**
 * The payout rate of a day of leave (leave salary, 4.9): statutory leave is
 * always basic salary per day (Labour Act §49); a company type may set a
 * fixed amount, never paid below basic per day. Old types without a basis
 * fall back to their leave rule.
 */
export function payoutRate(
  t: Pick<LeaveTypeRecord, "isStatutory" | "encashmentBasis" | "payoutFixedAmount">,
  oldRule: { encashmentRate: string | null; encashmentFixedAmount: number | null } | null
): { rate: "BASIC_DAILY" | "FIXED_AMOUNT"; fixed: number | null } {
  if (t.isStatutory) return { rate: "BASIC_DAILY", fixed: null };
  if (t.encashmentBasis === "Fixed" && t.payoutFixedAmount && t.payoutFixedAmount > 0) return { rate: "FIXED_AMOUNT", fixed: t.payoutFixedAmount };
  if (t.encashmentBasis) return { rate: "BASIC_DAILY", fixed: null };
  if (oldRule?.encashmentRate === "FIXED_AMOUNT" && oldRule.encashmentFixedAmount && oldRule.encashmentFixedAmount > 0) return { rate: "FIXED_AMOUNT", fixed: oldRule.encashmentFixedAmount };
  return { rate: "BASIC_DAILY", fixed: null };
}

/**
 * Calculate leave type KPIs from a list of types.
 */
export function calculateLeaveTypeKPIs(types: LeaveTypeRecord[]): LeaveTypeKPIs {
  return {
    total: types.length,
    statutory: types.filter((t) => t.isStatutory).length,
    company: types.filter((t) => !t.isStatutory).length,
    active: types.filter((t) => t.isActive).length,
  };
}

/**
 * Format gender applicability for display.
 */
export function formatGenderApplicable(gender: GenderApplicable): string {
  switch (gender) {
    case "All":
      return "All Genders";
    case "Male":
      return "Male Only";
    case "Female":
      return "Female Only";
    default:
      return gender;
  }
}

/**
 * Get the badge variant for gender display.
 */
export function getGenderBadgeVariant(gender: GenderApplicable): "neutral" | "info" | "warning" {
  switch (gender) {
    case "All":
      return "neutral";
    case "Male":
      return "info";
    case "Female":
      return "warning";
    default:
      return "neutral";
  }
}

/**
 * Check if a leave type is applicable to an employee's gender.
 */
export function isLeaveTypeApplicableForGender(
  leaveTypeGender: GenderApplicable,
  employeeGender: string,
): boolean {
  if (leaveTypeGender === "All") return true;
  if (leaveTypeGender === "Female" && employeeGender === "Female") return true;
  if (leaveTypeGender === "Male" && employeeGender === "Male") return true;
  return false;
}

/**
 * Calculate pro-rata leave days for mid-year joinees.
 * @param totalDays Total annual leave days
 * @param joiningDate Employee joining date
 * @param fyStartDate Fiscal year start date
 * @param fyEndDate Fiscal year end date
 */
export function calculateProRataLeaveDays(
  totalDays: number,
  joiningDate: Date,
  fyStartDate: Date,
  fyEndDate: Date,
): number {
  if (joiningDate <= fyStartDate) return totalDays;

  const totalFyMs = fyEndDate.getTime() - fyStartDate.getTime();
  const remainingMs = fyEndDate.getTime() - joiningDate.getTime();
  if (remainingMs <= 0) return 0;

  const ratio = remainingMs / totalFyMs;
  return Math.round(totalDays * ratio * 10) / 10; // Round to 1 decimal
}
