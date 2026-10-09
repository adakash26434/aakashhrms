import Decimal from "decimal.js";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { payrollSlips } from "@/lib/db/schema";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import { getPayCalendar } from "@/lib/repositories/pay-calendar.repository";
import * as repo from "@/lib/repositories/arrears.repository";
import * as payrollRepo from "@/lib/repositories/payroll.repository";
import * as attendanceRepo from "@/lib/repositories/attendance.repository";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as salaryMappingRepository from "@/lib/repositories/salary-mapping.repository";
import * as systemControlRepository from "@/lib/repositories/system-control.repository";
import * as fiscalYearRepository from "@/lib/repositories/fiscal-year.repository";
import * as taxRateRepository from "@/lib/repositories/tax-rate.repository";
import { recomputeTotals } from "@/lib/repositories/payroll-run.repository";
import { taxInputsFor } from "@/lib/services/payroll.service";
import { calculatePayslip, EMPTY_YTD, isSsfDeductionHead, isSsfEmployerHead, projectTds, type PayHeadInput } from "@/lib/engines/payroll.engine";
import { arrearsSlipFigures, componentsOf, diffComponents, sumComponents } from "@/lib/engines/arrears.engine";
import { periodFor, type PeriodCalendar } from "@/lib/engines/pay-period.engine";
import { parseCalendar } from "@/lib/engines/pay-calendar.engine";
import { unpaidDeduction } from "@/lib/engines/attendance-day.engine";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { UserFacingError } from "@/lib/errors/action-error";
import type { ArrearsCandidate, ArrearsMonthLine, NewRunInput } from "@/lib/types/payroll-run";
import type { PayrollRun } from "@/lib/types/payroll";

// Arrears (4.8b): the months already paid whose pay differs now (a back-dated
// salary revision approved after the lock, or attendance reopened and closed
// again), recomputed on the server with the data in force, and the ARREARS
// run that pays the differences. A locked payslip is never changed.

type Head = typeof import("@/lib/db/schema").payHeads.$inferSelect;

/** The pay head flags the arrears comparison needs. */
function flagsOf(all: readonly Head[]) {
  const byId = new Map(all.map((h) => [h.id, h]));
  const statutory = (id: string) => {
    const h = byId.get(id);
    return !!h && (h.isPfHead || h.isSsfHead || h.isSsfEmployerHead || h.isCitHead || h.isTdsHead || isSsfDeductionHead(h) || isSsfEmployerHead(h));
  };
  const otOrAbsent = (id: string) => {
    const h = byId.get(id);
    return !!h && (h.isOtHead || h.isAbsentDeduct || h.isLeaveHead);
  };
  return { byId, isStatutory: statutory, isOtOrAbsent: otOrAbsent };
}

/** The engine's view of an assigned head (the same mapping payroll.service uses). */
function toInput(h: { payHeadId: string; payHeadName: string; payHeadType: string; amount: string | number }, master: Head | undefined): PayHeadInput {
  return {
    id: h.payHeadId,
    code: master?.code || h.payHeadId,
    name: master?.name || h.payHeadName,
    type: (master?.type || h.payHeadType) as "allowance" | "deduction",
    effectOnTax: master?.effectOnTax ?? true,
    isFestivalAllowance: master?.isFestivalAllowance ?? false,
    isAbsentDeduct: master?.isAbsentDeduct ?? false,
    isOtHead: master?.isOtHead ?? false,
    isLeaveHead: master?.isLeaveHead ?? false,
    isTdsHead: master?.isTdsHead ?? false,
    isPfHead: master?.isPfHead ?? false,
    isSsfHead: Boolean(master?.isSsfHead || (master && isSsfDeductionHead(master))),
    isSsfEmployerHead: Boolean(master?.isSsfEmployerHead || (master && isSsfEmployerHead(master))),
    isRemoteAllowance: master?.isRemoteAllowance ?? false,
    isCitHead: master?.isCitHead ?? false,
    calcBasis: master?.calcBasis ?? "None",
    calcParameter: master?.calcParameter ?? "FixedAmount",
    calcPercent: master?.calcPercent?.toString() || "0",
    amount: String(h.amount),
    isManualOverride: false,
  } as PayHeadInput;
}

function masterInput(h: Head): PayHeadInput {
  return toInput({ payHeadId: h.id, payHeadName: h.name, payHeadType: h.type, amount: "0" }, h);
}

