import React from "react";
import { getMyLeaveBalances, getMyLeaveApplications, getMyLeaveTypes } from "@/lib/services/self-service.service";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { CalendarDays, Clock, CheckCircle2, XCircle, AlertCircle, CalendarCheck, Palmtree } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ApplyLeaveModal, WithdrawLeaveButton } from "@/components/self-service/apply-leave-modal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Leave | Self-Service Portal",
  description: "View leave balances and manage leave applications",
};

export default async function MyLeavePage() {
  let balancesData, applications, types;
  try {
    [balancesData, applications, types] = await Promise.all([
      getMyLeaveBalances(),
      getMyLeaveApplications(),
      getMyLeaveTypes(),
    ]);
  } catch (error: any) {
    return (
      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
        <CardContent className="py-16">
          <EmptyState
            icon={<CalendarDays className="h-10 w-10 text-payroll-primary" />}
            title="Leave Data Unavailable"
            description={error?.message || "Failed to load leave records. Please contact HR."}
          />
        </CardContent>
      </Card>
    );
  }

  const { balances } = balancesData;

  return (
    <div className="space-y-6">
      {/* ── Page Header & Action ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-payroll-navy tracking-tight">
            Leave Entitlement & Applications
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            Your leave balances for this leave year and your requests. Weekly offs and holidays inside a leave are not counted.
          </p>
        </div>

        <ApplyLeaveModal types={types} today={nepalDateIso()} />
      </div>

      {/* ── Leave Balance Cards ── */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
          Active Fiscal Year Balances
        </h2>

        {balances.length === 0 ? (
          <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
            <CardContent className="py-12">
              <EmptyState
                icon={<Palmtree className="h-8 w-8 text-payroll-primary" />}
                title="No leave balances allotted"
                description="You have no leave balances this leave year yet. You can still ask for leave given per event (e.g. mourning) or unpaid leave."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.map((bal) => {
              const allotted = Number(bal.allotted) || 0;
              const taken = Number(bal.taken) || 0;
              const carriedForward = Number(bal.carriedForward) || 0;
              const balance = Number(bal.balance) || 0;
              const totalAvailable = allotted + carriedForward;
              const usedPercent =
                totalAvailable > 0
                  ? Math.min(100, Math.round((taken / totalAvailable) * 100))
                  : 0;

              return (
                <Card
                  key={bal.id}
                  className="border-payroll-light/80 shadow-payroll-xs bg-white hover:shadow-payroll-sm transition-shadow"
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-payroll-cream text-payroll-primary border border-payroll-light shadow-2xs">
                          <CalendarCheck className="h-4 w-4" />
                        </div>
                        <h3 className="text-sm font-bold text-payroll-navy">
                          {bal.leaveTypeName}
                        </h3>
                      </div>
                      <Badge variant="neutral" size="sm" className="font-mono text-2xs font-bold">
                        {bal.leaveTypeCode}
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-2xl sm:text-3xl font-extrabold text-payroll-navy">
                          {balance}
                        </span>
                        <span className="text-2xs text-gray-500 font-medium ml-1.5">
                          days remaining
                        </span>
                      </div>
                      <div className="text-right text-2xs text-gray-500 font-medium space-y-0.5">
                        <p>Allotted: <strong className="text-payroll-navy">{allotted}</strong></p>
                        <p>Taken: <strong className="text-payroll-navy">{taken}</strong></p>
                        {carriedForward > 0 && (
                          <p>Carried: <strong className="text-payroll-navy">{carriedForward}</strong></p>
                        )}
                      </div>
                    </div>

                    {/* Usage Progress Meter */}
                    <div className="space-y-1">
                      <div className="h-1.5 rounded-full bg-payroll-cream overflow-hidden border border-payroll-light/60">
                        <div
                          className={`h-full rounded-full transition-all ${
                            usedPercent > 85
                              ? "bg-rose-500"
                              : usedPercent > 60
                              ? "bg-amber-500"
                              : "bg-payroll-primary"
                          }`}
                          style={{ width: `${usedPercent}%` }}
                        />
                      </div>
                      <p className="text-2xs text-gray-400 text-right font-medium">
                        {usedPercent}% used
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Leave Applications History Table ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
          <h2 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
            Leave Application History ({applications.length})
          </h2>
        </div>

        {applications.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500 font-medium">
            <Clock className="h-7 w-7 text-zinc-300 mx-auto mb-2" />
            <p className="font-semibold text-zinc-800">No leave requests submitted</p>
            <p className="text-zinc-500 text-2xs mt-0.5">Your submitted leave applications and approval reviews will be displayed here.</p>
          </div>
        ) : (
          <>
          <div className="space-y-2 sm:hidden">
            {applications.map((app) => (
              <div key={app.id} className="rounded-xl border border-payroll-border bg-white p-4 shadow-payroll-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-payroll-navy">{app.leaveTypeName}</p>
                    <p className="mt-1 font-mono text-2xs text-gray-500">{app.effectiveFrom} → {app.effectiveTo}</p>
                  </div>
                  <Badge
                    variant={
                      app.status === "Approved"
                        ? "success"
                        : app.status === "Pending"
                        ? "warning"
                        : app.status === "Rejected"
                        ? "danger"
                        : "neutral"
                    }
                    size="sm"
                  >
                    {app.status}
                  </Badge>
                </div>
                {app.status === "Pending" && (
                  <div className="mt-2">
                    <WithdrawLeaveButton id={app.id} />
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-payroll-border-light pt-3 text-xs">
                  <div>
                    <span className="block text-2xs font-medium uppercase tracking-wider text-gray-400">Duration</span>
                    <span className="mt-1 block font-mono font-semibold text-payroll-navy">{app.noOfDays} day(s){app.half ? ` (${app.half} half)` : ""}</span>
                    {Number(app.unpaidDays) > 0 && <span className="block text-2xs text-red-600">{Number(app.unpaidDays)} unpaid</span>}
                  </div>
                  <div>
                    <span className="block text-2xs font-medium uppercase tracking-wider text-gray-400">Reason</span>
                    <span className="mt-1 block truncate text-gray-600">{app.reason || "—"}</span>
                  </div>
                </div>
                {app.reviewRemarks && (
                  <p className="mt-3 border-t border-payroll-border-light pt-3 text-xs leading-relaxed text-gray-600">
                    <span className="font-semibold text-payroll-navy">Reviewer: </span>{app.reviewRemarks}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-transparent text-2xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Effective Dates</th>
                  <th className="px-4 py-3 text-center">Duration</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Reviewer Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-zinc-900">
                      {app.leaveTypeName}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600 font-mono text-2xs">
                      {app.effectiveFrom} → {app.effectiveTo}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-zinc-200/70 bg-zinc-50 text-zinc-700 font-mono text-2xs">
                        {app.noOfDays} day(s){app.half ? ` (${app.half} half)` : ""}
                      </span>
                      {Number(app.unpaidDays) > 0 && <span className="block text-2xs text-red-600">{Number(app.unpaidDays)} unpaid</span>}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600 max-w-50 truncate" title={app.reason}>
                      {app.reason || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge
                        variant={
                          app.status === "Approved"
                            ? "success"
                            : app.status === "Pending"
                            ? "warning"
                            : app.status === "Rejected"
                            ? "danger"
                            : "neutral"
                        }
                        size="sm"
                      >
                        {app.status}
                      </Badge>
                      {app.status === "Pending" && (
                        <div className="mt-1">
                          <WithdrawLeaveButton id={app.id} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 max-w-50 truncate text-2xs" title={app.reviewRemarks || ""}>
                      {app.reviewRemarks || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
