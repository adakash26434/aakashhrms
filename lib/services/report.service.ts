import { getDb, getCurrentTenantSlug } from "@/lib/db";
import {
  payrollRuns,
  payrollSlips,
  payrollSlipHeads,
  employees,
  departments,
  designations,
  branches,
  fiscalYears,
  employeeLeaveBalances,
  leaveApplications,
  leaveTypes,
  loans,
  loanRepayments,
  loanTypes,
  users,
  systemConfig,
} from "@/lib/db/schema";
import { platformDb, ensurePlatformTablesExist } from "@/lib/platform/db";
import { companies } from "@/lib/platform/schema";
import { eq, inArray, desc, type SQL } from "drizzle-orm";
import * as payslipSheetService from "@/lib/services/payslip-sheet.service";
import { asRunType, isOffCycle, RUN_TYPE_LABEL } from "@/lib/constants/run-types";
import { UserFacingError } from "@/lib/errors/action-error";
import * as engine from "@/lib/engines/report.engine";
import * as attendanceService from "@/lib/services/attendance.service";
import { localClock } from "@/lib/engines/attendance-day.engine";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import { BS_MONTHS_EN, bsToAD, getDaysInBSMonth } from "@/lib/utils/bs-calendar";
import type {
  CompanyReportInfo,
  ReportFilterLookupData,
  ReportPayrollRunOption,
  SalarySheetFilter,
  SalarySheetReportData,
  SalarySheetRow,
  PayslipFilter,
  PayslipPrintData,
  PayslipHeadSummaryRow,
  AttendanceReportFilter,
  AttendanceReportData,
  AttendanceReportRow,
  AttendanceDailyDetail,
  LeaveReportFilter,
  LeaveReportData,
  LeaveBalanceRow,
  LeaveApplicationReportRow,
  LoanReportFilter,
  LoanReportData,
  LoanSummaryRow,
  LoanRepaymentLedgerRow,
} from "@/lib/types/report";

// ─── Filter Lookups ────────────────────────────────────────────────────────

export async function getCompanyReportInfo(): Promise<CompanyReportInfo> {
  const slug = await getCurrentTenantSlug();

  // 1. Resolve from platform companies table by slug
  if (slug) {
    try {
      await ensurePlatformTablesExist();
      const [comp] = await platformDb
        .select()
        .from(companies)
        .where(eq(companies.slug, slug))
        .limit(1);

      if (comp) {
        return {
          legalName: comp.legalName || comp.displayName || "Company Workspace",
          displayName: comp.displayName || comp.legalName || "Company Workspace",
          code: comp.companyCode,
          panVatNumber: comp.panVatNumber || undefined,
          contactPhone: comp.contactPhone || undefined,
          contactEmail: comp.contactEmail || undefined,
          headOfficeAddress: comp.headOfficeAddress || undefined,
        };
      }
    } catch (err) {
      console.error("Error fetching company from platformDb in report.service:", err);
    }
  }

  // 2. Fallback: check tenantDb systemConfig & branches
  try {
    const db = (await getDb());
    const [configs, branchList] = await Promise.all([
      db.select().from(systemConfig).catch(() => []),
      db.select().from(branches).limit(1).catch(() => []),
    ]);

    const configMap = new Map(configs.map((c) => [c.key, c.value]));
    const legalName = configMap.get("company_legal_name");
    const displayName = configMap.get("company_display_name");
    const panVat = configMap.get("company_pan_vat");
    const phone = configMap.get("company_phone") || branchList[0]?.phone;
    const address = configMap.get("company_office_address") || branchList[0]?.location;
    const email = configMap.get("company_contact_email") || branchList[0]?.email;
    const code = configMap.get("company_code") || branchList[0]?.code;

    if (legalName || displayName) {
      return {
        legalName: legalName || displayName || "Company Workspace",
        displayName: displayName || legalName || "Company Workspace",
        code: code || undefined,
        panVatNumber: panVat || undefined,
        contactPhone: phone || undefined,
        contactEmail: email || undefined,
        headOfficeAddress: address || undefined,
      };
    }
  } catch {
    // Ignore
  }

  // 3. Fallback: If platformDb has companies (e.g. single-tenant / local dev)
  try {
    await ensurePlatformTablesExist();
    const [firstComp] = await platformDb.select().from(companies).limit(1);
    if (firstComp) {
      return {
        legalName: firstComp.legalName || firstComp.displayName,
        displayName: firstComp.displayName || firstComp.legalName,
        code: firstComp.companyCode,
        panVatNumber: firstComp.panVatNumber || undefined,
        contactPhone: firstComp.contactPhone || undefined,
        contactEmail: firstComp.contactEmail || undefined,
        headOfficeAddress: firstComp.headOfficeAddress || undefined,
      };
    }
  } catch {
    // Ignore
  }

  return {
    legalName: "Company Workspace",
    displayName: "Company Workspace",
  };
}

