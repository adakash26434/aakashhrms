import { myNotices } from "@/lib/services/ess-extras.service";
import { essLang } from "@/lib/i18n/ess-server";
import { t } from "@/lib/i18n/ess";
import { EssNoticeBoard } from "@/components/self-service/ess-notice-board";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notices | Self-Service Portal", description: "Company and branch notices addressed to you." };

export default async function MyNoticesPage() {
  const lang = await essLang();
  let notices: Awaited<ReturnType<typeof myNotices>> = [];
  let problem: string | null = null;
  try {
    notices = await myNotices(50);
  } catch (error: unknown) {
    problem = error instanceof Error ? error.message : "Unavailable.";
  }
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-payroll-navy">{t(lang, "notices.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t(lang, "notices.description")}</p>
      </header>
      {problem ? <p className="text-sm text-rose-600">{problem}</p> : <EssNoticeBoard notices={notices} title={t(lang, "home.noticeBoard")} empty={t(lang, "home.noNotices")} />}
    </div>
  );
}
