export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getDashboardSnapshot, type DashboardParams } from "@/lib/services/dashboard.service";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Payroll cost, statutory dues, attendance and the work that needs attention.",
};

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<DashboardParams> }) {
  const params = (await searchParams) ?? {};
  let data;
  try {
    // Sign-in, permissions, scope and filter validation are applied inside (S3, S17).
    data = await getDashboardSnapshot(params);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized")) redirect("/login");
    throw error;
  }
  return <DashboardClient data={data} />;
}
