import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Clock,
  CreditCard,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
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
  const latestAttendance = attendance && attendance.length > 0
    ? attendance[attendance.length - 1]
    : null;
  const presentCount = latestAttendance ? latestAttendance.present : activeCountNum;
  const attendanceRate = activeCountNum > 0
    ? ((presentCount / activeCountNum) * 100).toFixed(1)
    : "100.0";

  // 3. Pending Approvals
  const pendingCountStr =
    pendingApprovals.value < 10 && pendingApprovals.value > 0
      ? `0${pendingApprovals.value}`
      : String(pendingApprovals.value);

  // 4. Monthly Payroll
  const liabilityMetric = metrics.find((m) => m.id === "liability");
  const payrollDisplay = grossPayroll !== undefined && grossPayroll > 0
    ? formatNPR(grossPayroll)
    : liabilityMetric?.value || "NPR 0.00";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Active Workforce Card */}
      <Card className="group relative flex flex-col justify-between p-4.5 bg-white border-payroll-border hover:border-payroll-border/80 transition-all">
        <div>
          <div className="flex items-start justify-between">
            <p className="text-[13px] font-medium text-gray-500">Active workforce</p>
            <Users className="h-4 w-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-[28px] font-semibold tracking-tight text-gray-950 font-sans">
              {activeCount}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-payroll-primary">
            <TrendingUp className="h-3 w-3" />
            <span>Active registered personnel</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500">
          <span>Across departments</span>
          <Link
            href="/workforce/employees"
            className="text-gray-400 group-hover:text-gray-900 transition-colors"
            title="View workforce"
          >
            <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      </Card>

      {/* 2. Present Today Card */}
      <Card className="group relative flex flex-col justify-between p-4.5 bg-white border-payroll-border hover:border-payroll-border/80 transition-all">
        <div>
          <div className="flex items-start justify-between">
            <p className="text-[13px] font-medium text-gray-500">Present today</p>
            <Clock className="h-4 w-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-[28px] font-semibold tracking-tight text-gray-950 font-sans">
              {presentCount}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-payroll-primary">
            <TrendingUp className="h-3 w-3" />
            <span>{attendanceRate}% attendance rate</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500">
          <span>Reconciled entries</span>
          <Link
            href="/timeAndLeave/attendance"
            className="text-gray-400 group-hover:text-gray-900 transition-colors"
            title="Review attendance"
          >
            <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      </Card>

      {/* 3. Pending Approvals Card */}
      <Card className="group relative flex flex-col justify-between p-4.5 bg-white border-payroll-border hover:border-payroll-border/80 transition-all">
        <div>
          <div className="flex items-start justify-between">
            <p className="text-[13px] font-medium text-gray-500">Pending approvals</p>
            <AlertCircle className="h-4 w-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-[28px] font-semibold tracking-tight text-gray-950 font-sans">
              {pendingCountStr}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 font-medium">
            {pendingApprovals.subtext || "Leave & loan requests"}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500">
          <span>Impacts next payroll</span>
          <Link
            href="/timeAndLeave/approvals"
            className="text-gray-400 group-hover:text-gray-900 transition-colors"
            title="Open approvals"
          >
            <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      </Card>

      {/* 4. Monthly Payroll Card */}
      <Card className="group relative flex flex-col justify-between p-4.5 bg-white border-payroll-border hover:border-payroll-border/80 transition-all">
        <div>
          <div className="flex items-start justify-between">
            <p className="text-[13px] font-medium text-gray-500">Monthly payroll</p>
            <CreditCard className="h-4 w-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
          </div>
          <div className="mt-2.5">
            <span className="text-xl sm:text-[22px] font-semibold tracking-tight text-gray-950 font-sans">
              {payrollDisplay}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-payroll-primary">
            <TrendingUp className="h-3 w-3" />
            <span>Active cycle gross</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500">
          <span>Current active cycle</span>
          <Link
            href="/payroll/generate"
            className="text-gray-400 group-hover:text-gray-900 transition-colors"
            title="Open payroll wizard"
          >
            <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
