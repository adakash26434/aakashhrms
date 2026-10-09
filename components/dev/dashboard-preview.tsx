"use client";

import { useMemo, useState } from "react";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import * as engine from "@/lib/engines/dashboard.engine";
import { adToBS } from "@/lib/utils/bs-calendar";
import { addDays, nepalDateIso, nepalToday, toIsoDate } from "@/lib/utils/nepal-time";
import type { DashboardAccess, DashboardData, DashboardPeriodOption, PeriodCostRow } from "@/lib/types/dashboard";

// Synthetic company for the dashboard preview (4.1). Never real records.

const FULL_ACCESS: DashboardAccess = {
  employees: true,
  employeesAdd: true,
  attendance: true,
  leaveApprovals: true,
  payroll: true,
  payrollGenerate: true,
  payrollReview: true,
  audit: true,
  supportView: false,
  scopeLabel: null,
};

type Variant = "admin" | "branch" | "employee" | "failed" | "new";

function costRows(lastMonth: { year: number; month: number }): PeriodCostRow[] {
  const rows: PeriodCostRow[] = [];
  for (let i = 23; i >= 0; i--) {
    const p = engine.shiftPeriod(lastMonth, -i);
    const growth = 1 + (23 - i) * 0.006;
    const festival = p.month === 6 || p.month === 7 ? 1.14 : 1; // Dashain / Tihar bonus months
    const headcount = Math.round(42 + (23 - i) * 0.3);
    const gross = Math.round(headcount * 52000 * growth * festival);
    const ssfEmployer = Math.round(gross * 0.12);
    const ssfEmployee = Math.round(gross * 0.066);
    const tds = Math.round(gross * 0.034);
    const pfEmployee = Math.round(gross * 0.02);
    const cit = Math.round(gross * 0.012);
    const loan = Math.round(gross * 0.009);
    const other = Math.round(gross * 0.004);
    const totalDeductions = ssfEmployer + ssfEmployee + tds + pfEmployee + cit + loan + other;
    rows.push({
      ...p,
      gross,
      net: gross - totalDeductions,
      totalDeductions,
      tds,
      pfEmployee,
      pfEmployer: pfEmployee,
      ssfEmployee,
      ssfEmployer,
      cit,
      loan,
      ot: Math.round(gross * 0.01),
      employees: headcount,
      locked: i > 0,
    });
  }
  return rows;
}

