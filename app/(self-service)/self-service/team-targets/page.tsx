import { notFound } from "next/navigation";
import { getSessionEmployeeId } from "@/lib/services/self-service.service";
import { hasTeam, teamTargets } from "@/lib/services/target.service";
import { essLang } from "@/lib/i18n/ess-server";
import { TeamTargetsClient } from "@/components/targets/portal-targets";

export const dynamic = "force-dynamic";

export const metadata = { title: "Team targets | Self-Service Portal", description: "Review the achievements your team reported and forward them to HR." };

export default async function TeamTargetsPage() {
  const lang = await essLang();
  let ctx: { employeeId: string; userId: string };
  try {
    ctx = await getSessionEmployeeId();
  } catch (error: unknown) {
    return <p className="text-sm text-danger">{error instanceof Error ? error.message : "Unavailable."}</p>;
  }
  // Only people with someone reporting to them have this page.
  if (!(await hasTeam(ctx))) notFound();
  return <TeamTargetsClient lang={lang} data={await teamTargets(ctx)} />;
}
