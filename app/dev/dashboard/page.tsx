import { notFound } from "next/navigation";
import { DashboardPreview } from "@/components/dev/dashboard-preview";
import { parsePeriodOption } from "@/lib/engines/dashboard.engine";

export const metadata = { title: "Dashboard preview", robots: { index: false, follow: false } };

// Development-only preview of the dashboard (4.1) with sample data in every
// state (admin, branch manager, employee, failed sections, new company).
// Blocked twice in production: here and in authorized() (lib/auth/auth.config.ts).
export default async function DevDashboardPage({ searchParams }: { searchParams?: Promise<{ period?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = (await searchParams) ?? {};
  return <DashboardPreview period={parsePeriodOption(params.period)} />;
}
