"use client";

import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { ReportEmptyPaper, ReportPaper, ReportParam, ReportViewer } from "@/components/kit/report-viewer";
import { PayslipSheet } from "@/components/payroll/payslip-sheet";
import { payslipReportAction } from "@/app/actions/report.actions";
import { asPayslipLanguage, type PayslipLanguage } from "@/lib/constants/payslip-labels";
import type { PayslipReportData } from "@/lib/types/report";
import { PlaceParams, ReportNotices, useReport } from "./report-common";

// Payslips (4.11, template D; F11 sheets): the bilingual payslips of a locked run for the
// viewer's employees, one per page, ready to print or save as PDF. The salary sheet is the
// place for spreadsheets, so there is no Excel or CSV here.

const LANGUAGES = [
  { value: "both", label: "English + नेपाली" },
  { value: "en", label: "English" },
  { value: "np", label: "नेपाली" },
];
const LANG_KEY = "aakash.payslip.lang";

export function PayslipClient({ initial }: { initial: PayslipReportData }) {
  const { data, params, set, run, pending, error, setError } = useReport(initial, payslipReportAction);
  const { context, run: payRun, places, sheets } = data;
  // The language is a per-viewer convenience remembered in this browser.
  const [lang, setLangState] = useState<PayslipLanguage>("both");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a remembered choice, read once after hydration
      if (saved) setLangState(asPayslipLanguage(saved));
    } catch {
      // Storage may be blocked; English + Nepali stays.
    }
  }, []);
  const setLang = (value: string) => {
    const next = asPayslipLanguage(value);
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      // Storage may be blocked; the choice still applies on this page.
    }
  };

  const subtitle = payRun ? [payRun.period, payRun.kind, payRun.branches].filter(Boolean).join(" · ") : "";

  return (
    <ReportViewer
      title="Payslips"
      description="Payslips of a locked pay run, one per page, in English, Nepali or both"
      status={payRun ? <StatusChip status="LOCKED" /> : undefined}
      orientation="portrait"
      paramsSummary={payRun ? `${subtitle} · ${sheets.length} payslip${sheets.length === 1 ? "" : "s"}` : undefined}
      params={
        <>
          <ReportParam label="Pay run" help={data.runs.length ? "Locked runs only: payslips are final when the run is locked." : "No locked run has payslips for the employees you cover."}>
            <SelectField options={data.runs} value={params.runId} onChange={(v) => set({ runId: v })} aria-label="Pay run" placeholder="No locked run yet" />
          </ReportParam>
          <ReportParam label="Language">
            <SelectField options={LANGUAGES} value={lang} onChange={setLang} aria-label="Language" />
          </ReportParam>
          <PlaceParams places={places} value={params} onChange={set} />
        </>
      }
      onRun={() => run()}
      running={pending}
      ready={sheets.length > 0}
      notice={<ReportNotices context={context} error={error} onDismiss={() => setError(null)} />}
    >
      {sheets.length === 0 ? (
        <ReportEmptyPaper
          icon={<Receipt className="h-5 w-5" />}
          title={payRun ? "No payslips for these parameters" : "No locked pay run"}
          description={payRun ? "Nobody you cover was paid in this run with this branch, department or employee." : "Payslips are printed from locked pay runs with payslips for the employees you cover."}
        />
      ) : (
        sheets.map((sheet) => (
          <ReportPaper key={sheet.slipId}>
            <PayslipSheet data={sheet} lang={lang} bare />
          </ReportPaper>
        ))
      )}
    </ReportViewer>
  );
}