export async function getReportFilterLookupData(): Promise<ReportFilterLookupData> {
  const [fyList, branchList, deptList, desigList, lockedRuns, lTypes, lnTypes, empList, companyInfo] = await Promise.all([
    (await getDb())
      .select({
        id: fiscalYears.id,
        label: fiscalYears.label,
        status: fiscalYears.status,
      })
      .from(fiscalYears)
      .orderBy(desc(fiscalYears.label)),

    (await getDb())
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .orderBy(branches.name),

    (await getDb())
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .orderBy(departments.name),

    (await getDb())
      .select({ id: designations.id, name: designations.name })
      .from(designations)
      .orderBy(designations.name),

    (await getDb())
      .select({
        id: payrollRuns.id,
        payPeriodMonth: payrollRuns.payPeriodMonth,
        payPeriodYear: payrollRuns.payPeriodYear,
        status: payrollRuns.status,
        runType: payrollRuns.runType,
        employeeCount: payrollRuns.employeeCount,
        totalNetPayable: payrollRuns.totalNetPayable,
      })
      .from(payrollRuns)
      .where(eq(payrollRuns.status, "LOCKED"))
      .orderBy(desc(payrollRuns.payPeriodYear), desc(payrollRuns.payPeriodMonth)),

    (await getDb())
      .select({ id: leaveTypes.id, name: leaveTypes.name, code: leaveTypes.code })
      .from(leaveTypes)
      .orderBy(leaveTypes.name),

    (await getDb())
      .select({ id: loanTypes.id, name: loanTypes.name })
      .from(loanTypes)
      .orderBy(loanTypes.name),

    (await getDb())
      .select({
        id: employees.id,
        fullName: employees.fullName,
        employeeCode: employees.employeeCode,
      })
      .from(employees)
      .orderBy(employees.fullName),

    getCompanyReportInfo(),
  ]);

  const lockedPayrollRuns: ReportPayrollRunOption[] = lockedRuns.map((r) => {
    const monthName = BS_MONTHS_EN[r.payPeriodMonth] || `Month ${r.payPeriodMonth}`;
    // F6: an off-cycle run says what it paid.
    const kind = isOffCycle(r.runType) ? ` · ${RUN_TYPE_LABEL[asRunType(r.runType)].en}` : "";
    return {
      id: r.id,
      label: `${monthName} ${r.payPeriodYear}${kind} (LOCKED)`,
      payPeriodMonth: r.payPeriodMonth,
      payPeriodYear: r.payPeriodYear,
      status: r.status,
      employeeCount: r.employeeCount ?? 0,
      totalNetPayable: r.totalNetPayable ?? "0.00",
    };
  });

  const formattedEmployees = empList.map((e) => ({
    id: e.id,
    name: e.fullName,
    employeeCode: e.employeeCode,
  }));

  return {
    company: companyInfo,
    fiscalYears: fyList,
    branches: branchList,
    departments: deptList,
    designations: desigList,
    lockedPayrollRuns,
    leaveTypes: lTypes,
    loanTypes: lnTypes,
    employees: formattedEmployees,
  };
}

// ─── Salary Sheet ──────────────────────────────────────────────────────────

