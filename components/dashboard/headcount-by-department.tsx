"use client";

import { Filter } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-payroll-navy">
              Headcount by department
            </h3>
            <p className="text-sm text-gray-500">
              {total.toLocaleString()} active employees
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-payroll-primary"
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative h-45 w-45 min-w-45 shrink-0">
            {ready ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #E5E7EB",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full animate-pulse rounded-full bg-payroll-light" />
            )}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold text-payroll-navy">
                {total.toLocaleString()}
              </span>
              <span className="text-xs text-gray-500">Active</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {data.map((dept) => (
              <div
                key={dept.name}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: dept.color }}
                  />
                  <span className="truncate text-gray-600">{dept.name}</span>
                </div>
                <span className="shrink-0 font-medium text-payroll-navy">
                  {dept.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
