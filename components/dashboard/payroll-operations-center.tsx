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
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-payroll-primary">
        <CheckCircle2 className="h-3 w-3 text-white" />
      </div>
    );
  }
  if (status === "in-review") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-50">
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
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Payroll Operations Center
            </p>
            <h2 className="mt-1 text-lg font-semibold text-payroll-navy">
              {run.period}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="success">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {run.statusLabel}
              </Badge>
              <Badge variant="warning">
                <Clock className="mr-1 h-3 w-3" />
                {run.awaitingLabel}
              </Badge>
              <span className="text-sm text-gray-400">Run · #{run.id}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start justify-between overflow-x-auto pb-2">
          {run.workflowSteps.map((step, index) => (
            <div
              key={step.id}
              className="flex min-w-30 flex-1 flex-col items-center"
            >
              <div className="flex w-full items-center">
                {index > 0 && (
                  <div
                    className={cn(
                      "h-px flex-1",
                      step.status === "upcoming"
                        ? "bg-payroll-light"
                        : "bg-payroll-primary",
                    )}
                  />
                )}
                <StepIndicator status={step.status} />
                {index < run.workflowSteps.length - 1 && (
                  <div
                    className={cn(
                      "h-px flex-1",
                      run.workflowSteps[index + 1]?.status === "upcoming"
                        ? "bg-payroll-light"
                        : "bg-payroll-primary",
                    )}
                  />
                )}
              </div>
              <div className="mt-2 text-center">
                <p className="text-xs font-medium text-payroll-navy">
                  {step.label}
                </p>
                <p className="text-xs capitalize text-gray-500">
                  {step.status === "complete"
                    ? "Complete"
                    : step.status === "in-review"
                      ? "In review"
                      : "Upcoming"}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">{step.actor}</p>
                {step.timestamp && (
                  <p className="text-xs text-gray-400">{step.timestamp}</p>
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
              <div className="rounded-lg border border-payroll-light/60 bg-payroll-cream p-3">
                <p className="text-xs text-gray-500">Employees Included</p>
                <p className="text-lg sm:text-xl font-semibold text-payroll-navy">
                  {run.employeesIncluded.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">
                  {run.employeesExcluded} excluded · {run.exceptions} exceptions
                </p>
              </div>
              <div className="rounded-lg border border-payroll-light/60 bg-payroll-cream p-3">
                <p className="text-xs text-gray-500">Gross Payroll</p>
                <p className="text-sm sm:text-lg font-semibold text-payroll-navy">
                  {formatNPR(run.grossPayroll)}
                </p>
                <p className="text-xs text-gray-400">
                  Basic + Grade + Allowances
                </p>
              </div>
              <div className="rounded-lg border border-payroll-light/60 bg-payroll-cream p-3">
                <p className="text-xs text-gray-500">Total Deductions</p>
                <p className="text-sm sm:text-lg font-semibold text-payroll-navy">
                  {formatNPR(run.totalDeductions)}
                </p>
                <p className="text-xs text-gray-400">
                  PF, SSF, TDS, Loans, CIT
                </p>
              </div>
              <div className="rounded-lg border border-payroll-light bg-payroll-light p-3">
                <p className="text-xs text-payroll-primary">Net Payable</p>
                <p className="text-sm sm:text-lg font-semibold text-payroll-navy">
                  {formatNPR(run.netPayable)}
                </p>
                <p className="text-xs text-gray-600">To 6 partner banks</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {run.deductions.map((d) => (
                <div
                  key={d.label}
                  className="rounded-lg border border-payroll-light/60 p-3"
                  style={{ borderLeftWidth: 3, borderLeftColor: d.color }}
                >
                  <p className="text-xs font-medium text-gray-500">{d.label}</p>
                  <p className="text-sm font-semibold text-payroll-navy">
                    {formatNPR(d.amount, "lakh")}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">
                <ShieldCheck className="h-4 w-4" />
                Approve & Lock
              </Button>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4" />
                Review Grid
              </Button>
              <Button variant="ghost" size="sm">
                <Landmark className="h-4 w-4" />
                Export Bank File
              </Button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-lg border border-payroll-light">
              <div className="flex items-center justify-between border-b border-payroll-light/60 px-4 py-3">
                <h3 className="text-sm font-semibold text-payroll-navy">
                  Validation exceptions
                </h3>
                <button
                  type="button"
                  className="text-xs text-payroll-primary hover:underline"
                >
                  View all
                </button>
              </div>
              <table className="w-full table-fixed text-left text-xs">
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[20%]" />
                  <col className="w-[36%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-payroll-light/60 text-[10px] uppercase tracking-wider text-gray-400">
                    <th className="px-3 py-2 font-medium">Employee</th>
                    <th className="px-3 py-2 font-medium">Department</th>
                    <th className="px-3 py-2 font-medium">Exception</th>
                    <th className="px-3 py-2 font-medium">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {exceptions.map((ex) => (
                    <tr
                      key={ex.id}
                      className="border-b border-payroll-cream hover:bg-payroll-cream/80"
                    >
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium text-payroll-navy wrap-break-word">
                          {ex.employeeName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-400 wrap-break-word">
                          {ex.employeeId}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-top text-gray-600 wrap-break-word">
                        {ex.department}
                      </td>
                      <td className="px-3 py-3 align-top text-gray-600 wrap-break-word">
                        {ex.exception}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Badge variant={ex.severity}>{ex.severity}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