/** The engine's heads for a salary map, with the company's TDS and SSF heads added when the map lacks them (as payroll.service does). Shared with the final settlement (4.8b-3). */
export function assignedHeadsFor(map: { salaryHeads: { payHeadId: string; payHeadName: string; payHeadType: string; amount: string | number }[] }, all: readonly Head[]): PayHeadInput[] {
  const flags = flagsOf(all);
  const assigned = map.salaryHeads.map((h) => toInput(h, flags.byId.get(h.payHeadId)));
  if (!assigned.some((h) => h.isTdsHead)) {
    const tds = all.find((h) => h.isTdsHead);
    if (tds) assigned.push(masterInput(tds));
  }
  const hasSsf = assigned.some((h) => h.isSsfHead || h.isSsfEmployerHead || h.name.toLowerCase().includes("ssf"));
  if (hasSsf) {
    if (!assigned.some((h) => isSsfEmployerHead(h))) {
      const m = all.find((h) => isSsfEmployerHead(h));
      if (m) assigned.push(masterInput(m));
    }
    if (!assigned.some((h) => isSsfDeductionHead(h))) {
      const m = all.find((h) => isSsfDeductionHead(h));
      if (m) assigned.push(masterInput(m));
    }
  }
  return assigned;
}

export const findMasterHeads = repo.findMasterHeads;

/**
 * One locked month recomputed with what is in force now: the salary revision
 * at the month's end and the month's closed attendance summary. Loans, funds
 * and income tax are not compared (they were settled at the time).
 */
async function recomputeMonth(slip: repo.LockedSlipRow, context: { all: Head[]; systemControl: Awaited<ReturnType<typeof systemControlRepository.findSettings>> }): Promise<{ line: ArrearsMonthLine | null; kind: "salary" | "attendance" | null }> {
  const calendar = parseCalendar(slip.run.calendar);
  const period = periodFor(calendar, slip.run.payPeriodYear, slip.run.payPeriodMonth);
  const [emp, maps, summaries, revision] = await Promise.all([
    employeeRepository.findById(slip.employeeId),
    salaryMappingRepository.findInForceByEmployeeIds([slip.employeeId], period.end),
    attendanceRepo.findClosedSummaries([slip.employeeId], calendar, period.year, period.month),
    repo.findRevisionBatch(slip.employeeId, period.end),
  ]);
  const map = maps.get(slip.employeeId);
  if (!emp || !map) return { line: null, kind: null };
  const summary = summaries[0];
  const flags = flagsOf(context.all);
  const assigned = assignedHeadsFor(map, context.all);
  // The close stored the unpaid-day deduction for the basic in force then; rate the days again
  // with the revision in force now (the same formula as the month close).
  const unpaidNow = summary && Number(summary.calendarDays)
    ? unpaidDeduction(Number(map.basicSalary) + (Number(map.gradeAmount) || 0), { calendarDays: Number(summary.calendarDays), unpaidDays: Number(summary.unpaidDays), notEmployedDays: Number(summary.notEmployedDays) })
    : null;
  const festival = (slip.run.occasionalAllowanceHeadIds ?? []).some((id) => flags.byId.get(id)?.isFestivalAllowance);
  const remote = (slip.run.occasionalAllowanceHeadIds ?? []).some((id) => flags.byId.get(id)?.isRemoteAllowance);
  const due = calculatePayslip({
    employee: { id: emp.id, category: emp.category, gender: emp.gender, isDisabled: emp.isDisabled, taxStatus: emp.taxStatus, joiningDate: typeof emp.joiningDate === "string" ? emp.joiningDate : new Date(emp.joiningDate).toISOString().slice(0, 10) },
    salaryMap: { basicSalary: String(map.basicSalary), gradePercent: String(map.gradePercent || 0), gradeAmount: String(map.gradeAmount || 0) },
    assignedHeads: assigned,
    attendanceCalc: summary ? { leaveDeductionAmount: String(unpaidNow ?? summary.leaveDeductionAmount ?? "0"), otEarnedAmount: String(summary.otEarnedAmount ?? "0") } : { leaveDeductionAmount: slip.absentDeduction, otEarnedAmount: slip.otAmount },
    loanDeduction: slip.loanDeduction,
    fundDeduction: slip.fundDeduction ?? "0",
    systemControl: context.systemControl,
    taxSlabs: [],
    isFestivalMonth: festival,
    isRemoteMonth: remote,
    tax: { ytd: EMPTY_YTD, monthsRemaining: 12 },
  });
  const dueParts = componentsOf(
    { basicSalary: due.basicSalary, gradeAmount: due.gradeAmount, grossEarnings: due.grossEarnings, otAmount: due.otAmount, absentDeduction: due.absentDeduction, pfEmployee: due.pfEmployee, pfEmployer: due.pfEmployer, ssfEmployee: due.ssfEmployee, ssfEmployer: due.ssfEmployer, citDeduction: due.citDeduction },
    due.heads.map((h) => ({ headType: h.headType, calculatedAmount: h.calculatedAmount, payHeadId: h.payHeadId })),
    flags
  );
  const paidSlip = componentsOf(slip, slip.heads.map((h) => ({ headType: h.headType as "allowance" | "deduction", calculatedAmount: h.calculatedAmount, payHeadId: h.payHeadId })), flags);
  const lockedItems = (await repo.findLockedArrearsItems([slip.employeeId])).filter((i) => i.calendar === slip.run.calendar && i.periodYear === slip.run.payPeriodYear && i.periodMonth === slip.run.payPeriodMonth);
  const paid = sumComponents([paidSlip, ...lockedItems.map((i) => i.diff)]);
  const { diff, material } = diffComponents(dueParts, paid);
  if (!material) return { line: null, kind: null };
  // The kind names the newer cause: a revision approved after the lock, else the attendance.
  const lockedAt = slip.run.lockedAt ? new Date(slip.run.lockedAt).getTime() : 0;
  const salaryChanged = !!revision?.approvedAt && new Date(revision.approvedAt).getTime() > lockedAt;
  const kind: "salary" | "attendance" = salaryChanged ? "salary" : "attendance";
  return {
    kind,
    line: {
      kind,
      calendar,
      year: period.year,
      month: period.month,
      label: period.label,
      sourceRef: kind === "salary" ? `batch:${revision?.batchId ?? "unknown"}` : `attendance:${calendar}-${period.year}-${period.month}`,
      sourceSlipId: slip.id,
      paid,
      due: dueParts,
      diff,
    },
  };
}

