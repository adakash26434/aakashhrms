export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { AttendanceClient } from "@/components/attendance/attendance-client";
import { getAttendanceData } from "@/lib/services/attendance.service";
import { ensureTenantContext } from "@/lib/db";
import { checkPermission } from "@/lib/auth/check-permission";

export const metadata: Metadata = {
  title: "Attendance & OT Calculation | AakashHRMS",
  description: "Track daily employee attendance, evaluate grace windows, and lock monthly leave/OT calculations.",
};

export default async function AttendancePage() {
  await ensureTenantContext();
  await checkPermission("VIEW", "ATTENDANCE");

  const today = new Date().toISOString().split("T")[0];
  const initialData = await getAttendanceData({
    search: "",
    departmentId: "all",
    branchId: "all",
    date: today,
    status: "all",
    isLateOnly: false,
  });

  return <AttendanceClient initialData={initialData} />;
}