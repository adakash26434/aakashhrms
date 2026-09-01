"use client";

import dynamic from "next/dynamic";
import type {
  AttendanceDay,
  DepartmentHeadcount,
  TrendDataPoint,
} from "@/lib/types/dashboard";

const MonthlyPayrollTrend = dynamic(
  () =>
    import("@/components/dashboard/monthly-payroll-trend").then(
      (m) => m.MonthlyPayrollTrend,
    ),
  {
    loading: () => (
      <div className="h-[320px] animate-pulse rounded-xl border border-[#d7e8d0] bg-[#d7e8d0]/60" />
    ),
  },
);

const HeadcountByDepartment = dynamic(
  () =>
    import("@/components/dashboard/headcount-by-department").then(
      (m) => m.HeadcountByDepartment,
    ),
  {
    loading: () => (
      <div className="h-[320px] animate-pulse rounded-xl border border-[#d7e8d0] bg-[#d7e8d0]/60" />
    ),
  },
);

const AttendanceLeaveChart = dynamic(
  () =>
    import("@/components/dashboard/attendance-leave-chart").then(
      (m) => m.AttendanceLeaveChart,
    ),
  {
    loading: () => (
      <div className="h-[300px] animate-pulse rounded-xl border border-[#d7e8d0] bg-[#d7e8d0]/60" />
    ),
  },
);

interface DashboardChartsProps {
  trend: TrendDataPoint[];
  headcount: DepartmentHeadcount[];
  headcountTotal: number;
  attendance: AttendanceDay[];
}

export function DashboardCharts({
  trend,
  headcount,
  headcountTotal,
  attendance,
}: DashboardChartsProps) {
  return (
    <>
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <MonthlyPayrollTrend data={trend} />
        </div>
        <div className="min-w-0">
          <HeadcountByDepartment data={headcount} total={headcountTotal} />
        </div>
      </div>
      <AttendanceLeaveChart data={attendance} />
    </>
  );
}
