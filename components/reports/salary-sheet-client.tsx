"use client";

import { useMemo } from "react";
import { Landmark, Lock } from "lucide-react";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { Notice } from "@/components/kit/notice";
import {
  ReportEmptyPaper,
  ReportLetterhead,
  ReportNote,
  ReportPaper,
  ReportParam,
  ReportSignatures,
  ReportTable,
  ReportViewer,
  useReportExport,
  type ReportTableColumn,
} from "@/components/kit/report-viewer";
import { salarySheetAction } from "@/app/actions/report.actions";
import { columnTotal, groupRows, reportCsv, reportFileName, reportSheet, type ReportGroup } from "@/lib/kit/report";
import { formatAmount } from "@/lib/kit/amount";
import type { BankTransferRow, SalaryGroupBy, SalaryLineColumn, SalaryLineRow, SalarySheetData, SalarySheetRow, SalaryView } from "@/lib/types/report";
import { exportNote, PlaceParams, placeMeta, ReportNotices, titleLines, useReport } from "./report-common";

// Salary sheet (4.11, template D): an approved or locked run as printed for signature — every
// pay line (each row is the payslip's own statement), a summary, the pay lines with their totals,
// or the bank transfer list. Only the viewer's employees (S48).

const VIEWS: { value: SalaryView; label: string }[] = [
  { value: "sheet", label: "Salary sheet — every pay line" },
  { value: "summary", label: "Salary sheet — summary" },
  { value: "lines", label: "Pay lines — totals" },
  { value: "bank", label: "Bank transfer list" },
];
const GROUPS: { value: SalaryGroupBy; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "department", label: "By department" },
  { value: "branch", label: "By branch" },
];
const TITLE: Record<SalaryView, { en: string; np: string }> = {
  sheet: { en: "Salary sheet", np: "तलबी प्रतिवेदन" },
  summary: { en: "Salary sheet (summary)", np: "तलबी प्रतिवेदन (सारांश)" },
  lines: { en: "Pay lines", np: "तलबका शीर्षकगत जम्मा" },
  bank: { en: "Bank transfer list", np: "बैंक भुक्तानी सूची" },
};

const person: ReportTableColumn<SalarySheetRow>[] = [
  { id: "code", header: "Code", kind: "code", value: (r) => r.code, width: 10 },
  { id: "name", header: "Name", value: (r) => r.name, width: 24 },
  { id: "designation", header: "Designation", value: (r) => r.designation, width: 18 },
];
const amount = (id: string, header: string, headerNp: string | undefined, pick: (r: SalarySheetRow) => string | null, strong = false): ReportTableColumn<SalarySheetRow> => ({
  id,
  header,
  headerNp,
  kind: "amount",
  value: pick,
  total: true,
  width: 13,
  render: strong ? (r) => <span className="font-semibold">{formatAmount(pick(r))}</span> : undefined,
});

function sheetColumns(lines: SalaryLineColumn[]): ReportTableColumn<SalarySheetRow>[] {
  const line = (c: SalaryLineColumn) => amount(`line:${c.key}`, c.label, c.labelNp ?? undefined, (r) => r.lines[c.key] ?? null);
  return [
    ...person,
    ...lines.filter((c) => c.side === "earning").map(line),
    amount("gross", "Gross earnings", "कुल आम्दानी", (r) => r.gross),
    ...lines.filter((c) => c.side === "deduction").map(line),
    amount("deductions", "Total deductions", "कुल कट्टी", (r) => r.totalDeductions),
    amount("net", "Net payable", "खुद भुक्तानी", (r) => r.net, true),
  ];
}

const summaryColumns: ReportTableColumn<SalarySheetRow>[] = [
  ...person,
  amount("basicGrade", "Basic + grade", "तलब + ग्रेड", (r) => r.basicGrade),
  amount("allowances", "Allowances", "भत्ता", (r) => r.allowances),
  amount("gross", "Gross earnings", "कुल आम्दानी", (r) => r.gross),
  amount("retirement", "SSF / PF / CIT", "कोष कट्टी", (r) => r.retirement),
  amount("tax", "Income tax", "आयकर", (r) => r.tax),
  amount("loan", "Loan", "ऋण", (r) => r.loan),
  amount("other", "Other deductions", "अन्य कट्टी", (r) => r.otherDeductions),
  amount("deductions", "Total deductions", "कुल कट्टी", (r) => r.totalDeductions),
  amount("net", "Net payable", "खुद भुक्तानी", (r) => r.net, true),
];

const lineColumns: ReportTableColumn<SalaryLineRow>[] = [
  { id: "line", header: "Pay line", value: (r) => r.label, width: 32, render: (r) => (r.labelNp ? <>{r.label} <span className="text-ink-muted">{r.labelNp}</span></> : r.label) },
  { id: "employees", header: "Employees", kind: "number", value: (r) => r.employees, width: 11 },
  { id: "total", header: "Total", kind: "amount", value: (r) => r.total, total: true, width: 16 },
  { id: "average", header: "Average", kind: "amount", value: (r) => r.average, width: 14 },
  { id: "adjusted", header: "Typed by a reviewer", kind: "number", value: (r) => r.adjusted || null, width: 12 },
];

