import { myTraining } from "@/lib/services/ess-extras.service";
import { essLang } from "@/lib/i18n/ess-server";
import { t, type EssKey } from "@/lib/i18n/ess";
import { Badge } from "@/components/ui/badge";
import { adToBSString } from "@/lib/utils/bs-calendar";

const bs = (iso: string) => { try { return adToBSString(new Date(`${iso}T00:00:00`)); } catch { return iso; } };

export const dynamic = "force-dynamic";

export const metadata = { title: "My training | Self-Service Portal", description: "Programmes you were nominated to, with results and service bonds." };

export default async function MyTrainingPage() {
  const lang = await essLang();
  let rows: Awaited<ReturnType<typeof myTraining>> = [];
  let problem: string | null = null;
  try {
    rows = await myTraining();
  } catch (error: unknown) {
    problem = error instanceof Error ? error.message : "Unavailable.";
  }
  const statusLabel = (s: string) => t(lang, `training.status.${s}` as EssKey);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-payroll-navy">{t(lang, "training.title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t(lang, "training.description")}</p>
      </header>
      {problem ? (
        <p className="text-sm text-rose-600">{problem}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-600">{t(lang, "training.none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-payroll-border bg-white shadow-payroll-xs">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-payroll-border text-left text-xs text-zinc-500">
                <th className="px-4 py-2">{t(lang, "training.programme")}</th>
                <th className="px-4 py-2">{t(lang, "training.dates")}</th>
                <th className="px-4 py-2 text-right">{t(lang, "training.hours")}</th>
                <th className="px-4 py-2">{t(lang, "training.status")}</th>
                <th className="px-4 py-2 text-right">{t(lang, "training.score")}</th>
                <th className="px-4 py-2">{t(lang, "training.certificate")}</th>
                <th className="px-4 py-2">{t(lang, "training.bondUntil")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-payroll-border/60">
                  <td className="px-4 py-2 font-medium text-payroll-navy">
                    {r.title}
                    {r.provider && <span className="block text-2xs font-normal text-zinc-500">{r.provider}</span>}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{bs(r.startAd)} → {bs(r.endAd)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.hours}</td>
                  <td className="px-4 py-2"><Badge variant={r.status === "completed" ? "success" : r.status === "absent" ? "danger" : "neutral"} size="sm">{statusLabel(r.status)}</Badge></td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.score ?? "—"}</td>
                  <td className="px-4 py-2">{r.certificateNo ?? "—"}</td>
                  <td className="px-4 py-2 tabular-nums">{r.bondEndsAd ? bs(r.bondEndsAd) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
