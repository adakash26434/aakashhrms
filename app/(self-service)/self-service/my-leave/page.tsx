import React from "react";
import { getMyLeaveBalances, getMyLeaveApplications } from "@/lib/services/self-service.service";
import { CalendarDays, Clock, CheckCircle2, XCircle, AlertCircle, CalendarCheck, Palmtree } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ApplyLeaveModal } from "@/components/self-service/apply-leave-modal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Leave | Self-Service Portal",
  description: "View leave balances and manage leave applications",
};

export default async function MyLeavePage() {
  let balancesData, applications;
  try {
    [balancesData, applications] = await Promise.all([
      getMyLeaveBalances(),
      getMyLeaveApplications(),
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
            Statutory leave balances (Nepal Labour Act 2074) and leave request history.
          </p>
        </div>

        {balances.length > 0 && <ApplyLeaveModal balances={balances} />}
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
                description="Your leave balances for the current fiscal year have not been initialized yet."
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
                      <Badge variant="neutral" size="sm" className="font-mono text-[10px] font-bold">
                        {bal.leaveTypeCode}
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-2xl sm:text-3xl font-extrabold text-payroll-navy">
                          {balance}
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium ml-1.5">
                          days remaining
                        </span>
                      </div>
                      <div className="text-right text-[11px] text-gray-500 font-medium space-y-0.5">
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
                      <p className="text-[10px] text-gray-400 text-right font-medium">
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
        <h2 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
          Leave Application History ({applications.length})
        </h2>

        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white overflow-hidden">
          {applications.length === 0 ? (
            <CardContent className="py-12">
              <EmptyState
                icon={<Clock className="h-8 w-8 text-payroll-primary" />}
                title="No leave requests submitted"
                description="Your submitted leave applications and approval reviews will be displayed here."
              />
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-payroll-cream/70 text-payroll-navy font-bold uppercase tracking-wider border-b border-payroll-light text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-4 py-3.5">Effective Dates</th>
                    <th className="px-4 py-3.5 text-center">Duration</th>
                    <th className="px-4 py-3.5">Reason</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5">Reviewer Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-payroll-light/50 bg-white">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-payroll-cream/40 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-payroll-navy">
                        {app.leaveTypeName}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 font-mono text-[11px]">
                        {app.effectiveFrom} → {app.effectiveTo}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-payroll-cream text-payroll-navy font-bold text-[11px] border border-payroll-light">
                          {app.noOfDays} day(s)
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 max-w-[200px] truncate" title={app.reason}>
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
                          className="font-bold"
                        >
                          {app.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 max-w-[200px] truncate text-[11px]" title={app.reviewRemarks || ""}>
                        {app.reviewRemarks || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
