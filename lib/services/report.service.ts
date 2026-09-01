import { getDb } from "@/lib/db";
import {
  payrollRuns,
  payrollSlips,
  payrollSlipHeads,
  leaveOtCalculations,
  employees,
  employeePersonal,
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
  attendanceRecords,
} from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import * as engine from "@/lib/engines/report.engine";
import { BS_MONTHS_EN, bsToAD } from "@/lib/utils/bs-calendar";
import { NepaliDate } from "nepali-date-library";
import type {
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
  TDSReportFilter,
  TDSReportData,
  TDSReportRow,
  LeaveReportFilter,
  LeaveReportData,
  LeaveBalanceRow,
  LeaveApplicationReportRow,
  LoanReportFilter,
  LoanReportData,
  LoanSummaryRow,
  LoanRepaymentLedgerRow,
} from "@/lib/types/report";
import type { PayrollSlip, PayrollSlipHead } from "@/lib/types/payroll";

// ─── Filter Lookups ────────────────────────────────────────────────────────

export async function getReportFilterLookupData(): Promise<ReportFilterLookupData> {
  const [fyList, branchList, deptList, desigList, lockedRuns, lTypes, lnTypes, empList] = await Promise.all([
    getDb()
      .select({
        id: fiscalYears.id,
        label: fiscalYears.label,
        status: fiscalYears.status,
      })
      .from(fiscalYears)
      .orderBy(desc(fiscalYears.label)),

    getDb()
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .orderBy(branches.name),

    getDb()
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .orderBy(departments.name),

    getDb()
      .select({ id: designations.id, name: designations.name })
      .from(designations)
      .orderBy(designations.name),

    getDb()
      .select({
        id: payrollRuns.id,
        payPeriodMonth: payrollRuns.payPeriodMonth,
        payPeriodYear: payrollRuns.payPeriodYear,
        status: payrollRuns.status,
        employeeCount: payrollRuns.employeeCount,
        totalNetPayable: payrollRuns.totalNetPayable,
      })
      .from(payrollRuns)
      .where(eq(payrollRuns.status, "LOCKED"))
      .orderBy(desc(payrollRuns.payPeriodYear), desc(payrollRuns.payPeriodMonth)),

    getDb()
      .select({ id: leaveTypes.id, name: leaveTypes.name, code: leaveTypes.code })
      .from(leaveTypes)
      .orderBy(leaveTypes.name),

    getDb()
      .select({ id: loanTypes.id, name: loanTypes.name })
      .from(loanTypes)
      .orderBy(loanTypes.name),

    getDb()
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        employeeCode: employees.employeeCode,
      })
      .from(employees)
      .orderBy(employees.firstName),
  ]);

  const lockedPayrollRuns: ReportPayrollRunOption[] = lockedRuns.map((r) => {
    const monthName = BS_MONTHS_EN[r.payPeriodMonth] || `Month ${r.payPeriodMonth}`;
    return {
      id: r.id,
      label: `${monthName} ${r.payPeriodYear} (LOCKED)`,
      payPeriodMonth: r.payPeriodMonth,
      payPeriodYear: r.payPeriodYear,
      status: r.status,
      employeeCount: r.employeeCount ?? 0,
      totalNetPayable: r.totalNetPayable ?? "0.00",
    };
  });

  const formattedEmployees = empList.map((e) => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    employeeCode: e.employeeCode,
  }));

  return {
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
  const [runRecord] = await getDb()
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
  const slipRecords = await getDb()
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
  const allHeads = await getDb()
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
      if (h.headType === "allowance") {
        allowanceNamesSet.add(h.payHeadName);
        allowances.push({ name: h.payHeadName, amount: h.amount });
      } else if (h.headType === "deduction") {
        deductionNamesSet.add(h.payHeadName);
        deductions.push({ name: h.payHeadName, amount: h.amount });
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
  filter: PayslipFilter
): Promise<PayslipPrintData[]> {
  if (!filter.payrollRunId) {
    throw new Error("Payroll Run ID is required for Payslip Print.");
  }

  // Load run
  const [runRecord] = await getDb()
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, filter.payrollRunId))
    .limit(1);

  if (!runRecord) {
    throw new Error("Payroll run not found.");
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

  // Load slips
  const rawSlips = await getDb()
    .select()
    .from(payrollSlips)
    .where(eq(payrollSlips.payrollRunId, filter.payrollRunId));

  let targetSlips = rawSlips;

  if (filter.employeeId) {
    targetSlips = rawSlips.filter((s) => s.employeeId === filter.employeeId);
  }

  if (targetSlips.length === 0) return [];

  // Batch query heads
  const slipIds = targetSlips.map((s) => s.id);
  const allHeads = await getDb()
    .select()
    .from(payrollSlipHeads)
    .where(inArray(payrollSlipHeads.payrollSlipId, slipIds));

  const headsMap = new Map<string, PayrollSlipHead[]>();
  allHeads.forEach((h) => {
    const list = headsMap.get(h.payrollSlipId) || [];
    list.push(h as PayrollSlipHead);
    headsMap.set(h.payrollSlipId, list);
  });

  return targetSlips.map((slip) => ({
    run: runOption,
    slip: slip as unknown as PayrollSlip,
    heads: headsMap.get(slip.id) || [],
  }));
}

