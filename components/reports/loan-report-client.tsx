"use client";

import { HandCoins } from "lucide-react";
import { SelectField } from "@/components/kit/select-field";
import { ReportEmptyPaper, ReportLetterhead, ReportNote, ReportPaper, ReportParam, ReportTable, ReportViewer, useReportExport, type ReportTableColumn } from "@/components/kit/report-viewer";
import { loanReportAction } from "@/app/actions/report.actions";
import { reportCsv, reportFileName, reportSheet } from "@/lib/kit/report";
import type { LoanRepaymentReportRow, LoanReportData, LoanReportRow, LoanReportView, LoanStatusFilter } from "@/lib/types/report";
import { exportNote, PlaceParams, placeMeta, ReportNotices, titleLines, useReport } from "./report-common";

// Loan report (4.11, template D): the loan register (what each loan owes now), repayments in a
// period and loans given in a period — from the 4.10 register, for the viewer's employees (S47 /
// S48). Amounts are as recorded; payroll deductions appear once their pay run is locked.

const VIEWS: { value: LoanReportView; label: string }[] = [
  { value: "loans", label: "Loan register" },
  { value: "repayments", label: "Repayments" },
  { value: "given", label: "Loans given" },
];
const STATUSES: { value: LoanStatusFilter; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "Running and closed" },
];
const TITLE: Record<LoanReportView, { en: string; np: string }> = {
  loans: { en: "Loan register", np: "कर्मचारी ऋण विवरण" },
  repayments: { en: "Loan repayments", np: "ऋण असुली विवरण" },
  given: { en: "Loans given", np: "प्रदान गरिएको ऋण" },
};

const money = (id: string, header: string, pick: (r: LoanReportRow) => string, total = true): ReportTableColumn<LoanReportRow> => ({ id, header, kind: "amount", value: pick, total, width: 13 });
const who: ReportTableColumn<LoanReportRow>[] = [
  { id: "code", header: "Code", kind: "code", value: (r) => r.code, width: 10 },
  { id: "name", header: "Name", value: (r) => r.name, width: 22 },
  { id: "type", header: "Loan type", value: (r) => r.loanType, width: 18 },
];

const registerColumns: ReportTableColumn<LoanReportRow>[] = [
  ...who,
  { id: "given", header: "Given (BS)", kind: "date", value: (r) => r.given, width: 11 },
  money("amount", "Amount", (r) => r.amount),
  money("interest", "Interest", (r) => r.interest),
  money("total", "Total to repay", (r) => r.totalPayable),
  money("repaid", "Repaid", (r) => r.repaid),
  money("writtenOff", "Written off", (r) => r.writtenOff),
  money("balance", "Balance", (r) => r.balance),
  money("installment", "Each month", (r) => r.installment, false),
  { id: "left", header: "Months left", kind: "number", value: (r) => r.installmentsLeft, width: 8 },
  { id: "status", header: "Status", value: (r) => r.status, width: 14 },
];

const givenColumns: ReportTableColumn<LoanReportRow>[] = [
  { id: "given", header: "Given (BS)", kind: "date", value: (r) => r.given, width: 11 },
  ...who,
  money("amount", "Amount", (r) => r.amount),
  money("interest", "Interest", (r) => r.interest),
  money("total", "Total to repay", (r) => r.totalPayable),
  money("installment", "Each month", (r) => r.installment, false),
  { id: "via", header: "Paid out by", value: (r) => r.paidVia, width: 16 },
  { id: "ref", header: "Reference", kind: "code", value: (r) => r.reference || null, width: 16 },
];

const repaymentColumns: ReportTableColumn<LoanRepaymentReportRow>[] = [
  { id: "date", header: "Date (BS)", kind: "date", value: (r) => r.date, width: 11 },
  { id: "code", header: "Code", kind: "code", value: (r) => r.code, width: 10 },
  { id: "name", header: "Name", value: (r) => r.name, width: 22 },
  { id: "type", header: "Loan type", value: (r) => r.loanType, width: 18 },
  { id: "amount", header: "Amount", kind: "amount", value: (r) => r.amount, total: true, width: 13 },
  { id: "how", header: "How", value: (r) => r.how, width: 18 },
  { id: "note", header: "Note", value: (r) => r.note || null, width: 24 },
];