export async function getSalarySheetData(
  filter: SalarySheetFilter
): Promise<SalarySheetReportData> {
  if (!filter.payrollRunId) {
    throw new Error("Payroll Run ID is required for Salary Sheet report.");
  }

  // 1. Load run details
  const [runRecord] = await (await getDb())
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, filter.payrollRunId))
    .limit(1);

  if (!runRecord) {
    throw new Error("Selected payroll run not found.");
  }

  const monthName =
    BS_MONTHS_EN[runRecord.payPeriodMonth] || `Month ${runRecord.payPeriodMonth}`;
  const runOption: ReportPayrollRunOption = {
    id: runRecord.id,
    label: `${monthName} ${runRecord.payPeriodYear} (${runRecord.status})`,
    payPeriodMonth: runRecord.payPeriodMonth,
    payPeriodYear: runRecord.payPeriodYear,
    status: runRecord.status,
    employeeCount: runRecord.employeeCount ?? 0,
    totalNetPayable: runRecord.totalNetPayable ?? "0.00",
  };

  // 2. Load slips for this run with optional branch/department/employee search filtering
  const slipRecords = await (await getDb())
    .select({
      slip: payrollSlips,
      branchId: employees.branchId,
      departmentId: employees.departmentId,
    })
    .from(payrollSlips)
    .innerJoin(employees, eq(payrollSlips.employeeId, employees.id))
    .where(eq(payrollSlips.payrollRunId, filter.payrollRunId));

  // Filter in-memory for optional filter criteria
  let filteredSlips = slipRecords;
  if (filter.branchId) {
    filteredSlips = filteredSlips.filter((s) => s.branchId === filter.branchId);
  }
  if (filter.departmentId) {
    filteredSlips = filteredSlips.filter(
      (s) => s.departmentId === filter.departmentId
    );
  }
  if (filter.employeeSearch && filter.employeeSearch.trim()) {
    const q = filter.employeeSearch.trim().toLowerCase();
    filteredSlips = filteredSlips.filter(
      (s) =>
        s.slip.employeeName.toLowerCase().includes(q) ||
        s.slip.employeeCode.toLowerCase().includes(q)
    );
  }

  const targetSlips = filteredSlips.map((item) => item.slip);

  if (targetSlips.length === 0) {
    return {
      run: runOption,
      rows: [],
      summary: engine.aggregateSalarySheetSummary([]),
      allAllowanceHeadNames: [],
      allDeductionHeadNames: [],
    };
  }

  // 3. Batch query all slip heads to avoid N+1 queries
  const slipIds = targetSlips.map((s) => s.id);
  const allHeads = await (await getDb())
    .select()
    .from(payrollSlipHeads)
    .where(inArray(payrollSlipHeads.payrollSlipId, slipIds));

  // Map heads by payrollSlipId
  const headsMap = new Map<string, typeof allHeads>();
  allHeads.forEach((head) => {
    const list = headsMap.get(head.payrollSlipId) || [];
    list.push(head);
    headsMap.set(head.payrollSlipId, list);
  });

  // Track unique dynamic allowance & deduction head names
  const allowanceNamesSet = new Set<string>();
  const deductionNamesSet = new Set<string>();

  // 4. Construct SalarySheetRow for each slip
  const rows: SalarySheetRow[] = targetSlips.map((slip) => {
    const slipHeads = headsMap.get(slip.id) || [];

    const allowances: { name: string; amount: string }[] = [];
    const deductions: { name: string; amount: string }[] = [];

    slipHeads.forEach((h) => {
      const lower = (h.payHeadName || "").toLowerCase();
      const isStatutoryDed =
        lower.includes("provident fund") ||
        lower.includes("epf") ||
        lower.includes("ssf") ||
        lower.includes("social security") ||
        lower.includes("citizen investment") ||
        lower.includes("cit");

      const headAmount = h.calculatedAmount || h.amount;
      if (h.headType === "allowance") {
        allowanceNamesSet.add(h.payHeadName);
        allowances.push({ name: h.payHeadName, amount: headAmount });
      } else if (h.headType === "deduction" && !isStatutoryDed) {
        deductionNamesSet.add(h.payHeadName);
        deductions.push({ name: h.payHeadName, amount: headAmount });
      }
    });

    return {
      employeeCode: slip.employeeCode,
      employeeName: slip.employeeName,
      departmentName: slip.departmentName,
      designationName: slip.designationName,
      basicSalary: slip.basicSalary || "0.00",
      gradeAmount: slip.gradeAmount || "0.00",
      otAmount: slip.otAmount || "0.00",
      allowanceHeads: allowances,
      grossEarnings: slip.grossEarnings || "0.00",
      absentDeduction: slip.absentDeduction || "0.00",
      pfEmployee: slip.pfEmployee || "0.00",
      tdsThisMonth: slip.tdsThisMonth || "0.00",
      ssfEmployee: slip.ssfEmployee || "0.00",
      citDeduction: slip.citDeduction || "0.00",
      loanDeduction: slip.loanDeduction || "0.00",
      deductionHeads: deductions,
      totalDeductions: slip.totalDeductions || "0.00",
      netPayable: slip.netPayable || "0.00",
      bankName: slip.bankName || "N/A",
      bankAccountNumberMasked: engine.maskAccountNumber(slip.bankAccountNumber),
      bankAccountNumberFull: slip.bankAccountNumber || "N/A",
    };
  });

  const allAllowanceHeadNames = Array.from(allowanceNamesSet).sort();
  const allDeductionHeadNames = Array.from(deductionNamesSet).sort();

  const summary = engine.aggregateSalarySheetSummary(rows);

  return {
    run: runOption,
    rows,
    summary,
    allAllowanceHeadNames,
    allDeductionHeadNames,
  };
}

