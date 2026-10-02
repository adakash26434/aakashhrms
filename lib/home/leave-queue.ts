// Builds the Home leave-approval queue: each pending request with the context
// an approver needs to decide without opening another screen.

import { daysBetween, toIsoDate, toLocalDate } from "./nepal-time";

export interface QueueLeave {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  leaveType: string;
  /** "Pay" | "Non-Pay" | "Partial-Pay": unpaid days reduce this month's salary. */
  payType: string | null;
  from: string;
  to: string;
  days: number;
  reason: string;
  appliedOn: string;
  /** Calendar days since the request was made (null without a reference date). */
  waitingDays: number | null;
  /** Balance for this leave type before approval; null when no balance is kept. */
  balance: number | null;
  /** Colleagues in the same department already off (approved or pending) on overlapping days. */
  overlaps: { name: string; status: string }[];
}

export interface LeaveLike {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  appliedDate: Date | string;
  effectiveFrom: Date | string;
  effectiveTo: Date | string;
  noOfDays: number;
  reason: string;
  status: string;
}

export interface QueueContext {
  employees: Map<string, { fullName: string; employeeCode: string; departmentId: string | null }>;
  departments: Map<string, string>;
  leaveTypes: Map<string, { name: string; leaveType?: string | null }>;
  /** key: `${employeeId}:${leaveTypeId}` */
  balances: Map<string, number>;
  /** Approved and pending applications, used for overlap detection. */
  others: LeaveLike[];
  /** Today (local date) for "waiting N days". */
  today?: Date;
}

export function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

function iso(value: Date | string): string {
  const d = toLocalDate(value);
  return d ? toIsoDate(d) : "";
}

/** Oldest request first: it has waited longest. */
export function buildLeaveQueue(pending: LeaveLike[], ctx: QueueContext): QueueLeave[] {
  return pending
    .filter((app) => ctx.employees.has(app.employeeId))
    .map((app) => {
      const emp = ctx.employees.get(app.employeeId)!;
      const type = ctx.leaveTypes.get(app.leaveTypeId);
      const from = iso(app.effectiveFrom);
      const to = iso(app.effectiveTo);
      const overlaps = ctx.others
        .filter((o) => o.id !== app.id && o.employeeId !== app.employeeId)
        .filter((o) => o.status === "Approved" || o.status === "Pending")
        .filter((o) => {
          const other = ctx.employees.get(o.employeeId);
          return !!other && !!emp.departmentId && other.departmentId === emp.departmentId;
        })
        .filter((o) => rangesOverlap(from, to, iso(o.effectiveFrom), iso(o.effectiveTo)))
        .map((o) => ({ name: ctx.employees.get(o.employeeId)!.fullName, status: o.status }));
      const balanceKey = `${app.employeeId}:${app.leaveTypeId}`;
      return {
        id: app.id,
        employeeId: app.employeeId,
        employeeName: emp.fullName,
        employeeCode: emp.employeeCode,
        department: (emp.departmentId && ctx.departments.get(emp.departmentId)) || "—",
        leaveType: type?.name ?? "Leave",
        payType: type?.leaveType ?? null,
        from,
        to,
        days: Number(app.noOfDays) || 0,
        reason: app.reason ?? "",
        appliedOn: iso(app.appliedDate),
        waitingDays: (() => {
          const applied = toLocalDate(app.appliedDate);
          return ctx.today && applied ? Math.max(0, daysBetween(applied, ctx.today)) : null;
        })(),
        balance: ctx.balances.has(balanceKey) ? ctx.balances.get(balanceKey)! : null,
        overlaps,
      };
    })
    .sort((a, b) => (a.appliedOn < b.appliedOn ? -1 : a.appliedOn > b.appliedOn ? 1 : 0));
}
