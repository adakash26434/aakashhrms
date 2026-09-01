import { getMyLeaveBalances, getMyLeaveApplications } from "@/lib/services/self-service.service";
import { CalendarDays, Clock, CheckCircle2, XCircle, AlertCircle, CalendarCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Leave | Self-Service Portal",
  description: "View your leave balances and applications",
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
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-gray-200 bg-white">
        <CalendarDays className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Leave Data Unavailable</h2>
        <p className="text-sm text-gray-500">{error?.message || "Failed to load leave data."}</p>
      </div>
    );
  }

  const { balances } = balancesData;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#1b3a1f]">My Leave</h1>

      {/* Leave Balance Cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 mb-3">Leave Balances</h2>
        {balances.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
            <p className="text-sm text-gray-500">No leave balances allotted for the current fiscal year.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.map((bal) => {
              const allotted = Number(bal.allotted) || 0;
              const taken = Number(bal.taken) || 0;
              const carriedForward = Number(bal.carriedForward) || 0;
              const balance = Number(bal.balance) || 0;
              const totalAvailable = allotted + carriedForward;
              const usedPercent = totalAvailable > 0 ? Math.round((taken / totalAvailable) * 100) : 0;

              return (
                <div
                  key={bal.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarCheck className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-bold text-[#1b3a1f]">{bal.leaveTypeName}</h3>
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 uppercase">{bal.leaveTypeCode}</span>
                  </div>

                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <p className="text-2xl font-bold text-emerald-700">{balance}</p>
                      <p className="text-[10px] text-gray-400">days remaining</p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>Allotted: {allotted}</p>
                      <p>Taken: {taken}</p>
                      {carriedForward > 0 && <p>Carried: {carriedForward}</p>}
                    </div>
                  </div>

                  {/* Usage Bar */}
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usedPercent > 80 ? 'bg-red-400' : usedPercent > 50 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(usedPercent, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 text-right">{usedPercent}% used</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leave Applications History */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 mb-3">Leave Applications</h2>
        {applications.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
            <p className="text-sm text-gray-500">No leave applications submitted yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Leave Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Period</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Days</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reason</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-[#1b3a1f]">{app.leaveTypeName}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {app.effectiveFrom} → {app.effectiveTo}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-700">{app.noOfDays}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">{app.reason || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[150px] truncate">{app.reviewRemarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ComponentType<{ className?: string }>; bg: string; text: string }> = {
    Pending: { icon: Clock, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
    Approved: { icon: CheckCircle2, bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
    Rejected: { icon: XCircle, bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
    Cancelled: { icon: AlertCircle, bg: 'bg-gray-100 border-gray-200', text: 'text-gray-600' },
  };
  const c = config[status] || config.Pending;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${c.bg} ${c.text}`}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}
