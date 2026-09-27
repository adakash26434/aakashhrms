"use client";

import Link from "next/link";
import { ArrowUpRight, Users, Briefcase } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { useClientReady } from "@/lib/hooks/use-client-ready";
import type { DepartmentHeadcount } from "@/lib/types/dashboard";

interface HeadcountByDepartmentProps {
  data: DepartmentHeadcount[];
  total: number;
}

export function HeadcountByDepartment({
  data,
  total,
}: HeadcountByDepartmentProps) {
  const ready = useClientReady();
  const activeDepts = data.filter((d) => d.count > 0).length;

  return (
    <Card className="h-full flex flex-col bg-white p-4 sm:p-5">
      {/* 1. Header with Link */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-zinc-950">
            Department Distribution
          </h3>
          <p className="text-xs text-zinc-500">
            {total.toLocaleString()} active staff across {data.length} departments
          </p>
        </div>
        <Link
          href="/workforce/departments"
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:text-emerald-950 transition-colors"
        >
          <span>Departments</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-3 flex-1 flex flex-col justify-between gap-4 min-w-0">
        {/* 2. Visual Overview: Doughnut Chart + High-Level Metrics */}
        <div className="flex items-center justify-between gap-4 rounded-md bg-zinc-50/70 p-3 border border-zinc-200/70">
          {/* Doughnut Chart */}
          <div className="relative h-28 w-28 shrink-0">
            {ready ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={34}
                    outerRadius={50}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid #e4e4e7",
                      backgroundColor: "#FFFFFF",
                      boxShadow: "0 2px 4px 0 rgba(0, 0, 0, 0.05)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full animate-pulse rounded-full bg-zinc-200" />
            )}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-semibold text-zinc-950 font-mono leading-none">
                {total.toLocaleString()}
              </span>
              <span className="text-[9px] text-zinc-400 font-medium mt-0.5">Active</span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-white p-2.5 border border-zinc-200/80 shadow-2xs">
              <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-medium">
                <Users className="h-3 w-3 text-emerald-800" />
                <span>Total Staff</span>
              </div>
              <div className="text-sm font-semibold text-zinc-900 font-mono mt-0.5">
                {total}
              </div>
            </div>
            <div className="rounded-md bg-white p-2.5 border border-zinc-200/80 shadow-2xs">
              <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-medium">
                <Briefcase className="h-3 w-3 text-zinc-700" />
                <span>Active Units</span>
              </div>
              <div className="text-sm font-semibold text-zinc-900 font-mono mt-0.5">
                {activeDepts} <span className="text-[10px] font-normal text-zinc-400">/ {data.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Detailed Department Progress Bars */}
        <div className="space-y-2.5 flex-1 justify-center flex flex-col">
          {data.slice(0, 5).map((dept) => {
            const percentage = total > 0 ? Math.round((dept.count / total) * 100) : 0;
            return (
              <div key={dept.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: dept.color }}
                    />
                    <span className="truncate text-zinc-700 font-medium text-xs">
                      {dept.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                    <span className="font-semibold text-zinc-900">
                      {dept.count} {dept.count === 1 ? "emp" : "emps"}
                    </span>
                    <span className="text-zinc-400 text-[10px]">
                      ({percentage}%)
                    </span>
                  </div>
                </div>
                {/* Visual Progress Bar */}
                <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(percentage, dept.count > 0 ? 8 : 0)}%`,
                      backgroundColor: dept.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. Bottom Footer Subtext */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-200 pt-2.5">
          <span>Workforce allocation fully mapped</span>
          <Link
            href="/workforce/employees"
            className="hover:text-zinc-950 transition-colors font-medium text-zinc-700"
          >
            View all employees
          </Link>
        </div>
      </div>
    </Card>
  );
}