// ─── Payslip Print ─────────────────────────────────────────────────────────

export async function getPayslipPrintData(
  filter: PayslipFilter,
  scope?: SQL
): Promise<PayslipPrintData[]> {
  if (!filter.payrollRunId) {
    throw new Error("Payroll Run ID is required for Payslip Print.");
  }

  // Load run
  const [runRecord] = await (await getDb())
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, filter.payrollRunId))
    .limit(1);

  if (!runRecord) {
    throw new Error("Payroll run not found.");
  }
  // F11: payslips are handed out from locked runs only (the figures can still change before).
  if (runRecord.status !== "LOCKED") {
    throw new UserFacingError("Payslips are printed from locked payroll runs only.");
  }

  const monthName =
    BS_MONTHS_EN[runRecord.payPeriodMonth] || `Month ${runRecord.payPeriodMonth}`;
  const runOption: ReportPayrollRunOption = {
    id: runRecord.id,
    label: `${monthName} ${runRecord.payPeriodYear} (${runRecord.status})`,
    payPeriodMonth: runRecord.payPeriodMonth,
    payPeriodYear: runRecord.payPeriodYear,
    status: runRecord.status,
    employeeCount: runRecord.employeeCount ?? 0,
    totalNetPayable: runRecord.totalNetPayable ?? "0.00",
  };

  // F11: the slips within the viewer's employee scope, with their bilingual sheets.
  const { items } = await payslipSheetService.sheetsForRun(filter.payrollRunId, { scope, employeeId: filter.employeeId });
  return items.map((item) => ({ run: runOption, slip: item.slip, heads: item.heads, sheet: item.sheet }));
}

// ─── Payslip Head Summary Report ──────────────────────────────────────────

export async function getPayslipHeadSummaryData(
  filter: SalarySheetFilter
): Promise<{ rows: PayslipHeadSummaryRow[]; runLabel: string }> {
  if (!filter.payrollRunId) {
    throw new Error("Payroll Run ID is required.");
  }

  const [runRecord] = await (await getDb())
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, filter.payrollRunId))
    .limit(1);

  if (!runRecord) throw new Error("Payroll run not found.");

  const monthName =
    BS_MONTHS_EN[runRecord.payPeriodMonth] || `Month ${runRecord.payPeriodMonth}`;
  const runLabel = `${monthName} ${runRecord.payPeriodYear}`;

  // Get all slips for the run
  const slips = await (await getDb())
    .select({ id: payrollSlips.id })
    .from(payrollSlips)
    .where(eq(payrollSlips.payrollRunId, filter.payrollRunId));

  if (slips.length === 0) return { rows: [], runLabel };

  const slipIds = slips.map((s) => s.id);
  const heads = await (await getDb())
    .select()
    .from(payrollSlipHeads)
    .where(inArray(payrollSlipHeads.payrollSlipId, slipIds));

  // Group by payHeadName + headType
  const summaryMap = new Map<
    string,
    {
      payHeadName: string;
      headType: "allowance" | "deduction";
      total: number;
      employeeCount: number;
      overrideCount: number;
    }
  >();

  heads.forEach((h) => {
    const key = `${h.headType}:${h.payHeadName}`;
    const existing = summaryMap.get(key) || {
      payHeadName: h.payHeadName,
      headType: h.headType as "allowance" | "deduction",
      total: 0,
      employeeCount: 0,
      overrideCount: 0,
    };

    existing.total += Number(h.calculatedAmount || h.amount) || 0;
    existing.employeeCount += 1;
    if (h.isManualOverride) existing.overrideCount += 1;

    summaryMap.set(key, existing);
  });

  const rows: PayslipHeadSummaryRow[] = Array.from(summaryMap.values()).map(
    (item) => ({
      payHeadName: item.payHeadName,
      headType: item.headType,
      totalAmount: item.total.toFixed(2),
      employeeCount: item.employeeCount,
      averageAmount: (item.employeeCount > 0 ? item.total / item.employeeCount : 0).toFixed(2),
      overrideCount: item.overrideCount,
    })
  );

  // Sort allowances first then deductions, then alphabetical by payHeadName
  rows.sort((a, b) => {
    if (a.headType !== b.headType) {
      return a.headType === "allowance" ? -1 : 1;
    }
    return a.payHeadName.localeCompare(b.payHeadName);
  });

  return { rows, runLabel };
}

