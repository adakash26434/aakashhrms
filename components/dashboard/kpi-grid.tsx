import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Clock,
  CreditCard,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatNPR } from "@/lib/utils";
import type { AttendanceDay, KpiMetric } from "@/lib/types/dashboard";

interface KpiGridProps {
  metrics: KpiMetric[];
  pendingApprovals: { value: number; subtext: string; badge: string };
  attendance?: AttendanceDay[];
  grossPayroll?: number;
}

export function KpiGrid({
  metrics,
  pendingApprovals,
  attendance,
  grossPayroll,
}: KpiGridProps) {
  // 1. Active Workforce
  const empMetric = metrics.find((m) => m.id === "employees");
  const activeCount = empMetric?.value || "0";
  const activeCountNum = Number(activeCount) || 0;

  // 2. Attendance / Present Today
  const latestAttendance =
    attendance && attendance.length > 0
      ? attendance[attendance.length - 1]
      : null;
  const presentCount = latestAttendance ? latestAttendance.present : activeCountNum;
  const attendanceRate =
    activeCountNum > 0
      ? ((presentCount / activeCountNum) * 100).toFixed(1)
      : "100.0";

  // 3. Pending Approvals
  const pendingCountStr =
    pendingApprovals.value < 10 && pendingApprovals.value > 0
      ? `0${pendingApprovals.value}`
      : String(pendingApprovals.value);

  // 4. Monthly Payroll
  const liabilityMetric = metrics.find((m) => m.id === "liability");
  const payrollDisplay =
    grossPayroll !== undefined && grossPayroll > 0
      ? formatNPR(grossPayroll)
      : liabilityMetric?.value || "NPR 0.00";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
      {/* 1. Active Workforce */}
      <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500">Active workforce</p>
            <Users className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-mono">
              {activeCount}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-700" />
            <span>Active registered personnel</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between pt-2 border-t border-zinc-200 text-xs text-zinc-400">
          <span>Across departments</span>
          <Link
            href="/workforce/employees"
            className="text-zinc-400 group-hover:text-zinc-900 transition-colors inline-flex items-center gap-0.5"
            title="View workforce"
          >
            <span>View</span>
            <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* 2. Present Today */}
      <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500">Present today</p>
            <Clock className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-mono">
              {presentCount}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-700" />
            <span>{attendanceRate}% attendance rate</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between pt-2 border-t border-zinc-200 text-xs text-zinc-400">
          <span>Reconciled entries</span>
          <Link
            href="/timeAndLeave/attendance"
            className="text-zinc-400 group-hover:text-zinc-900 transition-colors inline-flex items-center gap-0.5"
            title="Review attendance"
          >
            <span>Review</span>
            <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* 3. Pending Approvals */}
      <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500">Pending approvals</p>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-mono">
              {pendingCountStr}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500 font-medium">
            {pendingApprovals.subtext || "Leave & loan requests"}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between pt-2 border-t border-zinc-200 text-xs text-zinc-400">
          <span>Impacts next payroll</span>
          <Link
            href="/timeAndLeave/approvals"
            className="text-zinc-400 group-hover:text-zinc-900 transition-colors inline-flex items-center gap-0.5"
            title="Open approvals"
          >
            <span>Resolve</span>
            <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* 4. Monthly Payroll */}
      <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500">Monthly payroll</p>
            <CreditCard className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-mono">
              {payrollDisplay}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-700" />
            <span>Active cycle gross</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between pt-2 border-t border-zinc-200 text-xs text-zinc-400">
          <span>Current active cycle</span>
          <Link
            href="/payroll/generate"
            className="text-zinc-400 group-hover:text-zinc-900 transition-colors inline-flex items-center gap-0.5"
            title="Open payroll wizard"
          >
            <span>Process</span>
            <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
