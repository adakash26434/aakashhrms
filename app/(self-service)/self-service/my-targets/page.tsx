import { getSessionEmployeeId } from "@/lib/services/self-service.service";
import { myTargets } from "@/lib/services/target.service";
import { essLang } from "@/lib/i18n/ess-server";
import { MyTargetsClient } from "@/components/targets/portal-targets";

export const dynamic = "force-dynamic";

export const metadata = { title: "My targets | Self-Service Portal", description: "Monthly and yearly targets, your reported achievements and their review." };

export default async function MyTargetsPage() {
  const lang = await essLang();
  let data: Awaited<ReturnType<typeof myTargets>> | null = null;
  let problem: string | null = null;
  try {
    const { employeeId, userId } = await getSessionEmployeeId();
    data = await myTargets({ employeeId, userId });
  } catch (error: unknown) {
    problem = error instanceof Error ? error.message : "Unavailable.";
  }
  if (!data) return <p className="text-sm text-danger">{problem}</p>;
  return <MyTargetsClient lang={lang} data={data} />;
}