/** Employees in scope (and in the chosen branches) with months to settle. */
export async function candidates(scope: ScopeFilter, input: Pick<NewRunInput, "branchIds" | "employeeIds">): Promise<ArrearsCandidate[]> {
  const people = (await attendanceRepo.findEmployees(buildEmployeeScopeCondition(scope))).filter((e) => input.branchIds.includes(e.branchId) && (!input.employeeIds.length || input.employeeIds.includes(e.id)));
  const ids = people.map((e) => e.id);
  const [slips, pending, all, systemControl] = await Promise.all([repo.findTouchedLockedSlips(ids), repo.findPendingArrearsItems(ids), repo.findMasterHeads(), systemControlRepository.findSettings()]);
  const byEmployee = new Map<string, ArrearsMonthLine[]>();
  for (const s of slips) {
    const { line } = await recomputeMonth(s, { all, systemControl });
    if (line) byEmployee.set(s.employeeId, [...(byEmployee.get(s.employeeId) ?? []), line]);
  }
  const out: ArrearsCandidate[] = [];
  for (const e of people) {
    const lines = byEmployee.get(e.id);
    if (!lines?.length) continue;
    const figures = arrearsSlipFigures(lines);
    const held = pending.find((p) => p.employeeId === e.id);
    out.push({
      employeeId: e.id,
      employeeName: e.fullName,
      employeeCode: e.employeeCode,
      lines: lines.sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month)),
      net: new Decimal(figures.grossEarnings).minus(figures.totalDeductions).toDecimalPlaces(2).toString(),
      blocked: held ? `Already in the arrears run of ${periodFor(parseCalendar(held.runCalendar), held.runYear, held.runMonth).label}` : null,
    });
  }
  return out.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

/**
 * The ARREARS run: the picked employees and months, recomputed here (the
 * screen's figures are never trusted), one payslip each with the differences
 * as earnings and deductions, taxed once through the projection.
 */
