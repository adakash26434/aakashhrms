import { GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { t, type EssLang } from "@/lib/i18n/ess";
import { ATTACHMENT_KINDS, QUALIFICATION_LEVELS, type EmployeeDossierInput } from "@/lib/types/employee-dossier";

// Self-service: the employee's own qualifications, past jobs and papers on
// file, read-only (names, dates and whether a scan exists — the scans stay with
// HR). Corrections go through HR.

const levelLabel = (code: string) => QUALIFICATION_LEVELS.find((l) => l.code === code)?.label ?? code;
const kindLabel = (code: string) => ATTACHMENT_KINDS.find((k) => k.code === code)?.label ?? code;

function Group({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-payroll-navy">{title}</h4>
      {children.length === 0 ? <p className="text-xs italic text-gray-400">{empty}</p> : <ul className="divide-y divide-payroll-light/40">{children}</ul>}
    </section>
  );
}

export function EssDossier({ dossier, lang }: { dossier: EmployeeDossierInput; lang: EssLang }) {
  const none = t(lang, "dossier.none");
  const scan = t(lang, "dossier.scan");
  return (
    <Card className="border-payroll-light/80 bg-white shadow-payroll-xs">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center gap-2 border-b border-payroll-light/60 pb-3">
          <GraduationCap className="h-4 w-4 text-payroll-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-payroll-navy">{t(lang, "dossier.title")}</h3>
        </div>
        <Group title={t(lang, "dossier.education")} empty={none}>
          {dossier.qualifications.map((q, i) => (
            <li key={q.id ?? i} className="flex flex-wrap items-baseline justify-between gap-x-4 py-1.5 text-xs">
              <span className="font-bold text-payroll-navy">
                {q.degree} <span className="font-medium text-gray-500">· {levelLabel(q.level)}</span>
              </span>
              <span className="text-gray-600">{[q.institution, q.board, q.passedYear, q.division].filter(Boolean).join(" · ")}{q.file ? ` · ${scan}` : ""}</span>
            </li>
          ))}
        </Group>
        <Group title={t(lang, "dossier.past")} empty={none}>
          {dossier.workHistory.map((w, i) => (
            <li key={w.id ?? i} className="flex flex-wrap items-baseline justify-between gap-x-4 py-1.5 text-xs">
              <span className="font-bold text-payroll-navy">
                {w.organisation} <span className="font-medium text-gray-500">· {w.designation}</span>
              </span>
              <span className="text-gray-600">{w.fromAd} → {w.toAd || t(lang, "dossier.present")}{w.file ? ` · ${scan}` : ""}</span>
            </li>
          ))}
        </Group>
        <Group title={t(lang, "dossier.attachments")} empty={none}>
          {dossier.attachments.map((a, i) => (
            <li key={a.id ?? i} className="flex flex-wrap items-baseline justify-between gap-x-4 py-1.5 text-xs">
              <span className="font-bold text-payroll-navy">{a.title}</span>
              <span className="text-gray-600">{kindLabel(a.kind)}</span>
            </li>
          ))}
        </Group>
      </CardContent>
    </Card>
  );
}
