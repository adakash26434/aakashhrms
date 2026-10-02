"use client";

import { useMemo, useState } from "react";
import { HomeView } from "@/components/workspace-home/home-view";
import { buildLeaveQueue, type LeaveLike } from "@/lib/home/leave-queue";
import { upcomingDeadlines } from "@/lib/home/deadlines";
import { latestPeriod, nextPeriodToRun, payrollTrend, type RunLike } from "@/lib/home/payroll-period";
import { payrollReadiness, type ReadinessEmployee } from "@/lib/home/readiness";
import { nepalDateIso, nepalToday, toIsoDate, addDays } from "@/lib/home/nepal-time";
import { adToBS } from "@/lib/utils/bs-calendar";
import type { HomeAccess, HomeData } from "@/lib/home/types";

// Synthetic company for the Home preview (Phase 4.1). Never real records.

const DEPTS = new Map([
  ["d-fin", "Finance"],
  ["d-ops", "Operations"],
  ["d-hr", "Human Resources"],
  ["d-it", "IT"],
  ["d-sales", "Sales"],
]);
const NAMES = ["Sita Sharma", "Ram Thapa", "Anita Gurung", "Hari Adhikari", "Gita Karki", "Bikash Rai", "Suresh Magar", "Asha Shrestha", "Nabin Tamang", "Puja Bhandari", "Kiran Joshi", "Mina Pokhrel"];
const DEPT_IDS = [...DEPTS.keys()];

const EMPLOYEES = NAMES.map((name, i) => ({
  id: `e${i + 1}`,
  fullName: name,
  employeeCode: `EMP-${String(i + 1).padStart(3, "0")}`,
  departmentId: DEPT_IDS[i % DEPT_IDS.length],
  panNumber: i === 3 ? null : i === 7 ? "12345" : `60${String(1000000 + i * 7341).slice(0, 7)}`,
  bankAccountNumber: i === 5 || i === 9 ? "" : `001001${i}2345`,
  basicSalary: i === 11 ? 0 : 35000 + i * 2500,
}));

const LEAVE_TYPES = new Map([
  ["lt-annual", { name: "Annual leave", leaveType: "Pay" }],
  ["lt-sick", { name: "Sick leave", leaveType: "Pay" }],
  ["lt-unpaid", { name: "Unpaid leave", leaveType: "Non-Pay" }],
  ["lt-festival", { name: "Festival leave", leaveType: "Pay" }],
]);

function iso(offset: number) {
  return toIsoDate(addDays(nepalToday(), offset));
}

function leaves(): { pending: LeaveLike[]; approved: LeaveLike[] } {
  const pending: LeaveLike[] = [
    { id: "l1", employeeId: "e1", leaveTypeId: "lt-annual", appliedDate: iso(-5), effectiveFrom: iso(3), effectiveTo: iso(5), noOfDays: 3, reason: "Family wedding in Pokhara", status: "Pending" },
    { id: "l2", employeeId: "e2", leaveTypeId: "lt-sick", appliedDate: iso(-1), effectiveFrom: iso(0), effectiveTo: iso(0), noOfDays: 1, reason: "Fever, medical note attached", status: "Pending" },
    { id: "l3", employeeId: "e6", leaveTypeId: "lt-unpaid", appliedDate: iso(-2), effectiveFrom: iso(4), effectiveTo: iso(9), noOfDays: 6, reason: "Travelling abroad", status: "Pending" },
    { id: "l4", employeeId: "e11", leaveTypeId: "lt-festival", appliedDate: iso(0), effectiveFrom: iso(10), effectiveTo: iso(14), noOfDays: 5, reason: "Dashain at home", status: "Pending" },
  ];
  const approved: LeaveLike[] = [
    { id: "a1", employeeId: "e6", leaveTypeId: "lt-annual", appliedDate: iso(-10), effectiveFrom: iso(-1), effectiveTo: iso(1), noOfDays: 3, reason: "", status: "Approved" },
    { id: "a2", employeeId: "e11", leaveTypeId: "lt-annual", appliedDate: iso(-9), effectiveFrom: iso(4), effectiveTo: iso(5), noOfDays: 2, reason: "", status: "Approved" },
    { id: "a3", employeeId: "e3", leaveTypeId: "lt-sick", appliedDate: iso(-3), effectiveFrom: iso(0), effectiveTo: iso(2), noOfDays: 3, reason: "", status: "Approved" },
  ];
  return { pending, approved };
}

function runs(): RunLike[] {
  const bs = adToBS(nepalToday());
  const out: RunLike[] = [];
  const bases = [2120000, 2150000, 2140000, 2410000, 2395000, 2430000];
  for (let i = 6; i >= 1; i--) {
    let month = bs.month - i;
    let year = bs.year;
    while (month < 1) {
      month += 12;
      year -= 1;
    }
    const gross = bases[6 - i];
    for (const branch of i === 1 ? ["ktm", "pkr"] : ["all"]) {
      const share = branch === "all" ? 1 : branch === "ktm" ? 0.6 : 0.4;
      out.push({
        id: `r-${year}-${month}-${branch}`,
        payPeriodYear: year,
        payPeriodMonth: month,
        status: i === 1 ? (branch === "ktm" ? "APPROVED" : "UNDER_REVIEW") : "LOCKED",
        totalGross: gross * share,
        totalDeductions: gross * 0.14 * share,
        totalNetPayable: gross * 0.86 * share,
        totalTds: gross * 0.035 * share,
        totalSsf: gross * 0.31 * 0.6 * share,
        employeeCount: Math.round(48 * share),
      });
    }
  }
  return out;
}

