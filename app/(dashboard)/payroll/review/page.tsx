import { redirect } from "next/navigation";

/** The old address (before 4.8a): everything is on /payroll now. */
export default async function Redirect({ searchParams }: { searchParams?: Promise<{ runId?: string }> }) {
  const sp = searchParams ? await searchParams : {};
  redirect(typeof sp.runId === "string" ? `/payroll?run=${encodeURIComponent(sp.runId)}&tab=run` : "/payroll");
}