export async function generateArrearsRun(input: NewRunInput, ctx: { scope: ScopeFilter; userId: string }): Promise<PayrollRun> {
  const calendar: PeriodCalendar = await getPayCalendar();
  const period = periodFor(calendar, input.payPeriodYear, input.payPeriodMonth);
  const fy = await fiscalYearRepository.findFiscalYearForDate(period.end);
  if (!fy) throw new UserFacingError(`No fiscal year covers ${period.label}. Add it in Company setup → Fiscal years.`);
  const picks = input.picks ?? [];
  if (!picks.length) throw new UserFacingError("Tick at least one employee to pay arrears to.");
  const found = await candidates(ctx.scope, { branchIds: input.branchIds, employeeIds: picks.map((p) => p.employeeId) });
  const chosen = picks
    .map((p) => {
      const c = found.find((x) => x.employeeId === p.employeeId);
      if (!c) return null;
      const lines = c.lines.filter((l) => p.months.some((m) => m.calendar === l.calendar && m.year === l.year && m.month === l.month));
      return lines.length ? { ...c, lines } : null;
    })
    .filter((c): c is ArrearsCandidate => !!c);
  if (!chosen.length) throw new UserFacingError("Nothing is left to pay: the differences were paid or no longer exist. Check again.");
  const blocked = chosen.find((c) => c.blocked);
  if (blocked) throw new UserFacingError(`${blocked.employeeName}: ${blocked.blocked}.`);
  const [heads, { arrears, recovery }, systemControl, slabsAll, tax] = await Promise.all([
    repo.findMasterHeads(),
    repo.ensureArrearsPayHeads(),
    systemControlRepository.findSettings(),
    taxRateRepository.findAllSlabs(),
    taxInputsFor(chosen.map((c) => c.employeeId), fy.id, period, calendar),
  ]);
  const slabs = slabsAll.filter((x) => x.fiscalYearId === fy.id).map((s) => ({ id: s.id, category: s.category, amountFrom: s.amountFrom.toString(), amountTo: s.amountTo ? s.amountTo.toString() : null, ratePercent: s.ratePercent.toString(), fixedDeduction: s.fixedDeduction.toString() }));
  const tdsHead = heads.find((h) => h.isTdsHead);
  const pfHead = heads.find((h) => h.isPfHead);
  const ssfHead = heads.find((h) => isSsfDeductionHead(h));
  const ssfErHead = heads.find((h) => isSsfEmployerHead(h));
  const citHead = heads.find((h) => h.isCitHead);
  const [people, departments, designations] = await Promise.all([
    employeeRepository.findAll({ search: "", branchId: "all", departmentId: "all", category: "all", status: "all" }),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
  ]);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const desigName = new Map(designations.map((d) => [d.id, d.name]));
  const payslipDate = input.payslipDate;
  const run = await (await getDb()).transaction(async (tx) => {
    const created = await payrollRepo.createPayrollRun(
      {
        fiscalYearId: fy.id,
        calendar,
        runType: "ARREARS",
        payPeriodMonth: period.month,
        payPeriodYear: period.year,
        payPeriodStartDate: period.start,
        payPeriodEndDate: period.end,
        branchIds: input.branchIds,
        departmentIds: [],
        designationIds: [],
        employeeCategories: [],
        employeeIds: chosen.map((c) => c.employeeId),
        occasionalAllowanceHeadIds: [],
        payslipMonth: period.month,
        payslipDate,
        status: "DRAFT",
        totalGross: "0",
        totalDeductions: "0",
        totalNetPayable: "0",
        totalTds: "0",
        totalPf: "0",
        totalSsf: "0",
        employeeCount: chosen.length,
        generatedBy: ctx.userId,
      },
      tx
    );
    for (const c of chosen) {
      const emp = people.find((e) => e.id === c.employeeId);
      if (!emp) continue;
      const f = arrearsSlipFigures(c.lines);
      const projected = projectTds({
        employee: { id: emp.id, category: emp.category, gender: emp.gender, isDisabled: emp.isDisabled, taxStatus: emp.taxStatus, joiningDate: typeof emp.joiningDate === "string" ? emp.joiningDate : new Date(emp.joiningDate).toISOString().slice(0, 10) },
        taxSlabs: slabs,
        systemControl,
        monthlyGross: new Decimal(f.grossEarnings),
        taxableMonthlyGross: new Decimal(f.taxableGross),
        oneOffTaxable: new Decimal(f.taxableGross),
        retirementThisMonth: new Decimal(f.retirement),
        citThisMonth: new Decimal(f.cit),
        insuranceAnnual: new Decimal(0),
        ssfEnrolled: new Decimal(f.ssfEmployee).gt(0),
        ytd: tax.ytdOf(emp.id),
        monthsRemaining: tax.monthsRemaining,
      });
      const tds = projected.tdsThisMonth;
      const totalDeductions = new Decimal(f.totalDeductions).plus(tds);
      const net = new Decimal(f.grossEarnings).minus(totalDeductions);
      if (net.lt(0)) throw new UserFacingError(`${emp.fullName}: the recovery (${totalDeductions.toFixed(2)}) is more than the arrears (${f.grossEarnings}). Record the recovery on a regular run instead.`);
      const earnings = f.earnings.reduce((n, l) => n.plus(l.amount), new Decimal(0));
      const recoveries = f.deductions.filter((l) => l.label.startsWith("Recovery")).reduce((n, l) => n.plus(l.amount), new Decimal(0));
      const slipHeads: { payHeadId: string; payHeadName: string; headType: string; amount: string; calculatedAmount: string }[] = [];
      if (earnings.gt(0)) slipHeads.push({ payHeadId: arrears.id, payHeadName: arrears.name, headType: "allowance", amount: "0", calculatedAmount: earnings.toDecimalPlaces(2).toString() });
      if (recoveries.gt(0)) slipHeads.push({ payHeadId: recovery.id, payHeadName: recovery.name, headType: "deduction", amount: "0", calculatedAmount: recoveries.toDecimalPlaces(2).toString() });
      const statutory = (head: Head | undefined, amount: string) => {
        if (head && new Decimal(amount).gt(0)) slipHeads.push({ payHeadId: head.id, payHeadName: head.name, headType: head.type, amount: "0", calculatedAmount: amount });
      };
      statutory(pfHead, f.pfEmployee);
      statutory(ssfHead, f.ssfEmployee);
      statutory(ssfErHead, f.ssfEmployer);
      statutory(citHead, f.cit);
      if (tds.gt(0)) {
        if (!tdsHead) throw new UserFacingError("No pay head is marked as income tax (TDS). Add one in Setup → Pay heads.");
        slipHeads.push({ payHeadId: tdsHead.id, payHeadName: tdsHead.name, headType: "deduction", amount: "0", calculatedAmount: tds.toString() });
      }
      const pos = (v: string) => Decimal.max(0, new Decimal(v)).toDecimalPlaces(2).toString();
      await payrollRepo.createPayrollSlips(
        [
          {
            slip: {
              payrollRunId: created.id,
              employeeId: emp.id,
              employeeCode: emp.employeeCode,
              employeeName: emp.fullName,
              departmentName: deptName.get(emp.departmentId) ?? "",
              designationName: desigName.get(emp.designationId) ?? "",
              basicSalary: "0",
              gradeAmount: "0",
              grossEarnings: f.grossEarnings,
              totalDeductions: totalDeductions.toDecimalPlaces(2).toString(),
              netPayable: net.toDecimalPlaces(2).toString(),
              taxableIncome: f.taxableGross,
              tdsThisMonth: tds.toString(),
              pfEmployee: pos(f.pfEmployee),
              pfEmployer: pos(f.pfEmployer),
              ssfEmployee: pos(f.ssfEmployee),
              ssfEmployer: pos(f.ssfEmployer),
              citDeduction: pos(f.cit),
              loanDeduction: "0",
              absentDeduction: "0",
              otAmount: "0",
              fundDeduction: "0",
              taxDetail: projected.detail,
              arrearsDetail: c.lines,
              bankAccountNumber: emp.bankAccountNumber || "N/A",
              bankName: emp.bankName || "N/A",
              payslipMonth: period.month,
              payslipDate,
              status: "DRAFT",
              isYearEndReconciliation: projected.detail.monthsRemaining <= 1,
              warnings: null,
            },
            heads: slipHeads,
          },
        ],
        tx
      );
      const [slipRow] = await tx.select({ id: payrollSlips.id }).from(payrollSlips).where(and(eq(payrollSlips.payrollRunId, created.id), eq(payrollSlips.employeeId, emp.id)));
      if (slipRow) await repo.insertItems(slipRow.id, emp.id, c.lines, tx);
    }
    await recomputeTotals(created.id, tx);
    return created;
  });
  return run;
}