const FULL_ACCESS: HomeAccess = {
  employees: true,
  employeesAdd: true,
  attendance: true,
  leaveApprovals: true,
  leaveDecide: true,
  payroll: true,
  payrollGenerate: true,
  payrollReview: true,
  loans: true,
  audit: true,
  supportView: false,
  scopeLabel: null,
};

type Variant = "admin" | "branch" | "self" | "failed";

function buildData(variant: Variant): HomeData {
  const today = nepalToday();
  const { pending, approved } = leaves();
  const employees = new Map(EMPLOYEES.map((e) => [e.id, e]));
  const allRuns = runs();
  const latest = latestPeriod(allRuns);
  const bs = adToBS(today);
  const queue = buildLeaveQueue(pending, {
    employees,
    departments: DEPTS,
    leaveTypes: LEAVE_TYPES,
    balances: new Map([
      ["e1:lt-annual", 12],
      ["e2:lt-sick", 4],
      ["e11:lt-festival", 3],
    ]),
    others: [...pending, ...approved],
    today,
  });
  const deadlines = upcomingDeadlines(today).map((d) => ({ ...d, amount: d.ruleId === "tds" ? 84350 : null }));

  const base: HomeData = {
    generatedAt: new Date().toISOString(),
    todayIso: nepalDateIso(),
    displayName: "Sample Admin",
    access: FULL_ACCESS,
    approvals: queue,
    payroll: { latest, next: nextPeriodToRun(latest, { year: bs.year, month: bs.month }), trend: payrollTrend(allRuns) },
    deadlines,
    readiness: { checked: EMPLOYEES.length, issues: payrollReadiness(EMPLOYEES as ReadinessEmployee[]) },
    workforce: {
      total: 48,
      recorded: 41,
      present: 38,
      absent: 3,
      late: 5,
      onLeave: [
        { name: "Anita Gurung", leaveType: "Sick leave", until: iso(2) },
        { name: "Bikash Rai", leaveType: "Annual leave", until: iso(1) },
      ],
    },
    headcount: [
      { name: "Operations", count: 16 },
      { name: "Finance", count: 11 },
      { name: "Sales", count: 9 },
      { name: "IT", count: 7 },
      { name: "Human Resources", count: 5 },
    ],
    loans: { active: 6, outstanding: 1845000 },
    activity: [
      { id: "1", actor: "Sita Sharma", action: "APPROVE", module: "Leave approvals", result: "SUCCESS", at: new Date(Date.now() - 20 * 60000).toISOString() },
      { id: "2", actor: "Ram Thapa", action: "EDIT", module: "Employees", result: "SUCCESS", at: new Date(Date.now() - 55 * 60000).toISOString() },
      { id: "3", actor: "Hari Adhikari", action: "EXPORT", module: "Reports salary sheet", result: "DENIED_PERMISSION", at: new Date(Date.now() - 2 * 3600000).toISOString() },
      { id: "4", actor: "Sita Sharma", action: "LOCK", module: "Payroll review", result: "SUCCESS", at: new Date(Date.now() - 26 * 3600000).toISOString() },
    ],
    failed: [],
  };

  if (variant === "branch") {
    return {
      ...base,
      displayName: "Branch Manager",
      access: { ...FULL_ACCESS, employeesAdd: false, leaveDecide: false, payroll: false, payrollGenerate: false, payrollReview: false, audit: false, loans: false, scopeLabel: "Pokhara branch" },
      approvals: queue.slice(0, 2),
      payroll: null,
      deadlines: null,
      readiness: null,
      loans: null,
      activity: null,
      workforce: { ...base.workforce!, total: 19, recorded: 0, present: 0, absent: 0, late: 0 },
      headcount: [
        { name: "Operations", count: 8 },
        { name: "Sales", count: 6 },
        { name: "Finance", count: 5 },
      ],
    };
  }
  if (variant === "self") {
    return {
      ...base,
      displayName: "Employee",
      access: { ...FULL_ACCESS, employees: false, employeesAdd: false, attendance: false, leaveApprovals: false, leaveDecide: false, payroll: false, payrollGenerate: false, payrollReview: false, loans: false, audit: false, scopeLabel: "Your own records" },
      approvals: null,
      payroll: null,
      deadlines: null,
      readiness: null,
      workforce: null,
      headcount: null,
      loans: null,
      activity: null,
    };
  }
  if (variant === "failed") {
    return { ...base, payroll: null, activity: null, failed: ["payroll", "activity"] };
  }
  return base;
}

const VARIANTS: { id: Variant; label: string }[] = [
  { id: "admin", label: "Admin (everything)" },
  { id: "branch", label: "Branch manager (scoped, view-only approvals)" },
  { id: "self", label: "Employee (no queues)" },
  { id: "failed", label: "Sections failed" },
];

export function HomePreview() {
  const [variant, setVariant] = useState<Variant>("admin");
  const [useServer, setUseServer] = useState(false);
  const data = useMemo(() => buildData(variant), [variant]);

  return (
    <div className="min-h-screen bg-canvas p-4 sm:p-6">
      <div className="mx-auto mb-4 flex max-w-[1600px] flex-wrap items-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface px-3 py-2 text-xs">
        <span className="font-semibold text-ink">Home preview (dev only, sample data)</span>
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
        <label className="ml-auto inline-flex items-center gap-1.5 text-ink-muted">
          <input type="checkbox" checked={useServer} onChange={(e) => setUseServer(e.target.checked)} />
          Send decisions to the real server (they will be refused: sample ids)
        </label>
      </div>
      <HomeView
        key={variant}
        data={data}
        decideOverride={useServer ? undefined : async () => void (await new Promise((r) => setTimeout(r, 300)))}
      />
    </div>
  );
}