const bankColumns: ReportTableColumn<BankTransferRow>[] = [
  { id: "code", header: "Code", kind: "code", value: (r) => r.code, width: 10 },
  { id: "name", header: "Account holder", value: (r) => r.name, width: 26 },
  { id: "account", header: "Account number", kind: "code", value: (r) => r.account || null, width: 22, render: (r) => (r.account ? <span className="font-mono">{r.account}</span> : <span className="text-ink-muted">Cash — no account</span>) },
  { id: "net", header: "Amount", kind: "amount", value: (r) => r.net, total: true, width: 15 },
];

export function SalarySheetClient({ initial }: { initial: SalarySheetData }) {
  const { data, params, set, run, pending, error, setError } = useReport(initial, salarySheetAction);
  const { context, run: payRun, places } = data;
  const shown = data.params;
  const exporter = useReportExport("REPORTS_SALARY_SHEET", setError);
  const landscape = shown.view === "sheet" || shown.view === "summary";

  const sheetGroups = useMemo(
    () =>
      shown.groupBy === "department"
        ? groupRows(data.rows, (r) => r.department, (r) => r.department)
        : shown.groupBy === "branch"
          ? groupRows(data.rows, (r) => r.branch, (r) => r.branch)
          : undefined,
    [data.rows, shown.groupBy]
  );

  const meta = [
    ...placeMeta(context, places, shown),
    ...(shown.groupBy !== "none" && (shown.view === "sheet" || shown.view === "summary") ? [{ label: "Grouped", value: GROUPS.find((g) => g.value === shown.groupBy)!.label.replace("By ", "by ") }] : []),
  ];
  const subtitle = payRun ? [payRun.period, payRun.kind, payRun.branches].filter(Boolean).join(" · ") : "";
  const title = TITLE[shown.view];
  const fileStem = ["salary", shown.view === "sheet" ? "sheet" : shown.view, payRun?.period, payRun?.kind];

  // What the page shows, for the files.
  const sheetCols = shown.view === "sheet" ? sheetColumns(data.columns) : summaryColumns;
  const bankGroups = useMemo(() => groupRows(data.bank, (r) => r.bank, (r) => r.bank), [data.bank]);
  const lineGroups: ReportGroup<SalaryLineRow>[] = useMemo(
    () => [
      { key: "earning", label: "Earnings", rows: data.lines.filter((l) => l.side === "earning") },
      { key: "deduction", label: "Deductions", rows: data.lines.filter((l) => l.side === "deduction") },
    ],
    [data.lines]
  );
  const ready = !!payRun && data.employees > 0;
  const rowCount = landscape ? data.rows.length : shown.view === "lines" ? data.lines.length : data.bank.length;
  const lineLabel = (g: ReportGroup<SalaryLineRow>) => (g.key === "earning" ? "Gross earnings" : "Total deductions");
  const bankLabel = (g: ReportGroup<BankTransferRow>) => (g.label ? `Total — ${g.label}` : "Total — paid in cash");

  const sheets = () => {
    const lines = titleLines(context, `${title.en} — ${subtitle}`, meta);
    if (shown.view === "lines") return [reportSheet(lineColumns, data.lines, { name: title.en, title: lines, groups: lineGroups, totals: true, subtotalLabel: lineLabel, totalLabel: "Net payable (earnings − deductions)" })];
    if (shown.view === "bank") return [reportSheet(bankColumns, data.bank, { name: title.en, title: lines, groups: bankGroups, numbered: true, totals: true, subtotalLabel: bankLabel, totalLabel: "Total to pay" })];
    return [reportSheet(sheetCols, data.rows, { name: title.en, title: lines, groups: sheetGroups, numbered: true, totals: true, landscape: true })];
  };
  const csvText = () => (shown.view === "lines" ? reportCsv(lineColumns, data.lines) : shown.view === "bank" ? reportCsv(bankColumns, data.bank, { numbered: true }) : reportCsv(sheetCols, data.rows, { numbered: true }));

  // The net line of the pay-line view: earnings less deductions (it equals the sheet's net).
  const earned = columnTotal(lineColumns[2], lineGroups[0].rows) ?? 0;
  const deducted = columnTotal(lineColumns[2], lineGroups[1].rows) ?? 0;

  const letterhead = payRun && (
    <ReportLetterhead
      company={context.company}
      title={title.en}
      titleNp={title.np}
      subtitle={subtitle}
      meta={[...meta, { label: "Employees", value: String(data.employees) }]}
      printedBy={context.generatedBy}
      printedOn={context.generatedOn}
      aside={
        payRun.status === "APPROVED" ? (
          <p className="mb-1 inline-block rounded border border-warning px-1.5 py-0.5 font-semibold uppercase tracking-wide text-warning">Approved — not locked</p>
        ) : (
          <p className="mb-1 inline-flex items-center gap-1 font-semibold text-ink">
            <Lock className="h-3 w-3" aria-hidden /> Locked{payRun.lockedOn ? ` ${payRun.lockedOn}` : ""}
          </p>
        )
      }
    />
  );

  return (
    <ReportViewer
      title="Salary sheet"
      description="Approved and locked pay runs as printed for signature: every pay line, a summary, pay-line totals or the bank transfer list"
      status={payRun ? <StatusChip status={payRun.status === "LOCKED" ? "Locked" : "Approved"} /> : undefined}
      orientation={landscape ? "landscape" : "portrait"}
      paramsSummary={payRun ? `${title.en} · ${subtitle}` : undefined}
      params={
        <>
          <ReportParam label="Pay run" help={data.runs.length ? undefined : "No approved or locked run has payslips for the employees you cover."}>
            <SelectField options={data.runs} value={params.runId} onChange={(v) => set({ runId: v })} aria-label="Pay run" placeholder="No pay run yet" />
          </ReportParam>
          <ReportParam label="Report">
            <SelectField options={VIEWS} value={params.view} onChange={(v) => set({ view: v as SalaryView })} aria-label="Report" />
          </ReportParam>
          {(params.view === "sheet" || params.view === "summary") && (
            <ReportParam label="Group" help={params.view === "sheet" ? "Many pay heads? The summary fits the page better; Excel has every column." : undefined}>
              <SelectField options={GROUPS} value={params.groupBy} onChange={(v) => set({ groupBy: v as SalaryGroupBy })} aria-label="Group" />
            </ReportParam>
          )}
          <PlaceParams places={places} value={params} onChange={set} />
        </>
      }
      onRun={() => run()}
      running={pending}
      ready={ready}
      excel={context.canExport ? () => exporter.excel({ label: `${title.en} ${subtitle}`, fileName: reportFileName(fileStem, "xlsx"), rowCount, sheets, creator: context.generatedBy }) : undefined}
      csv={context.canExport ? () => exporter.csv({ label: `${title.en} ${subtitle}`, fileName: reportFileName(fileStem, "csv"), rowCount, text: csvText }) : undefined}
      exporting={exporter.exporting}
      exportNote={exportNote(context)}
      notice={
        <>
          <ReportNotices context={context} error={error} onDismiss={() => setError(null)} />
          {payRun?.status === "APPROVED" && <Notice tone="warning">This run is approved but not locked: its figures can still change until payroll locks it.</Notice>}
        </>
      }
    >
      {!payRun ? (
        <ReportEmptyPaper orientation={landscape ? "landscape" : "portrait"} icon={<Landmark className="h-5 w-5" />} title="No pay run to show" description="A salary sheet is printed from an approved or locked pay run with payslips for the employees you cover." />
      ) : (
        <ReportPaper orientation={landscape ? "landscape" : "portrait"}>
          {letterhead}
          {landscape && (
            <>
              <ReportTable columns={sheetCols} rows={data.rows} getRowId={(r) => r.slipId} groups={sheetGroups} totals dense />
              {data.rows.some((r) => r.adjusted) && <ReportNote>Some lines were typed by a reviewer instead of calculated (see Pay lines).</ReportNote>}
              {data.rows.some((r) => !r.balanced) && (
                <ReportNote>The lines of {data.rows.filter((r) => !r.balanced).map((r) => r.code).join(", ")} do not add up to the totals stored on the payslip; the totals are as paid.</ReportNote>
              )}
              <ReportSignatures
                blocks={[
                  { label: "Prepared by", name: payRun.prepared?.name, note: payRun.prepared?.on },
                  { label: "Checked by", name: payRun.checked?.name, note: payRun.checked?.on },
                  { label: "Approved by", name: payRun.approved?.name, note: payRun.approved?.on },
                ]}
              />
            </>
          )}
          {shown.view === "lines" && (
            <>
              <ReportTable columns={lineColumns} rows={data.lines} getRowId={(r) => r.key} groups={lineGroups} numbered={false} totals subtotalLabel={lineLabel} totalLabel="Earnings + deductions" />
              <p className="mt-3 flex justify-between border-y-2 border-line-strong bg-surface-sunken/60 px-1.5 py-1 text-2xs font-semibold">
                <span>Net payable (gross earnings − total deductions)</span>
                <span className="tabular-nums">{formatAmount(earned - deducted)}</span>
              </p>
              <ReportNote>Employees counts the people paid a line (not zero). Employer&apos;s PF is deposited for the employee and is not part of gross earnings.</ReportNote>
            </>
          )}
          {shown.view === "bank" && (
            <>
              <ReportTable columns={bankColumns} rows={data.bank} getRowId={(r) => r.slipId} groups={bankGroups} totals subtotalLabel={bankLabel} totalLabel="Total to pay" />
              <ReportNote>Net pay of each payslip to the account on it. People without an account are listed under cash.</ReportNote>
              <ReportSignatures blocks={(data.signatories.length ? data.signatories : [{ name: "", title: "" }]).map((s, i) => ({ label: i === 0 ? "Authorised signatory" : "Second signatory", name: s.name, note: s.title }))} />
            </>
          )}
        </ReportPaper>
      )}
    </ReportViewer>
  );
}
