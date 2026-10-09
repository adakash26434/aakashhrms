// Payroll run rules (4.8a). Pure: no database access.
// - pre-flight: what stops a run (blocking) and what to look at (warnings);
// - variance: each payslip against the same person's slip in the last locked
//   run, so an approver sees what changed before money moves;
// - totals and status rules.

import Decimal from "decimal.js";
import type { PayrollRun, PayrollRunStatus, PayrollSlip } from "@/lib/types/payroll";
import type { PreflightProblem, PreflightResult, RunStep, RunType, RunVariance, VarianceFlag, VarianceItem } from "@/lib/types/payroll-run";

/** Variance threshold when the company has not set one: ±5% (the common review rule). */
export const DEFAULT_VARIANCE_PCT = 5;
/** Threshold bounds: below 1% every rounding shows; above 50% nothing does. */
export const VARIANCE_PCT_RANGE = { min: 1, max: 50 } as const;

export const VALID_TRANSITIONS: Record<PayrollRunStatus, readonly PayrollRunStatus[]> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["LOCKED", "DRAFT"],
  LOCKED: [],
};

export function canTransition(from: PayrollRunStatus, to: PayrollRunStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/** The step a run stands at (the step rail). Only regular runs have a variance step. */
export function stepOf(run: Pick<PayrollRun, "status"> & { runType?: string }, varianceOpen: number): RunStep {
  if (run.status === "LOCKED") return "lock";
  if (run.status === "APPROVED") return "lock";
  if (run.status === "UNDER_REVIEW") return "approval";
  return varianceOpen > 0 && (run.runType ?? "REGULAR") === "REGULAR" ? "variance" : "review";
}

/** Steps shown for a kind of run. */
export function stepsFor(runType: RunType): RunStep[] {
  return runType === "REGULAR" ? ["preflight", "variance", "review", "approval", "lock"] : ["preflight", "review", "approval", "lock"];
}

// ---------------------------------------------------------------------------
// Pre-flight
// ---------------------------------------------------------------------------

export interface PreflightEmployee {
  id: string;
  name: string;
  code: string;
  branchId: string;
  status: string;
  joiningDate: string;
  terminationDate: string | null;
  /** "current": a salary structure in force; "setup": basic + grade only (new hire); "none": nothing. */
  salary: "current" | "setup" | "none";
  hasBank: boolean;
  hasPan: boolean;
  /** Overtime days still waiting for a decision this month. */
  overtimeWaiting: number;
}

export interface PreflightInput {
  runType: RunType;
  period: { year: number; month: number; label: string; start: string; end: string };
  today: string;
  /** Festival heads chosen for a bonus run. */
  festivalHeads: number;
  /** The branches chosen, with whether their attendance month is closed. */
  branches: { id: string; name: string; closed: boolean }[];
  employees: PreflightEmployee[];
  pendingLeaves: number;
  /** Salary changes waiting for approval whose effective date touches the month. */
  pendingSalaryChanges: number;
  activeFiscalYear: { id: string; label: string } | null;
  /** Tax slabs of the active fiscal year. */
  slabCount: number;
  /** Runs already made for this period and any of the branches. */
  existingRuns: { id: string; status: PayrollRunStatus }[];
  /** The previous month's run (null: none yet). */
  previousRun: { status: PayrollRunStatus; label: string } | null;
  /** Fund contributions for the month have been posted (null: the company has no active funds). */
  fundsPosted: boolean | null;
  checkedAt: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Everything that must be right before a month is paid: blocking problems stop it, warnings are read first. */
export function preflight(input: PreflightInput): PreflightResult {
  const p: PreflightProblem[] = [];
  const add = (code: string, severity: PreflightProblem["severity"], text: string, extra: Partial<PreflightProblem> = {}) => p.push({ code, severity, text, ...extra });

  if (input.period.end >= input.today) add("month_not_ended", "blocking", `${input.period.label} has not ended yet: a month is paid after its last day.`);
  if (!input.activeFiscalYear) add("no_fiscal_year", "blocking", "No active fiscal year. Set one in Company setup → Fiscal years.", { href: "/setup/fiscal-year" });
  else if (!input.slabCount) add("no_tax_slabs", "blocking", `No income tax slabs for ${input.activeFiscalYear.label}. Add them in Setup → Tax rates.`, { href: "/setup/tax-rates" });

  const regular = input.runType === "REGULAR";
  const bonus = input.runType === "FESTIVAL_BONUS";
  const locked = input.existingRuns.find((r) => r.status === "LOCKED");
  if (regular && locked) add("run_locked", "blocking", `${input.period.label} is already paid (a locked run exists) for one of these branches.`);
  else if (regular && input.existingRuns.length) add("run_exists", "blocking", `A run for ${input.period.label} already exists for these branches. Open it, or discard it and generate again.`);
  else if (bonus && input.existingRuns.length) add("bonus_exists", "blocking", `A festival bonus run for ${input.period.label} already exists for these branches.`);
  if (bonus && !input.festivalHeads) add("no_festival_head", "blocking", "Choose the festival allowance to pay (Setup → Pay heads marks it as a festival allowance).", { href: "/setup/pay-heads" });

  if (regular) {
    for (const b of input.branches) {
      if (!b.closed) add("month_open", "blocking", `Attendance for ${input.period.label} is not closed for ${b.name}. Close it in Attendance → Month close (overtime decisions are part of closing).`, { href: "/timeAndLeave/attendance?tab=close" });
    }
    if (input.pendingLeaves) add("pending_leaves", "blocking", `${plural(input.pendingLeaves, "leave request")} for ${input.period.label} still waiting for a decision.`, { href: "/timeAndLeave/leaves" });
  }
  if (input.pendingSalaryChanges) add("pending_salary", "blocking", `${plural(input.pendingSalaryChanges, "salary change")} waiting for approval would apply to ${input.period.label}. Decide ${input.pendingSalaryChanges === 1 ? "it" : "them"} first.`, { href: "/workforce/salary-mapping?tab=approvals" });

  if (!input.employees.length) add("no_employees", "blocking", "Nobody in the chosen scope was employed this month.");
  for (const e of input.employees) {
    const about = { employeeId: e.id, employeeName: e.name };
    if (e.salary === "none") add("no_salary", "blocking", `${e.name} (${e.code}) has no salary structure.`, { ...about, href: `/workforce/salary-mapping?employee=${e.id}` });
    else if (regular && e.salary === "setup") add("salary_setup", "blocking", `${e.name} (${e.code}) has only basic and grade: finish the salary structure.`, { ...about, href: `/workforce/salary-mapping?employee=${e.id}` });
    if (regular && e.overtimeWaiting) add("overtime_waiting", "blocking", `${e.name}: ${plural(e.overtimeWaiting, "overtime day")} waiting for a decision.`, { ...about, href: "/timeAndLeave/attendance?tab=overtime" });
    if (!e.hasBank) add("no_bank", "warning", `${e.name} (${e.code}) has no bank account: the bank file will skip them.`, { ...about, href: `/workforce/employees/${e.id}` });
    if (!e.hasPan) add("no_pan", "warning", `${e.name} (${e.code}) has no PAN: income tax is deducted, the IRD file needs it.`, { ...about, href: `/workforce/employees/${e.id}` });
    if (regular && e.joiningDate >= input.period.start && e.joiningDate <= input.period.end) add("joiner", "info", `${e.name} joined on ${e.joiningDate}: paid for part of the month.`, about);
    if (regular && e.terminationDate && e.terminationDate >= input.period.start && e.terminationDate <= input.period.end) add("leaver", "info", `${e.name} left on ${e.terminationDate}: paid up to that day.`, about);
  }

  if (input.previousRun && input.previousRun.status !== "LOCKED") add("previous_open", "warning", `${input.previousRun.label} is not locked yet (${input.previousRun.status.toLowerCase().replace("_", " ")}). Income tax projections use locked months.`);
  if (regular && input.fundsPosted === false) add("funds_not_posted", "warning", `Welfare fund contributions for ${input.period.label} are not posted yet (they post on the first day of the next month). Payslips will show none.`, { href: "/payroll/funds" });

  const order: Record<PreflightProblem["severity"], number> = { blocking: 0, warning: 1, info: 2 };
  p.sort((a, b) => order[a.severity] - order[b.severity]);
  return { problems: p, blocking: p.filter((x) => x.severity === "blocking").length, warnings: p.filter((x) => x.severity === "warning").length, employees: input.employees.length, checkedAt: input.checkedAt };
}

// ---------------------------------------------------------------------------
// Variance
// ---------------------------------------------------------------------------

export interface VarianceInput {
  slips: readonly PayrollSlip[];
  /** The same employees' slips in the last locked run, by employee id. */
  previous: ReadonlyMap<string, Pick<PayrollSlip, "grossEarnings" | "netPayable" | "tdsThisMonth" | "ssfEmployee" | "bankAccountNumber">>;
  employees: ReadonlyMap<string, { status: string; terminationDate: string | null }>;
  period: { start: string; end: string };
  thresholdPct: number;
  base: { runId: string; label: string } | null;
  computedAt: string;
  /** Acknowledgements from an earlier review of this run, kept when the flags are unchanged. */
  earlier?: RunVariance | null;
}

export function pctChange(before: number, after: number): number | null {
  if (!before) return null;
  return Math.round(((after - before) / Math.abs(before)) * 1000) / 10;
}

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The employees whose pay needs a look before the run is submitted (only those with flags). */
export function variance(input: VarianceInput): RunVariance {
  const items: VarianceItem[] = [];
  for (const s of input.slips) {
    const flags: VarianceFlag[] = [];
    const prev = input.previous.get(s.employeeId);
    const net = Number(s.netPayable) || 0;
    const e = input.employees.get(s.employeeId);
    const figure = (code: VarianceFlag["code"], label: string, before: number, after: number) => {
      const pct = pctChange(before, after);
      if (pct !== null && Math.abs(pct) >= input.thresholdPct) flags.push({ code, text: `${label} ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}%: ${money(before)} → ${money(after)}`, before, after, changePct: pct });
    };
    if (prev) {
      figure("gross", "Gross earnings", Number(prev.grossEarnings) || 0, Number(s.grossEarnings) || 0);
      figure("net", "Net payable", Number(prev.netPayable) || 0, net);
      figure("tds", "Income tax", Number(prev.tdsThisMonth) || 0, Number(s.tdsThisMonth) || 0);
      figure("ssf", "SSF", Number(prev.ssfEmployee) || 0, Number(s.ssfEmployee) || 0);
      if ((prev.bankAccountNumber || "").trim() !== (s.bankAccountNumber || "").trim()) flags.push({ code: "bank_changed", text: `Bank account changed since ${input.base?.label ?? "the last run"}: ${prev.bankAccountNumber || "none"} → ${s.bankAccountNumber || "none"}`, before: null, after: null, changePct: null });
    } else if (input.base) {
      flags.push({ code: "new_joiner", text: `Not in ${input.base.label}: first payslip (new joiner or newly in scope)`, before: null, after: net, changePct: null });
    }
    if (e && (e.status !== "Active" || (e.terminationDate && e.terminationDate < input.period.start))) flags.push({ code: "leaver_paid", text: `${e.terminationDate ? `Left on ${e.terminationDate}` : "Not active"} but has a payslip`, before: null, after: net, changePct: null });
    if (net < 0) flags.push({ code: "negative_net", text: `Net payable is negative: ${money(net)}`, before: null, after: net, changePct: null });
    else if (net === 0 && (!e || e.status === "Active")) flags.push({ code: "zero_net", text: "Active employee with nothing to pay", before: null, after: 0, changePct: null });
    if (!flags.length) continue;
    // An earlier acknowledgement stands while the same flags are raised.
    const before = input.earlier?.items.find((i) => i.employeeId === s.employeeId);
    const same = !!before && before.acknowledgedAt && before.flags.map((f) => f.code).sort().join() === flags.map((f) => f.code).sort().join();
    items.push({
      slipId: s.id,
      employeeId: s.employeeId,
      employeeName: s.employeeName,
      employeeCode: s.employeeCode,
      flags,
      acknowledgedBy: same ? before!.acknowledgedBy : null,
      acknowledgedByName: same ? before!.acknowledgedByName ?? null : null,
      acknowledgedAt: same ? before!.acknowledgedAt : null,
      note: same ? before!.note : null,
    });
  }
  items.sort((a, b) => b.flags.length - a.flags.length || a.employeeName.localeCompare(b.employeeName));
  return { baseRunId: input.base?.runId ?? null, baseLabel: input.base?.label ?? null, thresholdPct: input.thresholdPct, computedAt: input.computedAt, items };
}

/** Flags still to acknowledge. */
export function varianceOpen(v: RunVariance | null | undefined): number {
  return v ? v.items.filter((i) => !i.acknowledgedAt).length : 0;
}

/** A threshold typed by a user, kept in range; not a number → the default. */
export function normalizeThreshold(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_VARIANCE_PCT;
  return Math.min(VARIANCE_PCT_RANGE.max, Math.max(VARIANCE_PCT_RANGE.min, Math.round(n * 10) / 10));
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export interface RunTotals {
  totalGross: string;
  totalDeductions: string;
  totalNetPayable: string;
  totalTds: string;
  totalPf: string;
  totalSsf: string;
  employeeCount: number;
}

/** The run's figures are always the sum of its payslips (the stored totals used to drift). */
export function runTotals(slips: readonly Pick<PayrollSlip, "grossEarnings" | "totalDeductions" | "netPayable" | "tdsThisMonth" | "pfEmployee" | "ssfEmployee">[]): RunTotals {
  const sum = (f: (s: (typeof slips)[number]) => string) => slips.reduce((n, s) => n.plus(new Decimal(f(s) || 0)), new Decimal(0)).toDecimalPlaces(2).toString();
  return {
    totalGross: sum((s) => s.grossEarnings),
    totalDeductions: sum((s) => s.totalDeductions),
    totalNetPayable: sum((s) => s.netPayable),
    totalTds: sum((s) => s.tdsThisMonth),
    totalPf: sum((s) => s.pfEmployee),
    totalSsf: sum((s) => s.ssfEmployee),
    employeeCount: slips.length,
  };
}

/** "All branches" or the names, for the Runs grid. */
export function scopeText(run: Pick<PayrollRun, "branchIds" | "departmentIds" | "employeeIds">, branchName: (id: string) => string, branchCount: number): string {
  const branches = run.branchIds.length >= branchCount ? "All branches" : run.branchIds.map(branchName).filter(Boolean).join(", ") || "No branch";
  const extra = [run.departmentIds?.length ? `${run.departmentIds.length} dept${run.departmentIds.length === 1 ? "" : "s"}` : "", run.employeeIds?.length ? `${run.employeeIds.length} chosen` : ""].filter(Boolean);
  return extra.length ? `${branches} · ${extra.join(" · ")}` : branches;
}
