import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatNPR } from "@/lib/utils";
import type {
  PayrollRunSummary,
  ValidationException,
  WorkflowStepStatus,
} from "@/lib/types/dashboard";
import { cn } from "@/lib/utils";

interface PayrollOperationsCenterProps {
  run: PayrollRunSummary;
  exceptions: ValidationException[];
}

function StepIndicator({ status }: { status: WorkflowStepStatus }) {
  if (status === "complete") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-payroll-primary shadow-payroll-xs">
        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
      </div>
    );
  }
  if (status === "in-review") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-50 shadow-payroll-xs">
        <Clock className="h-3 w-3 text-amber-600" />
      </div>
    );
  }
  return <Circle className="h-5 w-5 text-payroll-light" />;
}

export function PayrollOperationsCenter({
  run,
  exceptions,
}: PayrollOperationsCenterProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Payroll Operations Center
            </p>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-payroll-navy">
              {run.period}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="success" size="sm">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {run.statusLabel}
              </Badge>
              <Badge variant="warning" size="sm">
                <Clock className="mr-1 h-3 w-3" />
                {run.awaitingLabel}
              </Badge>
              <span className="text-xs text-gray-400 font-mono">Run #{run.id}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-start justify-between overflow-x-auto pb-2 scrollbar-none">
          {run.workflowSteps.map((step, index) => (
            <div
              key={step.id}
              className="flex min-w-28 flex-1 flex-col items-center"
            >
              <div className="flex w-full items-center">
                {index > 0 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 transition-colors",
                      step.status === "upcoming"
                        ? "bg-payroll-light/80"
                        : "bg-payroll-primary",
                    )}
                  />
                )}
                <StepIndicator status={step.status} />
                {index < run.workflowSteps.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 transition-colors",
                      run.workflowSteps[index + 1]?.status === "upcoming"
                        ? "bg-payroll-light/80"
                        : "bg-payroll-primary",
                    )}
                  />
                )}
              </div>
              <div className="mt-2 text-center">
                <p className="text-xs font-semibold text-payroll-navy">
                  {step.label}
                </p>
                <p className="text-[11px] font-medium text-gray-500">
                  {step.status === "complete"
                    ? "Complete"
                    : step.status === "in-review"
                      ? "In review"
                      : "Upcoming"}
                </p>
                <p className="mt-0.5 text-[10px] text-gray-400">{step.actor}</p>
                {step.timestamp && (
                  <p className="text-[10px] text-gray-400 font-mono">{step.timestamp}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-payroll-light/70 bg-payroll-cream/60 p-3.5 shadow-payroll-xs">
                <p className="text-xs font-medium text-gray-500">Employees Included</p>
                <p className="text-lg sm:text-xl font-bold text-payroll-navy mt-0.5">
                  {run.employeesIncluded.toLocaleString()}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {run.employeesExcluded} excluded · {run.exceptions} exceptions
                </p>
              </div>
              <div className="rounded-xl border border-payroll-light/70 bg-payroll-cream/60 p-3.5 shadow-payroll-xs">
                <p className="text-xs font-medium text-gray-500">Gross Payroll</p>
                <p className="text-sm sm:text-lg font-bold text-payroll-navy mt-0.5">
                  {formatNPR(run.grossPayroll)}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Basic + Grade + Allowances
                </p>
              </div>
              <div className="rounded-xl border border-payroll-light/70 bg-payroll-cream/60 p-3.5 shadow-payroll-xs">
                <p className="text-xs font-medium text-gray-500">Total Deductions</p>
                <p className="text-sm sm:text-lg font-bold text-payroll-navy mt-0.5">
                  {formatNPR(run.totalDeductions)}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  PF, SSF, TDS, Loans, CIT
                </p>
              </div>
              <div className="rounded-xl border border-payroll-light bg-payroll-light/50 p-3.5 shadow-payroll-xs">
                <p className="text-xs font-bold text-payroll-primary">Net Payable</p>
                <p className="text-sm sm:text-lg font-bold text-payroll-navy mt-0.5">
                  {formatNPR(run.netPayable)}
                </p>
                <p className="text-[11px] text-gray-600 mt-0.5">Disbursement Ready</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {run.deductions.map((d) => (
                <div
                  key={d.label}
                  className="rounded-xl border border-payroll-light/70 p-2.5 bg-white shadow-payroll-xs"
                  style={{ borderLeftWidth: 3, borderLeftColor: d.color }}
                >
                  <p className="text-[11px] font-medium text-gray-500 truncate">{d.label}</p>
                  <p className="text-xs sm:text-sm font-bold text-payroll-navy mt-0.5">
                    {formatNPR(d.amount, "lakh")}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link href="/payroll/generate">
                <Button size="sm">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Go to Payroll Wizard</span>
                </Button>
              </Link>
              <Link href="/reports">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4" />
                  <span>Review Reports</span>
                </Button>
              </Link>
              <Link href="/reports">
                <Button variant="subtle" size="sm">
                  <Landmark className="h-4 w-4" />
                  <span>Bank Export</span>
                </Button>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-payroll-light/80 bg-white overflow-hidden shadow-payroll-xs">
              <div className="flex items-center justify-between border-b border-payroll-light/70 bg-payroll-cream/40 px-4 py-3">
                <h3 className="text-xs font-bold text-payroll-navy">
                  Validation Exceptions
                </h3>
                <Link
                  href="/payroll/generate"
                  className="text-[11px] font-semibold text-payroll-primary hover:underline"
                >
                  Review All
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-payroll-light/60 text-[10px] uppercase font-bold tracking-wider text-gray-400 bg-gray-50/50">
                      <th className="px-3 py-2 font-medium">Employee</th>
                      <th className="px-3 py-2 font-medium">Dept</th>
                      <th className="px-3 py-2 font-medium">Exception</th>
                      <th className="px-3 py-2 font-medium">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-payroll-light/40">
                    {exceptions.map((ex) => (
                      <tr
                        key={ex.id}
                        className="hover:bg-payroll-cream/50 transition-colors"
                      >
                        <td className="px-3 py-2.5 align-top">
                          <p className="font-semibold text-payroll-navy break-words">
                            {ex.employeeName}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {ex.employeeId}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 align-top text-gray-600 text-xs">
                          {ex.department}
                        </td>
                        <td className="px-3 py-2.5 align-top text-gray-600 text-xs break-words">
                          {ex.exception}
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <Badge variant={ex.severity} size="sm">{ex.severity}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