// ─── Attendance Report ─────────────────────────────────────────────────────

export async function getAttendanceReportData(
  filter: AttendanceReportFilter,
  scope: ScopeFilter
): Promise<AttendanceReportData> {
  if (!filter.fiscalYearId || !filter.bsMonth) {
    throw new Error("Fiscal Year and BS Month are required for Attendance Report.");
  }

  const [fy] = await (await getDb())
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, filter.fiscalYearId))
    .limit(1);

  const startBsYear = fy?.startDateBS
    ? parseInt(fy.startDateBS.split("-")[0], 10)
    : (fy?.label ? parseInt(fy.label.match(/\d{4}/)?.[0] || "2081", 10) : 2081);
  const bsYear = filter.bsMonth >= 4 ? startBsYear : startBsYear + 1;
  const fiscalYearLabel = fy ? fy.label : "N/A";
  const monthLabel = engine.formatBSMonthLabel(filter.bsMonth, bsYear);
  const reportFormat = filter.reportFormat || "STATUTORY_SUMMARY";

  const daysInMonth = getDaysInBSMonth(bsYear, filter.bsMonth) || 30;

  // Build date headers for month with exact AD date mapping and day name resolution
  const dateHeaders = Array.from({ length: daysInMonth }, (_, idx) => {
    const dayNum = idx + 1;
    const dateStr = `${bsYear}-${String(filter.bsMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const adDate = bsToAD(bsYear, filter.bsMonth, dayNum);
    const isValidAd = adDate && !isNaN(adDate.getTime());
    const dayName = isValidAd
      ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][adDate.getDay()]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][idx % 7];
    const dateStrAD = isValidAd
      ? `${adDate.toLocaleString("en-US", { month: "short" })} ${adDate.getDate()}`
      : `Day ${dayNum}`;
    const adDateStr = isValidAd
      ? `${adDate.getFullYear()}-${String(adDate.getMonth() + 1).padStart(2, "0")}-${String(adDate.getDate()).padStart(2, "0")}`
      : "";

    return {
      dateStr,
      dateStrAD,
      dayNum,
      dayName,
      adDateStr,
    };
  });

  // 4.5: every day comes from the attendance rules (punches, approved leave, holidays,
  // weekly off, HR overrides), only for employees in the user's scope; closed months
  // use their stored pay figures. No times are made up for days without punches.
  const { people } = await attendanceService.reportMonth(scope, bsYear, filter.bsMonth, {
    branchId: filter.branchId || undefined,
    departmentId: filter.departmentId || undefined,
    designationId: filter.designationId || undefined,
    employeeId: filter.employeeId || undefined,
  });
  const [deptRows, desigRows] = await Promise.all([
    (await getDb()).select({ id: departments.id, name: departments.name }).from(departments),
    (await getDb()).select({ id: designations.id, name: designations.name }).from(designations),
  ]);
  const deptName = new Map(deptRows.map((d) => [d.id, d.name]));
  const desigName = new Map(desigRows.map((d) => [d.id, d.name]));
  const todayIso = nepalDateIso();
  const CODE: Record<string, string> = {
    present: "P",
    on_duty: "P",
    half_day: "HD",
    absent: "A",
    missing_punch: "A",
    paid_leave: "L",
    unpaid_leave: "LWOP",
    holiday: "HO",
    weekly_off: "OFF",
    not_employed: "-",
  };
  const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const fmt = (n: number) => String(Math.round(n * 100) / 100);

  const rows: AttendanceReportRow[] = people.map((p) => {
    const m = p.summary;
    const dailyDetails: AttendanceDailyDetail[] = p.days.map((d, i) => ({
      dateStr: dateHeaders[i]?.dateStr ?? d.date,
      dayNum: i + 1,
      inTime: d.date > todayIso ? "-" : localClock(d.firstIn) || "-",
      outTime: d.date > todayIso ? "-" : localClock(d.lastOut) || "-",
      workHours: hhmm(d.workMinutes),
      statusCode: d.date > todayIso ? "-" : CODE[d.dayType] ?? "-",
    }));
    const workMinutes = p.days.reduce((n, d) => n + d.workMinutes, 0);
    return {
      employeeCode: p.employeeCode,
      employeeName: p.fullName,
      departmentName: deptName.get(p.departmentId) || "Unassigned",
      designationName: desigName.get(p.designationId) || "Staff",
      totalWorkingDays: fmt(m.calendarDays - m.notEmployedDays),
      presentDays: fmt(m.presentDays + m.onDutyDays + m.halfDays * 0.5),
      payLeaveDays: fmt(m.paidLeaveDays),
      nonPayLeaveDays: fmt(m.unpaidLeaveDays),
      absentDays: fmt(m.absentDays + m.missingPunchDays + m.halfDays * 0.5),
      totalOtHoursOffice: fmt(m.otWorkDayMinutes / 60),
      totalOtHoursOff: fmt(m.otOffDayMinutes / 60),
      otEarnedAmount: p.amounts.otEarnedAmount,
      leaveDeductionAmount: p.amounts.leaveDeductionAmount,
      totalWorkHours: `${Math.floor(workMinutes / 60)}:${String(workMinutes % 60).padStart(2, "0")}`,
      dailyDetails,
    };
  });
  const isLocked = people.length > 0 && people.every((p) => p.amounts.closed);

  return {
    monthLabel,
    fiscalYearLabel,
    reportFormat,
    dateHeaders,
    rows,
    totalEmployees: rows.length,
    isLocked,
  };
}

// ─── Leave Report ─────────────────────────────────────────────────────────

export async function getLeaveReportData(
  filter: LeaveReportFilter
): Promise<LeaveReportData> {
  if (!filter.fiscalYearId) {
    throw new Error("Fiscal Year is required for Leave Report.");
  }

  const [fy] = await (await getDb())
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, filter.fiscalYearId))
    .limit(1);

  const fiscalYearLabel = fy ? fy.label : "N/A";

  // 1. Fetch Leave Balances
  const balancesRaw = await (await getDb())
    .select({
      bal: employeeLeaveBalances,
      empCode: employees.employeeCode,
      empName: employees.fullName,
      deptName: departments.name,
      branchId: employees.branchId,
      deptId: employees.departmentId,
      leaveName: leaveTypes.name,
      leaveCode: leaveTypes.code,
      isStatutory: leaveTypes.isStatutory,
      isEncashable: leaveTypes.isEncashable,
    })
    .from(employeeLeaveBalances)
    .innerJoin(employees, eq(employeeLeaveBalances.employeeId, employees.id))
    .innerJoin(leaveTypes, eq(employeeLeaveBalances.leaveTypeId, leaveTypes.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(eq(employeeLeaveBalances.fiscalYearId, filter.fiscalYearId));

  let filteredBalances = balancesRaw;
  if (filter.leaveTypeId) {
    filteredBalances = filteredBalances.filter((b) => b.bal.leaveTypeId === filter.leaveTypeId);
  }
  if (filter.branchId) {
    filteredBalances = filteredBalances.filter((b) => b.branchId === filter.branchId);
  }
  if (filter.departmentId) {
    filteredBalances = filteredBalances.filter((b) => b.deptId === filter.departmentId);
  }
  if (filter.employeeSearch && filter.employeeSearch.trim()) {
    const q = filter.employeeSearch.trim().toLowerCase();
    filteredBalances = filteredBalances.filter(
      (b) =>
        b.empCode.toLowerCase().includes(q) ||
        b.empName.toLowerCase().includes(q)
    );
  }

  const balanceRows: LeaveBalanceRow[] = filteredBalances.map((b) => ({
    employeeCode: b.empCode,
    employeeName: b.empName,
    departmentName: b.deptName || "Unassigned",
    leaveTypeName: b.leaveName,
    leaveTypeCode: b.leaveCode,
    isStatutory: b.isStatutory,
    allotted: String(b.bal.allotted ?? "0"),
    taken: String(b.bal.taken ?? "0"),
    carriedForward: String(b.bal.carriedForward ?? "0"),
    balance: String(b.bal.balance ?? "0"),
    isEncashable: b.isEncashable,
  }));

  // 2. Fetch Leave Applications Log
  const appsRaw = await (await getDb())
    .select({
      app: leaveApplications,
      empCode: employees.employeeCode,
      empName: employees.fullName,
      deptName: departments.name,
      branchId: employees.branchId,
      deptId: employees.departmentId,
      leaveName: leaveTypes.name,
      reviewerName: users.email,
    })
    .from(leaveApplications)
    .innerJoin(employees, eq(leaveApplications.employeeId, employees.id))
    .innerJoin(leaveTypes, eq(leaveApplications.leaveTypeId, leaveTypes.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(users, eq(leaveApplications.reviewedById, users.id))
    .where(eq(leaveApplications.fiscalYearId, filter.fiscalYearId));

  let filteredApps = appsRaw;
  if (filter.leaveTypeId) {
    filteredApps = filteredApps.filter((a) => a.app.leaveTypeId === filter.leaveTypeId);
  }
  if (filter.branchId) {
    filteredApps = filteredApps.filter((a) => a.branchId === filter.branchId);
  }
  if (filter.departmentId) {
    filteredApps = filteredApps.filter((a) => a.deptId === filter.departmentId);
  }
  if (filter.employeeSearch && filter.employeeSearch.trim()) {
    const q = filter.employeeSearch.trim().toLowerCase();
    filteredApps = filteredApps.filter(
      (a) =>
        a.empCode.toLowerCase().includes(q) ||
        a.empName.toLowerCase().includes(q)
    );
  }

  const applicationRows: LeaveApplicationReportRow[] = filteredApps.map((a) => ({
    id: a.app.id,
    employeeCode: a.empCode,
    employeeName: a.empName,
    departmentName: a.deptName || "Unassigned",
    leaveTypeName: a.leaveName,
    appliedDate: String(a.app.appliedDate),
    effectiveFrom: String(a.app.effectiveFrom),
    effectiveTo: String(a.app.effectiveTo),
    duration: a.app.duration,
    noOfDays: String(a.app.noOfDays),
    reason: a.app.reason,
    status: a.app.status,
    reviewedBy: a.reviewerName || null,
  }));

  // Unique employee count in balances
  const uniqueEmployees = new Set(balanceRows.map((b) => b.employeeCode)).size;

  const totalDaysTaken = engine.sumDecimalStrings(balanceRows.map((b) => b.taken));
  const totalDaysAllotted = engine.sumDecimalStrings(balanceRows.map((b) => b.allotted));
  const totalEncashableBalance = engine.sumDecimalStrings(
    balanceRows.filter((b) => b.isEncashable).map((b) => b.balance)
  );

  return {
    fiscalYearLabel,
    balanceRows,
    applicationRows,
    totalEmployees: uniqueEmployees,
    totalDaysTaken,
    totalDaysAllotted,
    totalEncashableBalance,
  };
}

// ─── Loan Report ──────────────────────────────────────────────────────────

/** The loan report within the viewer's employee scope (4.10: it read every branch). */
export async function getLoanReportData(
  filter: LoanReportFilter,
  scopeCondition?: SQL<unknown>
): Promise<LoanReportData> {
  // 1. Fetch Loan Disbursements / Summaries
  const loansRaw = await (await getDb())
    .select({
      loan: loans,
      empCode: employees.employeeCode,
      empName: employees.fullName,
      deptName: departments.name,
      branchId: employees.branchId,
      deptId: employees.departmentId,
      loanName: loanTypes.name,
    })
    .from(loans)
    .innerJoin(employees, eq(loans.employeeId, employees.id))
    .innerJoin(loanTypes, eq(loans.loanTypeId, loanTypes.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(scopeCondition);

  let filteredLoans = loansRaw;
  if (filter.status && filter.status !== "ALL") {
    filteredLoans = filteredLoans.filter((l) => l.loan.status === filter.status);
  }
  if (filter.loanTypeId) {
    filteredLoans = filteredLoans.filter((l) => l.loan.loanTypeId === filter.loanTypeId);
  }
  if (filter.branchId) {
    filteredLoans = filteredLoans.filter((l) => l.branchId === filter.branchId);
  }
  if (filter.departmentId) {
    filteredLoans = filteredLoans.filter((l) => l.deptId === filter.departmentId);
  }
  if (filter.employeeSearch && filter.employeeSearch.trim()) {
    const q = filter.employeeSearch.trim().toLowerCase();
    filteredLoans = filteredLoans.filter(
      (l) =>
        l.empCode.toLowerCase().includes(q) ||
        l.empName.toLowerCase().includes(q)
    );
  }

  const summaryRows: LoanSummaryRow[] = filteredLoans.map((l) => ({
    loanId: l.loan.id,
    employeeCode: l.empCode,
    employeeName: l.empName,
    departmentName: l.deptName || "Unassigned",
    loanTypeName: l.loanName,
    givenDate: String(l.loan.givenDate),
    loanAmount: String(l.loan.loanAmount),
    installmentAmount: String(l.loan.installmentAmount),
    noOfInstallments: l.loan.noOfInstallments,
    totalReturned: String(l.loan.totalReturned ?? "0.00"),
    remainingAmount: String(l.loan.remainingAmount ?? "0.00"),
    status: l.loan.status as "ACTIVE" | "CLOSED",
  }));

  // 2. Fetch Loan Repayments Ledger
  const repaymentsRaw = await (await getDb())
    .select({
      rep: loanRepayments,
      loanTypeId: loans.loanTypeId,
      empCode: employees.employeeCode,
      empName: employees.fullName,
      deptName: departments.name,
      branchId: employees.branchId,
      deptId: employees.departmentId,
      loanName: loanTypes.name,
      runMonth: payrollRuns.payPeriodMonth,
      runYear: payrollRuns.payPeriodYear,
    })
    .from(loanRepayments)
    .innerJoin(loans, eq(loanRepayments.loanId, loans.id))
    .innerJoin(employees, eq(loanRepayments.employeeId, employees.id))
    .innerJoin(loanTypes, eq(loans.loanTypeId, loanTypes.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(payrollSlips, eq(loanRepayments.payrollSlipId, payrollSlips.id))
    .leftJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(scopeCondition);

  let filteredRepayments = repaymentsRaw;
  if (filter.loanTypeId) {
    filteredRepayments = filteredRepayments.filter((r) => r.loanTypeId === filter.loanTypeId);
  }
  if (filter.branchId) {
    filteredRepayments = filteredRepayments.filter((r) => r.branchId === filter.branchId);
  }
  if (filter.departmentId) {
    filteredRepayments = filteredRepayments.filter((r) => r.deptId === filter.departmentId);
  }
  if (filter.employeeSearch && filter.employeeSearch.trim()) {
    const q = filter.employeeSearch.trim().toLowerCase();
    filteredRepayments = filteredRepayments.filter(
      (r) =>
        r.empCode.toLowerCase().includes(q) ||
        r.empName.toLowerCase().includes(q)
    );
  }

  const repaymentRows: LoanRepaymentLedgerRow[] = filteredRepayments.map((r) => {
    let runLabel: string | undefined = undefined;
    if (r.runMonth && r.runYear) {
      const monthName = BS_MONTHS_EN[r.runMonth] || `Month ${r.runMonth}`;
      runLabel = `${monthName} ${r.runYear}`;
    }

    return {
      repaymentId: r.rep.id,
      employeeCode: r.empCode,
      employeeName: r.empName,
      departmentName: r.deptName || "Unassigned",
      loanTypeName: r.loanName,
      repaymentDate: String(r.rep.repaymentDate),
      amountPaid: String(r.rep.amountPaid),
      paymentMethod: r.rep.paymentMethod as "CASH" | "SALARY_DEDUCTION" | "SETTLEMENT",
      payrollRunLabel: runLabel,
    };
  });

  const totalLoansCount = summaryRows.length;
  const activeLoansCount = summaryRows.filter((s) => s.status === "ACTIVE").length;
  const totalDisbursedAmount = engine.sumDecimalStrings(summaryRows.map((s) => s.loanAmount));
  const totalReturnedAmount = engine.sumDecimalStrings(summaryRows.map((s) => s.totalReturned));
  const totalRemainingBalance = engine.sumDecimalStrings(summaryRows.map((s) => s.remainingAmount));

  return {
    summaryRows,
    repaymentRows,
    totalLoansCount,
    activeLoansCount,
    totalDisbursedAmount,
    totalReturnedAmount,
    totalRemainingBalance,
  };
}