// ─── Payslip Head Summary Report ──────────────────────────────────────────

export async function getPayslipHeadSummaryData(
  filter: SalarySheetFilter
): Promise<{ rows: PayslipHeadSummaryRow[]; runLabel: string }> {
  if (!filter.payrollRunId) {
    throw new Error("Payroll Run ID is required.");
  }

  const [runRecord] = await getDb()
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, filter.payrollRunId))
    .limit(1);

  if (!runRecord) throw new Error("Payroll run not found.");

  const monthName =
    BS_MONTHS_EN[runRecord.payPeriodMonth] || `Month ${runRecord.payPeriodMonth}`;
  const runLabel = `${monthName} ${runRecord.payPeriodYear}`;

  // Get all slips for the run
  const slips = await getDb()
    .select({ id: payrollSlips.id })
    .from(payrollSlips)
    .where(eq(payrollSlips.payrollRunId, filter.payrollRunId));

  if (slips.length === 0) return { rows: [], runLabel };

  const slipIds = slips.map((s) => s.id);
  const heads = await getDb()
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

    existing.total += Number(h.amount) || 0;
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
  filter: AttendanceReportFilter
): Promise<AttendanceReportData> {
  if (!filter.fiscalYearId || !filter.bsMonth) {
    throw new Error("Fiscal Year and BS Month are required for Attendance Report.");
  }

  const [fy] = await getDb()
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

  // Build 30 date headers for month with exact AD date mapping and day name resolution
  const dateHeaders = Array.from({ length: 30 }, (_, idx) => {
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

  // Query daily punches for details
  const dailyPunches = await getDb()
    .select({
      empId: attendanceRecords.employeeId,
      attendanceDate: attendanceRecords.attendanceDate,
      inTime: attendanceRecords.inTime,
      outTime: attendanceRecords.outTime,
      workHours: attendanceRecords.workHours,
      status: attendanceRecords.status,
    })
    .from(attendanceRecords)
    .where(eq(attendanceRecords.fiscalYearId, filter.fiscalYearId));

  const empPunchesMap = new Map<string, typeof dailyPunches>();
  for (const p of dailyPunches) {
    const list = empPunchesMap.get(p.empId) || [];
    list.push(p);
    empPunchesMap.set(p.empId, list);
  }

  // Query leaveOtCalculations join employees, departments & designations
  const records = await getDb()
    .select({
      calc: leaveOtCalculations,
      empId: employees.id,
      empCode: employees.employeeCode,
      empFirst: employees.firstName,
      empLast: employees.lastName,
      deptName: departments.name,
      desigName: designations.name,
      branchId: employees.branchId,
      deptId: employees.departmentId,
      desigId: employees.designationId,
    })
    .from(leaveOtCalculations)
    .innerJoin(employees, eq(leaveOtCalculations.employeeId, employees.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(designations, eq(employees.designationId, designations.id))
    .where(
      and(
        eq(leaveOtCalculations.fiscalYearId, filter.fiscalYearId),
        eq(leaveOtCalculations.bsMonth, filter.bsMonth)
      )
    );

  let filtered = records;
  if (filter.branchId) {
    filtered = filtered.filter((r) => r.branchId === filter.branchId);
  }
  if (filter.departmentId) {
    filtered = filtered.filter((r) => r.deptId === filter.departmentId);
  }
  if (filter.designationId) {
    filtered = filtered.filter((r) => r.desigId === filter.designationId);
  }
  if (filter.employeeId) {
    filtered = filtered.filter((r) => r.empId === filter.employeeId);
  }

  const todayBS = new NepaliDate();
  const currentBsYear = todayBS.getYear();
  const currentBsMonth = todayBS.getMonth() + 1;
  const currentBsDay = todayBS.getDate();
  const isFutureMonth = bsYear > currentBsYear || (bsYear === currentBsYear && filter.bsMonth > currentBsMonth);

  // Helper to build real daily attendance details without synthesizing fake default punches
  const generateDailyDetails = (empId?: string | null): AttendanceDailyDetail[] => {
    const empPunches = empId ? (empPunchesMap.get(empId) || []) : [];
    return dateHeaders.map((dh) => {
      // Check if an explicit manual punch record exists for this employee on this date
      const found = empPunches.find(
        (p) =>
          p.attendanceDate === dh.dateStr ||
          p.attendanceDate === dh.adDateStr ||
          p.attendanceDate.endsWith(`-${String(dh.dayNum).padStart(2, "0")}`)
      );

      if (found) {
        let code = "P";
        if (found.status === "Absent") code = "A";
        else if (found.status === "On Leave") code = "L";
        else if (found.status === "Half Day") code = "HD";
        else if (found.status === "LWOP") code = "LWOP";
        else if (found.status === "Holiday") code = "HO";
        else if (found.status === "Weekly Off" || found.status === "Off Day") code = "OFF";

        return {
          dateStr: dh.dateStr,
          dayNum: dh.dayNum,
          inTime: found.inTime || (code === "P" || code === "HD" ? "09:00 AM" : "-"),
          outTime: found.outTime || (code === "P" || code === "HD" ? "05:00 PM" : "-"),
          workHours: found.workHours ? String(found.workHours) : (code === "P" ? "08:00" : code === "HD" ? "04:00" : "00:00"),
          statusCode: code,
        };
      }

      // Check if this is a future day (days past today in current month or future months)
      const isFutureDay =
        isFutureMonth ||
        (bsYear === currentBsYear && filter.bsMonth === currentBsMonth && dh.dayNum > currentBsDay);

      if (isFutureDay) {
        return {
          dateStr: dh.dateStr,
          dayNum: dh.dayNum,
          inTime: "-",
          outTime: "-",
          workHours: "00:00",
          statusCode: "-",
        };
      }

      // Check for Weekly Off (Saturday / Sunday) in Corporate Calendar
      if (dh.dayName === "Sat" || dh.dayName === "Sun") {
        return {
          dateStr: dh.dateStr,
          dayNum: dh.dayNum,
          inTime: "-",
          outTime: "-",
          workHours: "00:00",
          statusCode: "OFF",
        };
      }

      // Past weekday without explicit manual attendance punch: Unposted / Absent
      return {
        dateStr: dh.dateStr,
        dayNum: dh.dayNum,
        inTime: "-",
        outTime: "-",
        workHours: "00:00",
        statusCode: "A",
      };
    });
  };

  let isLocked = false;
  let rows: AttendanceReportRow[] = [];

  if (filtered.length > 0) {
    isLocked = filtered.every((r) => r.calc.isLocked);
    rows = filtered.map((r) => {
      const dailyDetails = generateDailyDetails(r.empId);

      const totalWorkMins = dailyDetails.reduce((sum, d) => {
        if (!d.workHours || d.workHours === "00:00" || d.workHours === "-") return sum;
        const parts = d.workHours.split(":");
        const hrs = parseInt(parts[0] || "0", 10);
        const mins = parseInt(parts[1] || "0", 10);
        return sum + (hrs * 60 + mins);
      }, 0);

      const totalWorkHours = `${Math.floor(totalWorkMins / 60)}:${String(totalWorkMins % 60).padStart(2, "0")}`;

      return {
        employeeCode: r.empCode,
        employeeName: `${r.empFirst} ${r.empLast}`.trim(),
        departmentName: r.deptName || "Unassigned",
        designationName: r.desigName || "Staff",
        totalWorkingDays: String(r.calc.totalWorkingDays ?? 30),
        presentDays: String(r.calc.presentDays ?? 30),
        payLeaveDays: String(r.calc.payLeaveDays ?? 0),
        nonPayLeaveDays: String(r.calc.nonPayLeaveDays ?? 0),
        absentDays: String(r.calc.absentDays ?? 0),
        totalOtHoursOffice: String(r.calc.totalOtHoursOffice ?? 0),
        totalOtHoursOff: String(r.calc.totalOtHoursOff ?? 0),
        otEarnedAmount: String(r.calc.otEarnedAmount ?? "0.00"),
        leaveDeductionAmount: String(r.calc.leaveDeductionAmount ?? "0.00"),
        totalWorkHours,
        dailyDetails,
      };
    });
  } else {
    // Fallback 1: Query generated payrollSlips for this period
    const slips = await getDb()
      .select({
        slip: payrollSlips,
        run: payrollRuns,
        empId: employees.id,
        empBranchId: employees.branchId,
        empDeptId: employees.departmentId,
        empDesigId: employees.designationId,
        desigName: designations.name,
      })
      .from(payrollSlips)
      .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
      .leftJoin(employees, eq(payrollSlips.employeeId, employees.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .where(
        and(
          eq(payrollRuns.fiscalYearId, filter.fiscalYearId),
          eq(payrollRuns.payPeriodMonth, filter.bsMonth)
        )
      );

    let filteredSlips = slips;
    if (filter.branchId) {
      filteredSlips = filteredSlips.filter((s) => s.empBranchId === filter.branchId);
    }
    if (filter.departmentId) {
      filteredSlips = filteredSlips.filter((s) => s.empDeptId === filter.departmentId);
    }
    if (filter.designationId) {
      filteredSlips = filteredSlips.filter((s) => s.empDesigId === filter.designationId);
    }
    if (filter.employeeId) {
      filteredSlips = filteredSlips.filter((s) => s.empId === filter.employeeId);
    }

    if (filteredSlips.length > 0) {
      isLocked = filteredSlips.every((s) => s.run.status === "LOCKED" || s.run.status === "APPROVED");
      rows = filteredSlips.map((s) => {
        const absentDed = Number(s.slip.absentDeduction || 0);
        const absentCount = absentDed > 0 ? Math.ceil(absentDed / (Number(s.slip.basicSalary) / 30)) : 0;
        const presentCount = Math.max(0, 30 - absentCount);

        const dailyDetails = generateDailyDetails(s.empId);
        const totalWorkMins = dailyDetails.reduce((sum, d) => {
          if (!d.workHours || d.workHours === "00:00" || d.workHours === "-") return sum;
          const parts = d.workHours.split(":");
          const hrs = parseInt(parts[0] || "0", 10);
          const mins = parseInt(parts[1] || "0", 10);
          return sum + (hrs * 60 + mins);
        }, 0);
        const totalWorkHours = `${Math.floor(totalWorkMins / 60)}:${String(totalWorkMins % 60).padStart(2, "0")}`;

        return {
          employeeCode: s.slip.employeeCode,
          employeeName: s.slip.employeeName,
          departmentName: s.slip.departmentName || "Unassigned",
          designationName: s.desigName || s.slip.designationName || "Staff",
          totalWorkingDays: "30",
          presentDays: String(presentCount),
          payLeaveDays: "0",
          nonPayLeaveDays: "0",
          absentDays: String(absentCount),
          totalOtHoursOffice: String(Number(s.slip.otAmount) > 0 ? (Number(s.slip.otAmount) / 250).toFixed(1) : "0"),
          totalOtHoursOff: "0",
          otEarnedAmount: String(s.slip.otAmount || "0.00"),
          leaveDeductionAmount: String(s.slip.absentDeduction || "0.00"),
          totalWorkHours,
          dailyDetails,
        };
      });
    } else {
      // Fallback 2: Query all active employees in company
      const activeEmps = await getDb()
        .select({
          empId: employees.id,
          empCode: employees.employeeCode,
          empFirst: employees.firstName,
          empLast: employees.lastName,
          deptName: departments.name,
          desigName: designations.name,
          branchId: employees.branchId,
          deptId: employees.departmentId,
          desigId: employees.designationId,
        })
        .from(employees)
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(designations, eq(employees.designationId, designations.id))
        .where(eq(employees.status, "ACTIVE"));

      let filteredEmps = activeEmps;
      if (filter.branchId) {
        filteredEmps = filteredEmps.filter((e) => e.branchId === filter.branchId);
      }
      if (filter.departmentId) {
        filteredEmps = filteredEmps.filter((e) => e.deptId === filter.departmentId);
      }
      if (filter.designationId) {
        filteredEmps = filteredEmps.filter((e) => e.desigId === filter.designationId);
      }
      if (filter.employeeId) {
        filteredEmps = filteredEmps.filter((e) => e.empId === filter.employeeId);
      }

      rows = filteredEmps.map((e) => {
        const dailyDetails = generateDailyDetails(e.empId);
        const totalWorkMins = dailyDetails.reduce((sum, d) => {
          if (!d.workHours || d.workHours === "00:00" || d.workHours === "-") return sum;
          const parts = d.workHours.split(":");
          const hrs = parseInt(parts[0] || "0", 10);
          const mins = parseInt(parts[1] || "0", 10);
          return sum + (hrs * 60 + mins);
        }, 0);
        const totalWorkHours = `${Math.floor(totalWorkMins / 60)}:${String(totalWorkMins % 60).padStart(2, "0")}`;

        return {
          employeeCode: e.empCode,
          employeeName: `${e.empFirst} ${e.empLast}`.trim(),
          departmentName: e.deptName || "Unassigned",
          designationName: e.desigName || "Staff",
          totalWorkingDays: "30",
          presentDays: "30",
          payLeaveDays: "0",
          nonPayLeaveDays: "0",
          absentDays: "0",
          totalOtHoursOffice: "0",
          totalOtHoursOff: "0",
          otEarnedAmount: "0.00",
          leaveDeductionAmount: "0.00",
          totalWorkHours,
          dailyDetails,
        };
      });
    }
  }

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

// ─── TDS / IRD Report ──────────────────────────────────────────────────────

export async function getTDSReportData(
  filter: TDSReportFilter
): Promise<TDSReportData> {
  if (!filter.fiscalYearId) {
    throw new Error("Fiscal Year is required for TDS/IRD Report.");
  }

  const [fy] = await getDb()
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, filter.fiscalYearId))
    .limit(1);

  const fiscalYearLabel = fy ? fy.label : "N/A";

  // Join payrollSlips -> payrollRuns (for fiscalYearId & payPeriodMonth) -> employees -> employeePersonal
  const rawResults = await getDb()
    .select({
      slip: payrollSlips,
      run: payrollRuns,
      taxStatus: employees.taxStatus,
      panNumber: employeePersonal.panNumber,
    })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .innerJoin(employees, eq(payrollSlips.employeeId, employees.id))
    .leftJoin(employeePersonal, eq(employees.id, employeePersonal.employeeId))
    .where(eq(payrollRuns.fiscalYearId, filter.fiscalYearId));

  let filteredResults = rawResults;
  if (filter.reportType === "MONTHLY" && filter.bsMonth) {
    filteredResults = filteredResults.filter(
      (r) => r.run.payPeriodMonth === filter.bsMonth
    );
  }

  const startBsYear = fy?.startDateBS
    ? parseInt(fy.startDateBS.split("-")[0], 10)
    : (fy?.label ? parseInt(fy.label.match(/\d{4}/)?.[0] || "2081", 10) : 2081);
  const bsYear = filter.bsMonth ? (filter.bsMonth >= 4 ? startBsYear : startBsYear + 1) : startBsYear;

  const periodLabel =
    filter.reportType === "MONTHLY" && filter.bsMonth
      ? engine.formatBSMonthLabel(filter.bsMonth, bsYear)
      : `FY ${fiscalYearLabel}`;

  // Aggregate rows per employee
  const employeeMap = new Map<
    string,
    {
      employeeCode: string;
      employeeName: string;
      panNumber: string | null;
      taxStatus: string;
      grossIncome: number;
      pfDeducted: number;
      citDeducted: number;
      tdsDeducted: number;
    }
  >();

  filteredResults.forEach((r) => {
    const key = r.slip.employeeId;
    const existing = employeeMap.get(key) || {
      employeeCode: r.slip.employeeCode,
      employeeName: r.slip.employeeName,
      panNumber: r.panNumber || null,
      taxStatus: r.taxStatus,
      grossIncome: 0,
      pfDeducted: 0,
      citDeducted: 0,
      tdsDeducted: 0,
    };

    existing.grossIncome += Number(r.slip.grossEarnings) || 0;
    existing.pfDeducted += Number(r.slip.pfEmployee) || 0;
    existing.citDeducted += Number(r.slip.citDeduction) || 0;
    existing.tdsDeducted += Number(r.slip.tdsThisMonth) || 0;

    employeeMap.set(key, existing);
  });

  let employeesWithoutPAN = 0;

  const rows: TDSReportRow[] = Array.from(employeeMap.values()).map((emp) => {
    if (!emp.panNumber) employeesWithoutPAN++;

    const taxable = Math.max(0, emp.grossIncome - emp.pfDeducted - emp.citDeducted);

    return {
      employeeCode: emp.employeeCode,
      employeeName: emp.employeeName,
      panNumber: emp.panNumber,
      taxStatus: emp.taxStatus,
      grossIncome: emp.grossIncome.toFixed(2),
      pfDeducted: emp.pfDeducted.toFixed(2),
      citDeducted: emp.citDeducted.toFixed(2),
      taxableIncome: taxable.toFixed(2),
      tdsDeducted: emp.tdsDeducted.toFixed(2),
      period: periodLabel,
    };
  });

  const totalGrossIncome = engine.sumDecimalStrings(rows.map((r) => r.grossIncome));
  const totalTds = engine.sumDecimalStrings(rows.map((r) => r.tdsDeducted));

  return {
    rows,
    period: periodLabel,
    fiscalYearLabel,
    totalTds,
    totalGrossIncome,
    employeesWithoutPAN,
  };
}

// ─── Leave Report ─────────────────────────────────────────────────────────

export async function getLeaveReportData(
  filter: LeaveReportFilter
): Promise<LeaveReportData> {
  if (!filter.fiscalYearId) {
    throw new Error("Fiscal Year is required for Leave Report.");
  }

  const [fy] = await getDb()
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, filter.fiscalYearId))
    .limit(1);

  const fiscalYearLabel = fy ? fy.label : "N/A";

  // 1. Fetch Leave Balances
  const balancesRaw = await getDb()
    .select({
      bal: employeeLeaveBalances,
      empCode: employees.employeeCode,
      empFirst: employees.firstName,
      empLast: employees.lastName,
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
        `${b.empFirst} ${b.empLast}`.toLowerCase().includes(q)
    );
  }

  const balanceRows: LeaveBalanceRow[] = filteredBalances.map((b) => ({
    employeeCode: b.empCode,
    employeeName: `${b.empFirst} ${b.empLast}`.trim(),
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
  const appsRaw = await getDb()
    .select({
      app: leaveApplications,
      empCode: employees.employeeCode,
      empFirst: employees.firstName,
      empLast: employees.lastName,
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
        `${a.empFirst} ${a.empLast}`.toLowerCase().includes(q)
    );
  }

  const applicationRows: LeaveApplicationReportRow[] = filteredApps.map((a) => ({
    id: a.app.id,
    employeeCode: a.empCode,
    employeeName: `${a.empFirst} ${a.empLast}`.trim(),
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

export async function getLoanReportData(
  filter: LoanReportFilter
): Promise<LoanReportData> {
  // 1. Fetch Loan Disbursements / Summaries
  const loansRaw = await getDb()
    .select({
      loan: loans,
      empCode: employees.employeeCode,
      empFirst: employees.firstName,
      empLast: employees.lastName,
      deptName: departments.name,
      branchId: employees.branchId,
      deptId: employees.departmentId,
      loanName: loanTypes.name,
    })
    .from(loans)
    .innerJoin(employees, eq(loans.employeeId, employees.id))
    .innerJoin(loanTypes, eq(loans.loanTypeId, loanTypes.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id));

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
        `${l.empFirst} ${l.empLast}`.toLowerCase().includes(q)
    );
  }

  const summaryRows: LoanSummaryRow[] = filteredLoans.map((l) => ({
    loanId: l.loan.id,
    employeeCode: l.empCode,
    employeeName: `${l.empFirst} ${l.empLast}`.trim(),
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
  const repaymentsRaw = await getDb()
    .select({
      rep: loanRepayments,
      empCode: employees.employeeCode,
      empFirst: employees.firstName,
      empLast: employees.lastName,
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
    .leftJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id));

  let filteredRepayments = repaymentsRaw;
  if (filter.loanTypeId) {
    filteredRepayments = filteredRepayments.filter((r) => r.rep.loanId === filter.loanTypeId);
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
        `${r.empFirst} ${r.empLast}`.toLowerCase().includes(q)
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
      employeeName: `${r.empFirst} ${r.empLast}`.trim(),
      departmentName: r.deptName || "Unassigned",
      loanTypeName: r.loanName,
      repaymentDate: String(r.rep.repaymentDate),
      amountPaid: String(r.rep.amountPaid),
      paymentMethod: r.rep.paymentMethod as "CASH" | "SALARY_DEDUCTION",
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

