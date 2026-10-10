"use client";

import { useMemo } from "react";
import { CalendarCheck } from "lucide-react";
import { SelectField } from "@/components/kit/select-field";
import { YesNoField } from "@/components/kit/yes-no-field";
import { ReportEmptyPaper, ReportLetterhead, ReportNote, ReportPaper, ReportParam, ReportTable, ReportViewer, useReportExport, type ReportTableColumn } from "@/components/kit/report-viewer";
import { leaveReportAction } from "@/app/actions/report.actions";
import { groupRows, reportCsv, reportFileName, reportSheet } from "@/lib/kit/report";
import type { LeaveBalanceRow, LeaveMovementRow, LeaveReportData, LeaveRequestReportRow, LeaveRequestStatusFilter, LeaveView } from "@/lib/types/report";
import { exportNote, PlaceParams, placeMeta, ReportNotices, titleLines, useReport } from "./report-common";

// Leave report (4.11, template D): a leave year from the ledger — balances as the leave screens
// show them, each type's movement (brought forward, earned, taken, adjusted, paid out, expired),
// leave taken and requests. The viewer's employees only (S48); reasons only when asked for.

const VIEWS: { value: LeaveView; label: string }[] = [
  { value: "balances", label: "Balances" },
  { value: "movements", label: "Movement by leave type" },
  { value: "taken", label: "Leave taken" },
  { value: "requests", label: "Requests" },
];
const STATUSES: { value: LeaveRequestStatusFilter; label: string }[] = [
  { value: "all", label: "Every status" },
  { value: "Pending", label: "Waiting" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Cancelled", label: "Cancelled" },
];
const TITLE: Record<LeaveView, { en: string; np: string }> = {
  balances: { en: "Leave balances", np: "बिदा बाँकी विवरण" },
  movements: { en: "Leave movement", np: "बिदा हिसाब" },
  taken: { en: "Leave taken", np: "लिएको बिदा" },
  requests: { en: "Leave requests", np: "बिदा निवेदनहरू" },
};

const movementColumns: ReportTableColumn<LeaveMovementRow>[] = [
  { id: "type", header: "Leave type", value: (r) => r.leaveType, width: 20 },
  { id: "bf", header: "Brought forward", kind: "days", value: (r) => r.broughtForward, width: 10 },
  { id: "earned", header: "Earned / credited", kind: "days", value: (r) => r.earned, width: 10 },
  { id: "taken", header: "Taken", kind: "days", value: (r) => r.taken, width: 9 },
  { id: "adjusted", header: "Adjusted", kind: "days", value: (r) => r.adjusted, width: 9 },
  { id: "paidOut", header: "Paid out", kind: "days", value: (r) => r.paidOut, width: 9 },
  { id: "expired", header: "Expired / lapsed", kind: "days", value: (r) => r.expired, width: 10 },
  { id: "available", header: "Available", kind: "days", value: (r) => r.available, width: 10, render: (r) => <span className="font-semibold">{r.available}</span> },
];
const movementFileColumns: ReportTableColumn<LeaveMovementRow>[] = [
  { id: "code", header: "Code", kind: "code", value: (r) => r.code, width: 10 },
  { id: "name", header: "Name", value: (r) => r.name, width: 24 },
  ...movementColumns,
];

function requestColumns(view: LeaveView, reasons: boolean): ReportTableColumn<LeaveRequestReportRow>[] {
  return [
    ...(view === "requests" ? [{ id: "applied", header: "Applied", kind: "date" as const, value: (r: LeaveRequestReportRow) => r.applied, width: 11 }] : []),
    { id: "code", header: "Code", kind: "code", value: (r) => r.code, width: 10 },
    { id: "name", header: "Name", value: (r) => r.name, width: 22 },
    { id: "type", header: "Leave type", value: (r) => r.leaveType, width: 16 },
    { id: "from", header: "From", kind: "date", value: (r) => r.from, width: 11 },
    { id: "to", header: "To", kind: "date", value: (r) => r.to, width: 11 },
    { id: "days", header: "Days", kind: "days", value: (r) => r.days, total: view === "taken", width: 7 },
    ...(view === "taken"
      ? [
          { id: "paid", header: "Paid", kind: "days" as const, value: (r: LeaveRequestReportRow) => r.paidDays, total: true, width: 7 },
          { id: "unpaid", header: "Unpaid", kind: "days" as const, value: (r: LeaveRequestReportRow) => r.unpaidDays, total: true, width: 7 },
        ]
      : [
          { id: "status", header: "Status", value: (r: LeaveRequestReportRow) => (r.status === "Pending" ? "Waiting" : r.status), width: 10 },
          { id: "decided", header: "Decided by", value: (r: LeaveRequestReportRow) => r.decidedBy || null, width: 18 },
        ]),
    ...(reasons ? [{ id: "reason", header: "Reason", value: (r: LeaveRequestReportRow) => r.reason, width: 34 }] : []),
  ];
}

export function LeaveReportClient({ initial }: { initial: LeaveReportData }) {
  const { data, params, set, run, pending, error, setError } = useReport(initial, leaveReportAction);
  const { context, places } = data;
  const shown = data.params;
  const exporter = useReportExport("REPORTS_LEAVE", setError);
  const title = TITLE[shown.view];
  const typeLabel = data.types.find((t) => t.value === shown.leaveTypeId)?.label;
  const meta = [...placeMeta(context, places, shown), ...(typeLabel ? [{ label: "Leave type", value: typeLabel }] : []), ...(shown.view === "requests" && shown.status !== "all" ? [{ label: "Status", value: STATUSES.find((s) => s.value === shown.status)!.label }] : [])];
  const subtitle = shown.view === "balances" || shown.view === "movements" ? `${data.yearLabel} · as of ${data.asOf} BS` : data.yearLabel;
  const landscape = shown.view !== "taken";

  const balanceColumns: ReportTableColumn<LeaveBalanceRow>[] = useMemo(
    () => [
      { id: "code", header: "Code", kind: "code", value: (r) => r.code, width: 10 },
      { id: "name", header: "Name", value: (r) => r.name, width: 24 },
      { id: "department", header: "Department", value: (r) => r.department, width: 16 },
      ...data.balanceTypes.map((t): ReportTableColumn<LeaveBalanceRow> => ({ id: `t:${t.id}`, header: t.name, kind: "days", value: (r) => r.balances[t.id] ?? null, total: true, width: 10 })),
    ],
    [data.balanceTypes]
  );
  const movementGroups = useMemo(() => groupRows(data.movements, (r) => r.code, (r) => `${r.name} · ${r.code}`), [data.movements]);
  const reqColumns = requestColumns(shown.view, shown.reasons);
  const rowCount = shown.view === "balances" ? data.balances.length : shown.view === "movements" ? data.movements.length : data.requests.length;
  const fileStem = ["leave", shown.view, data.yearLabel];

  const sheets = () => {
    const lines = titleLines(context, `${title.en} — ${subtitle}`, meta);
    if (shown.view === "balances") return [reportSheet(balanceColumns, data.balances, { name: title.en, title: lines, numbered: true, totals: true, landscape: true })];
    if (shown.view === "movements") return [reportSheet(movementFileColumns, data.movements, { name: title.en, title: lines, landscape: true })];
    return [reportSheet(reqColumns, data.requests, { name: title.en, title: lines, numbered: true, totals: shown.view === "taken", landscape })];
  };
  const csvText = () =>
    shown.view === "balances" ? reportCsv(balanceColumns, data.balances, { numbered: true }) : shown.view === "movements" ? reportCsv(movementFileColumns, data.movements) : reportCsv(reqColumns, data.requests, { numbered: true });

  return (
    <ReportViewer
      title="Leave report"
      description="A leave year from the leave ledger: balances, movement by type, leave taken and requests"
      orientation={landscape ? "landscape" : "portrait"}
      paramsSummary={`${title.en} · ${subtitle}`}
      params={
        <>
          <ReportParam label="Leave year">
            <SelectField options={data.years} value={params.fiscalYearId} onChange={(v) => set({ fiscalYearId: v })} aria-label="Leave year" />
          </ReportParam>
          <ReportParam label="Report">
            <SelectField options={VIEWS} value={params.view} onChange={(v) => set({ view: v as LeaveView })} aria-label="Report" />
          </ReportParam>
          <ReportParam label="Leave type">
            <SelectField options={data.types} value={params.leaveTypeId} onChange={(v) => set({ leaveTypeId: v })} allowEmpty placeholder="Every leave type" aria-label="Leave type" />
          </ReportParam>
          {params.view === "requests" && (
            <ReportParam label="Status">
              <SelectField options={STATUSES} value={params.status} onChange={(v) => set({ status: v as LeaveRequestStatusFilter })} aria-label="Status" />
            </ReportParam>
          )}
          {(params.view === "requests" || params.view === "taken") && (
            <ReportParam label="Show reasons" help="Reasons can be personal (illness, family); leave them out unless needed.">
              <YesNoField value={params.reasons} onChange={(v) => set({ reasons: v })} aria-label="Show reasons" />
            </ReportParam>
          )}
          <PlaceParams places={places} value={params} onChange={set} />
        </>
      }
      onRun={() => run()}
      running={pending}
      ready={rowCount > 0}
      excel={context.canExport ? () => exporter.excel({ label: `${title.en} ${data.yearLabel}`, fileName: reportFileName(fileStem, "xlsx"), rowCount, sheets, creator: context.generatedBy }) : undefined}
      csv={context.canExport ? () => exporter.csv({ label: `${title.en} ${data.yearLabel}`, fileName: reportFileName(fileStem, "csv"), rowCount, text: csvText }) : undefined}
      exporting={exporter.exporting}
      exportNote={exportNote(context)}
      notice={<ReportNotices context={context} error={error} onDismiss={() => setError(null)} />}
    >
      {!data.yearLabel || rowCount === 0 ? (
        <ReportEmptyPaper
          orientation={landscape ? "landscape" : "portrait"}
          icon={<CalendarCheck className="h-5 w-5" />}
          title={data.yearLabel ? "Nothing to show" : "No leave year"}
          description={data.yearLabel ? "No one you cover has anything for these parameters in this leave year." : "Leave years follow the fiscal years in Setup."}
        />
      ) : (
        <ReportPaper orientation={landscape ? "landscape" : "portrait"}>
          <ReportLetterhead company={context.company} title={title.en} titleNp={title.np} subtitle={subtitle} meta={meta} printedBy={context.generatedBy} printedOn={context.generatedOn} />
          {shown.view === "balances" && (
            <>
              <ReportTable columns={balanceColumns} rows={data.balances} getRowId={(r) => r.employeeId} totals dense={data.balanceTypes.length > 6} />
              <ReportNote>Days available on {data.asOf} BS, as the leave screens show them: approved leave already taken off, substitute leave expiring by its date. A blank cell: the leave type does not apply to the person.</ReportNote>
            </>
          )}
          {shown.view === "movements" && (
            <>
              <ReportTable columns={movementColumns} rows={data.movements} getRowId={(r) => r.key} groups={movementGroups} numbered={false} />
              <ReportNote>Brought forward + earned − taken + adjusted − paid out − expired = available (on {data.asOf} BS). From the leave ledger of the year.</ReportNote>
            </>
          )}
          {(shown.view === "taken" || shown.view === "requests") && (
            <>
              <ReportTable columns={reqColumns} rows={data.requests} getRowId={(r) => r.id} totals={shown.view === "taken"} />
              <ReportNote>{shown.view === "taken" ? "Approved leave in the leave year. Dates are BS." : "Requests in the leave year, in date order. Dates are BS."}</ReportNote>
            </>
          )}
        </ReportPaper>
      )}
    </ReportViewer>
  );
}