function buildData(variant: Variant, option: DashboardPeriodOption): DashboardData {
  const today = nepalToday();
  const bs = adToBS(today);
  const thisMonth = { year: bs.year, month: bs.month };
  const lastMonth = engine.shiftPeriod(thisMonth, -1);
  const rows = variant === "new" ? [] : costRows(lastMonth);
  const latest = variant === "new" ? null : lastMonth;
  const period = engine.resolvePeriod(option, latest, thisMonth);
  const current = rows.filter((r) => engine.inWindow(r, period.current));
  const deadlines = engine.upcomingDeadlines(today);
  const runs: engine.RunLike[] =
    variant === "new"
      ? []
      : [
          { id: "r1", payPeriodYear: lastMonth.year, payPeriodMonth: lastMonth.month, status: "APPROVED", totalGross: 1500000, totalNetPayable: 1260000, employeeCount: 28 },
          { id: "r2", payPeriodYear: lastMonth.year, payPeriodMonth: lastMonth.month, status: "UNDER_REVIEW", totalGross: 1010000, totalNetPayable: 850000, employeeCount: 21 },
        ];
  const latestRun = engine.latestRunPeriod(runs);
  const monthDays = engine.bsMonthDaysToDate(today);
  const roster = Array.from({ length: 49 }, (_, i) => `e${i}`);
  const marks = monthDays.days.flatMap((date, d) => {
    if (d === monthDays.days.length - 1) return roster.slice(0, 31).map((employeeId) => ({ employeeId, date, status: "Present" }));
    if (new Date(date).getDay() === 6) return roster.map((employeeId) => ({ employeeId, date, status: "Weekly Off" }));
    return roster.map((employeeId, i) => ({ employeeId, date, status: (i + d) % 23 === 0 ? "Absent" : "Present" }));
  });
  const leaves = [
    { employeeId: "e3", from: monthDays.days[2] ?? nepalDateIso(), to: monthDays.days[5] ?? nepalDateIso() },
    { employeeId: "e9", from: nepalDateIso(), to: toIsoDate(addDays(today, 2)) },
  ];

  const attendanceDays = engine.attendanceByDay(monthDays.days, roster, variant === "new" ? [] : marks, leaves);

  const data: DashboardData = {
    generatedAt: new Date().toISOString(),
    todayIso: nepalDateIso(),
    displayName: "Sample Admin",
    access: FULL_ACCESS,
    filters: { period, branchId: null, branches: [{ id: "ktm", name: "Kathmandu" }, { id: "pkr", name: "Pokhara" }] },
    kpis: engine.buildKpis({ rows, period, activeHeadcount: variant === "new" ? 6 : 49, joiners: 2, leavers: 1, nextDeadline: deadlines[0] ?? null }),
    costTrend: engine.costTrend(rows, period.current.to, 12),
    costBreakdown: current.length ? engine.costBreakdown(engine.sumCostRows(current)) : { total: 0, segments: [] },
    departmentCost: engine.topDepartments(
      variant === "new"
        ? []
        : [
            { name: "Operations", cost: 820000, employees: 16 },
            { name: "Finance & Accounts", cost: 610000, employees: 11 },
            { name: "Sales", cost: 455000, employees: 9 },
            { name: "IT", cost: 402000, employees: 7 },
            { name: "Human Resources", cost: 236000, employees: 4 },
            { name: "Administration", cost: 120000, employees: 2 },
          ].map((d) => ({ ...d, cost: d.cost * Math.max(current.length, 1) }))
    ),
    attendance: { monthLabel: monthDays.label, total: roster.length, days: attendanceDays, ratePct: engine.attendanceRate(attendanceDays) },
    statutory: current.length ? engine.statutorySummary(engine.sumCostRows(current)) : { total: 0, rows: [] },
    upcoming: engine.upcomingEvents({
      today,
      holidays:
        variant === "new"
          ? []
          : [
              { id: "h1", name: "Ghatasthapana", category: "Public", startDateAD: addDays(today, 6), endDateAD: addDays(today, 6) },
              { id: "h2", name: "Dashain (Fulpati to Kojagrat Purnima)", category: "Public", startDateAD: addDays(today, 12), endDateAD: addDays(today, 18) },
              { id: "h3", name: "Tihar", category: "Public", startDateAD: addDays(today, 29), endDateAD: addDays(today, 32) },
            ],
      employees:
        variant === "new"
          ? []
          : [
              { id: "e1", fullName: "Sita Sharma", dateOfBirth: addDays(today, 2), joiningDate: addDays(today, 400) },
              { id: "e2", fullName: "Ram Thapa", dateOfBirth: addDays(today, 140), joiningDate: addDays(today, -365 * 3 + 9) },
              { id: "e3", fullName: "Gita Karki", dateOfBirth: addDays(today, 0), joiningDate: addDays(today, 30) },
            ],
    }),
    fiscalProgress: engine.fiscalProgress(thisMonth),
    payRun: { latest: latestRun, next: engine.nextPeriodToRun(latestRun, thisMonth) },
    deadlines: deadlines.map((d) => {
      const row = rows.find((r) => r.year === d.forYear && r.month === d.forMonth);
      return { ...d, amount: row ? (d.ruleId === "tds" ? row.tds : row.ssfEmployee + row.ssfEmployer) : null };
    }),
    approvals: {
      total: variant === "new" ? 0 : 7,
      items:
        variant === "new"
          ? []
          : [
              { id: "a1", employeeName: "Sita Sharma", leaveType: "Annual leave", days: 3, from: toIsoDate(addDays(today, 3)), to: toIsoDate(addDays(today, 5)), waitingDays: 5 },
              { id: "a2", employeeName: "Bikash Rai", leaveType: "Unpaid leave", days: 6, from: toIsoDate(addDays(today, 4)), to: toIsoDate(addDays(today, 9)), waitingDays: 2 },
              { id: "a3", employeeName: "Ram Thapa", leaveType: "Sick leave", days: 1, from: nepalDateIso(), to: nepalDateIso(), waitingDays: 1 },
              { id: "a4", employeeName: "Kiran Joshi", leaveType: "Festival leave", days: 5, from: toIsoDate(addDays(today, 10)), to: toIsoDate(addDays(today, 14)), waitingDays: 0 },
              { id: "a5", employeeName: "Mina Pokhrel", leaveType: "Annual leave", days: 2, from: toIsoDate(addDays(today, 6)), to: toIsoDate(addDays(today, 7)), waitingDays: 0 },
            ],
    },
    readiness: {
      checked: 49,
      issues: engine.payrollReadiness([
        { id: "e1", fullName: "Hari Adhikari", employeeCode: "EMP-004", panNumber: null, bankAccountNumber: "001", basicSalary: 40000 },
        { id: "e2", fullName: "Asha Shrestha", employeeCode: "EMP-008", panNumber: "12345", bankAccountNumber: "002", basicSalary: 38000 },
        { id: "e3", fullName: "Bikash Rai", employeeCode: "EMP-006", panNumber: "601234567", bankAccountNumber: "", basicSalary: 41000 },
      ]),
    },
    leaveByType: {
      fiscalYear: "FY 2083/84",
      types:
        variant === "new"
          ? []
          : [
              { name: "Annual leave", days: 64 },
              { name: "Sick leave", days: 31 },
              { name: "Festival leave", days: 22 },
              { name: "Unpaid leave", days: 9 },
              { name: "Maternity leave", days: 6 },
            ],
    },
    onLeaveToday: [{ name: "Anita Gurung", leaveType: "Sick leave", until: toIsoDate(addDays(today, 2)) }],
    headcount: [
      { name: "Operations", count: 16 },
      { name: "Finance & Accounts", count: 11 },
      { name: "Sales", count: 9 },
      { name: "IT", count: 7 },
      { name: "Human Resources", count: 4 },
      { name: "Administration", count: 2 },
    ],
    activity: [
      { id: "1", actor: "Sita Sharma", action: "APPROVE", module: "Leave approvals", result: "SUCCESS", at: new Date(Date.now() - 20 * 60000).toISOString() },
      { id: "2", actor: "Ram Thapa", action: "EDIT", module: "Employees", result: "SUCCESS", at: new Date(Date.now() - 55 * 60000).toISOString() },
      { id: "3", actor: "Hari Adhikari", action: "EXPORT", module: "Reports salary sheet", result: "DENIED_PERMISSION", at: new Date(Date.now() - 2 * 3600000).toISOString() },
      { id: "4", actor: "Sita Sharma", action: "LOCK", module: "Payroll review", result: "SUCCESS", at: new Date(Date.now() - 26 * 3600000).toISOString() },
    ],
    notices: [
      { id: "n1", title: "Dashain holidays", body: "The office is closed from 2083-06-20 to 2083-06-26. Branch counters reopen 2083-06-27.", branch: null, publishAd: "2026-10-01", pinned: true },
      { id: "n2", title: "AML/KYC refresher", body: "Credit staff attend the refresher on 2083-07-05 at the head office hall.", branch: "Head office", publishAd: "2026-10-05", pinned: false },
    ],
    failed: [],
  };

  if (variant === "branch") {
    return {
      ...data,
      displayName: "Branch Manager",
      access: { ...FULL_ACCESS, employeesAdd: false, payroll: false, payrollGenerate: false, payrollReview: false, audit: false, scopeLabel: "Pokhara branch" },
      filters: { ...data.filters, branches: [] },
      kpis: null,
      statutory: null,
      costTrend: null,
      costBreakdown: null,
      departmentCost: null,
      payRun: null,
      deadlines: null,
      readiness: null,
      activity: null,
      approvals: { total: 2, items: data.approvals!.items.slice(0, 2) },
      headcount: data.headcount!.slice(0, 3),
    };
  }
  if (variant === "employee") {
    return {
      ...data,
      displayName: "Employee",
      access: { ...FULL_ACCESS, employees: false, employeesAdd: false, attendance: false, leaveApprovals: false, payroll: false, payrollGenerate: false, payrollReview: false, audit: false, scopeLabel: "Your own records" },
      filters: { ...data.filters, branches: [] },
      kpis: null, costTrend: null, costBreakdown: null, departmentCost: null, attendance: null, payRun: null, deadlines: null, statutory: null, upcoming: null,
      approvals: null, readiness: null, leaveByType: null, onLeaveToday: null, headcount: null, activity: null,
    };
  }
  if (variant === "failed") {
    return { ...data, kpis: null, costTrend: null, costBreakdown: null, departmentCost: null, statutory: null, activity: null, attendance: null, failed: ["payroll", "activity", "attendance"] };
  }
  return data;
}

const VARIANTS: { id: Variant; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "branch", label: "Branch manager" },
  { id: "employee", label: "Employee" },
  { id: "failed", label: "Sections failed" },
  { id: "new", label: "New company" },
];

/** /dev/dashboard: the real dashboard UI with sample data, every state one click away. */
export function DashboardPreview({ period }: { period: DashboardPeriodOption }) {
  const [variant, setVariant] = useState<Variant>("admin");
  const data = useMemo(() => buildData(variant, period), [variant, period]);
  return (
    <div className="min-h-screen bg-canvas p-4 sm:p-6">
      <div className="mx-auto mb-4 flex max-w-[1600px] flex-wrap items-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface px-3 py-2 text-xs">
        <span className="font-semibold text-ink">Dashboard preview (dev only, sample data)</span>
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setVariant(v.id)}
            aria-pressed={variant === v.id}
            className={variant === v.id ? "h-7 rounded-md bg-ink px-2.5 font-medium text-white" : "h-7 rounded-md border border-line px-2.5 text-ink-muted hover:bg-surface-sunken cursor-pointer"}
          >
            {v.label}
          </button>
        ))}
      </div>
      <DashboardClient key={variant} data={data} />
    </div>
  );
}
