export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/auth/client-ip";
import { AttendanceClient } from "@/components/attendance/attendance-client";
import { getAttendancePage } from "@/lib/services/attendance.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope, hasPermission } from "@/lib/auth/check-permission";
import { ATTENDANCE_TABS, type AttendanceTab } from "@/lib/types/attendance";
import { readWorkingPeriod } from "@/lib/utils/working-period.server";

export const metadata: Metadata = {
  title: "Attendance | AakashHRMS",
  description: "Who is in today, the monthly register, adjustments, month close for payroll and the punch log.",
};

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ tab?: string; year?: string; month?: string; branch?: string }> }) {
  await ensureTenantContext();
  // Attendance follows the user's employee scope (S22).
  const scope = await checkPermissionWithScope("VIEW", "ATTENDANCE");
  const sp = await searchParams;
  // E1: the title bar's working period is the month when the URL names none.
  const working = (await readWorkingPeriod()).period;
  const tab: AttendanceTab = (ATTENDANCE_TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as AttendanceTab) : "today";
  const [add, edit, approve, lock, exportAllowed] = await Promise.all([
    hasPermission("ADD", "ATTENDANCE"),
    hasPermission("EDIT", "ATTENDANCE"),
    hasPermission("APPROVE", "ATTENDANCE"),
    hasPermission("LOCK", "ATTENDANCE"),
    hasPermission("EXPORT", "ATTENDANCE"),
  ]);
  const data = await getAttendancePage({
    tab,
    scope,
    userId: scope.userId,
    year: Number(sp.year) || working?.year || undefined,
    month: Number(sp.month) || working?.month || undefined,
    branchId: typeof sp.branch === "string" && sp.branch ? sp.branch : undefined,
    permissions: { add, edit, approve, lock, export: exportAllowed, settings: edit && scope.scopeType === "GLOBAL" && !scope.isImpersonation },
    // "Add this network" on the Web clock-in tab.
    clientIp: tab === "checkin" ? getClientIp(await headers()) : undefined,
  });
  return <AttendanceClient data={data} />;
}