export function LoanReportClient({ initial }: { initial: LoanReportData }) {
  const { data, params, set, run, pending, error, setError } = useReport(initial, loanReportAction);
  const { context, places } = data;
  const shown = data.params;
  const exporter = useReportExport("REPORTS_LOAN", setError);
  const title = TITLE[shown.view];
  const typeLabel = data.types.find((t) => t.value === shown.loanTypeId)?.label;
  const meta = [
    ...placeMeta(context, places, shown),
    ...(typeLabel ? [{ label: "Loan type", value: typeLabel }] : []),
    ...(shown.view === "loans" ? [{ label: "Loans", value: STATUSES.find((s) => s.value === shown.status)!.label }] : []),
  ];
  const subtitle = shown.view === "loans" ? `As of ${context.generatedOn.slice(0, 10)} BS` : data.periodLabel;
  const portrait = shown.view === "repayments";
  const rowCount = shown.view === "repayments" ? data.repayments.length : data.loans.length;
  const fileStem = ["loans", shown.view, shown.view === "loans" ? shown.status : data.periodLabel];
  const loanColumns = shown.view === "given" ? givenColumns : registerColumns;

  const sheets = () => {
    const lines = titleLines(context, `${title.en} — ${subtitle}`, meta);
    if (shown.view === "repayments") return [reportSheet(repaymentColumns, data.repayments, { name: title.en, title: lines, numbered: true, totals: true })];
    return [reportSheet(loanColumns, data.loans, { name: title.en, title: lines, numbered: true, totals: true, landscape: true })];
  };
  const csvText = () => (shown.view === "repayments" ? reportCsv(repaymentColumns, data.repayments, { numbered: true }) : reportCsv(loanColumns, data.loans, { numbered: true }));
  const months = data.periods.months[params.fiscalYearId] ?? [];

  return (
    <ReportViewer
      title="Loan report"
      description="The loan register, repayments in a period and loans given in a period"
      orientation={portrait ? "portrait" : "landscape"}
      paramsSummary={`${title.en} · ${subtitle}`}
      params={
        <>
          <ReportParam label="Report">
            <SelectField options={VIEWS} value={params.view} onChange={(v) => set({ view: v as LoanReportView })} aria-label="Report" />
          </ReportParam>
          {params.view === "loans" ? (
            <ReportParam label="Loans">
              <SelectField options={STATUSES} value={params.status} onChange={(v) => set({ status: v as LoanStatusFilter })} aria-label="Loans" />
            </ReportParam>
          ) : (
            <>
              <ReportParam label="Fiscal year">
                <SelectField options={data.periods.fiscalYears} value={params.fiscalYearId} onChange={(v) => set({ fiscalYearId: v, month: "" })} aria-label="Fiscal year" />
              </ReportParam>
              <ReportParam label="Month">
                <SelectField options={months} value={params.month} onChange={(v) => set({ month: v })} allowEmpty placeholder="The whole year" aria-label="Month" />
              </ReportParam>
            </>
          )}
          <ReportParam label="Loan type">
            <SelectField options={data.types} value={params.loanTypeId} onChange={(v) => set({ loanTypeId: v })} allowEmpty placeholder="Every loan type" aria-label="Loan type" />
          </ReportParam>
          <PlaceParams places={places} value={params} onChange={set} />
        </>
      }
      onRun={() => run()}
      running={pending}
      ready={rowCount > 0}
      excel={context.canExport ? () => exporter.excel({ label: `${title.en} ${subtitle}`, fileName: reportFileName(fileStem, "xlsx"), rowCount, sheets, creator: context.generatedBy }) : undefined}
      csv={context.canExport ? () => exporter.csv({ label: `${title.en} ${subtitle}`, fileName: reportFileName(fileStem, "csv"), rowCount, text: csvText }) : undefined}
      exporting={exporter.exporting}
      exportNote={exportNote(context)}
      notice={<ReportNotices context={context} error={error} onDismiss={() => setError(null)} />}
    >
      {rowCount === 0 ? (
        <ReportEmptyPaper orientation={portrait ? "portrait" : "landscape"} icon={<HandCoins className="h-5 w-5" />} title="Nothing to show" description="No loan of the people you cover matches these parameters." />
      ) : (
        <ReportPaper orientation={portrait ? "portrait" : "landscape"}>
          <ReportLetterhead company={context.company} title={title.en} titleNp={title.np} subtitle={subtitle} meta={meta} printedBy={context.generatedBy} printedOn={context.generatedOn} />
          {shown.view === "repayments" ? (
            <>
              <ReportTable columns={repaymentColumns} rows={data.repayments} getRowId={(r) => r.id} totals />
              <ReportNote>Payroll deductions are recorded when their pay run is locked; a final settlement closes what was left.</ReportNote>
            </>
          ) : (
            <>
              <ReportTable columns={loanColumns} rows={data.loans} getRowId={(r) => r.loanId} totals dense />
              <ReportNote>
                {shown.view === "loans"
                  ? "Balance = total to repay − repaid − written off. Interest is flat, once on the amount. Loans recorded from before this system say so under Paid out by in Loans given."
                  : "Loans paid out in the period, with the terms they were given on."}
              </ReportNote>
            </>
          )}
        </ReportPaper>
      )}
    </ReportViewer>
  );
}
