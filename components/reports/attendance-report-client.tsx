"use client";

import { CalendarDays } from "lucide-react";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { Notice } from "@/components/kit/notice";
import { ReportEmptyPaper, ReportLetterhead, ReportNote, ReportPaper, ReportParam, ReportTable, ReportViewer, useReportExport, type ReportTableColumn } from "@/components/kit/report-viewer";
import { attendanceReportAction } from "@/app/actions/report.actions";
import { reportCsv, reportFileName, reportSheet, type ReportColumn } from "@/lib/kit/report";
import { DAY_CODE, DAY_TYPES } from "@/lib/types/attendance";
import type { AttendanceDayCell, AttendanceReportData, AttendanceReportRow, AttendanceView } from "@/lib/types/report";
import { exportNote, PlaceParams, placeMeta, ReportNotices, titleLines, useReport } from "./report-common";

// Attendance report (4.11, template D): a BS month from the attendance rules (punches, leave,
// holidays, shifts, HR overrides) — the monthly summary, the day register, or one attendance
// card per employee. OT pay and the absence deduction appear only for viewers who can see the
// salary sheet (S48).

const VIEWS: { value: AttendanceView; label: string }[] = [
  { value: "summary", label: "Monthly summary" },
  { value: "register", label: "Day register" },
  { value: "cards", label: "Attendance cards (one per employee)" },
];

const person: ReportTableColumn<AttendanceReportRow>[] = [
  { id: "code", header: "Code", kind: "code", value: (r) => r.code, width: 10 },
  { id: "name", header: "Name", value: (r) => r.name, width: 24 },
];
const days = (id: string, header: string, pick: (r: AttendanceReportRow) => number, total = true): ReportTableColumn<AttendanceReportRow> => ({ id, header, kind: "days", value: pick, total, width: 9 });

function summaryColumns(showAmounts: boolean, shiftAllowance: boolean): ReportTableColumn<AttendanceReportRow>[] {
  return [
    ...person,
    { id: "designation", header: "Designation", value: (r) => r.designation, width: 18 },
    days("employed", "Days employed", (r) => r.employedDays),
    days("present", "Present", (r) => r.present),
    days("half", "Half days", (r) => r.halfDays),
    days("duty", "On duty", (r) => r.onDuty),
    days("paidLeave", "Paid leave", (r) => r.paidLeave),
    days("unpaidLeave", "Unpaid leave", (r) => r.unpaidLeave),
    days("absent", "Absent", (r) => r.absent),
    days("missing", "Missing punch", (r) => r.missingPunch),
    days("holidays", "Holidays", (r) => r.holidays),
    days("off", "Weekly off", (r) => r.weeklyOff),
    days("late", "Late days", (r) => r.lateDays),
    days("otWork", "OT work days (h)", (r) => r.otWorkDayHours),
    days("otOff", "OT days off (h)", (r) => r.otOffDayHours),
    days("payable", "Payable days", (r) => r.payableDays),
    // 4.12e: days worked on shifts with an allowance (when anyone has some).
    ...(shiftAllowance ? [days("shift", "Shift allowance days", (r) => r.shiftDays)] : []),
    ...(showAmounts
      ? [
          { id: "otPay", header: "OT pay", kind: "amount" as const, value: (r: AttendanceReportRow) => r.otPay, total: true, width: 12 },
          { id: "absence", header: "Absence deduction", kind: "amount" as const, value: (r: AttendanceReportRow) => r.absenceDeduction, total: true, width: 12 },
          ...(shiftAllowance ? [{ id: "shiftPay", header: "Shift allowance", kind: "amount" as const, value: (r: AttendanceReportRow) => r.shiftAllowance, total: true, width: 12 }] : []),
        ]
      : []),
  ];
}

function registerColumns(data: AttendanceReportData): ReportTableColumn<AttendanceReportRow>[] {
  return [
    ...person,
    ...data.dayHeads.map(
      (h, i): ReportTableColumn<AttendanceReportRow> => ({
        id: `d${h.day}`,
        header: String(h.day),
        headerNp: h.weekday.slice(0, 2),
        value: (r) => r.days[i]?.code ?? "",
        width: 4,
        render: (r) => <span className={r.days[i]?.code === "A" || r.days[i]?.code === "MP" ? "font-semibold" : undefined}>{r.days[i]?.code ?? ""}</span>,
      })
    ),
    days("present", "P", (r) => r.present + r.onDuty + r.halfDays * 0.5),
    days("leave", "Leave", (r) => r.paidLeave + r.unpaidLeave),
    days("absent", "A", (r) => r.absent + r.missingPunch + r.halfDays * 0.5),
    days("payable", "Payable", (r) => r.payableDays),
  ];
}

const cardColumns = (data: AttendanceReportData): ReportTableColumn<AttendanceDayCell>[] => [
  { id: "day", header: "Day", value: (d) => `${d.day} ${data.dayHeads[d.day - 1]?.weekday ?? ""}`, width: 8, nowrap: true },
  { id: "in", header: "In", kind: "code", value: (d) => d.in, width: 7 },
  { id: "out", header: "Out", kind: "code", value: (d) => d.out, width: 7 },
  { id: "worked", header: "Worked", kind: "code", value: (d) => d.worked, width: 7 },
  { id: "status", header: "Status", value: (d) => (d.code ? `${d.code} · ${d.type}` : d.type), width: 18 },
  { id: "note", header: "Note", value: (d) => d.note, width: 30 },
];

/** Every employee's days, one row per day, for the cards' Excel and CSV. */
interface CardFileRow {
  key: string;
  code: string;
  name: string;
  day: number;
  weekday: string;
  cell: AttendanceDayCell;
}
const cardFileColumns: ReportColumn<CardFileRow>[] = [
  { id: "code", header: "Code", kind: "code", value: (r) => r.code, width: 10 },
  { id: "name", header: "Name", value: (r) => r.name, width: 24 },
  { id: "day", header: "Day", kind: "number", value: (r) => r.day, width: 6 },
  { id: "weekday", header: "Weekday", value: (r) => r.weekday, width: 8 },
  { id: "in", header: "In", kind: "code", value: (r) => r.cell.in, width: 7 },
  { id: "out", header: "Out", kind: "code", value: (r) => r.cell.out, width: 7 },
  { id: "worked", header: "Worked", kind: "code", value: (r) => r.cell.worked, width: 7 },
  { id: "status", header: "Status", value: (r) => r.cell.type, width: 16 },
  { id: "note", header: "Note", value: (r) => r.cell.note, width: 30 },
];

const LEGEND = DAY_TYPES.map((t) => `${DAY_CODE[t].code} ${DAY_CODE[t].name.toLowerCase()}`).join(" · ");

export function AttendanceReportClient({ initial }: { initial: AttendanceReportData }) {
  const { data, params, set, run, pending, error, setError } = useReport(initial, attendanceReportAction);
  const { context, places } = data;
  const shown = data.params;
  const exporter = useReportExport("REPORTS_ATTENDANCE", setError);
  const cards = shown.view === "cards";
  const meta = placeMeta(context, places, shown);
  const title = shown.view === "register" ? { en: "Attendance register", np: "हाजिरी विवरण" } : shown.view === "cards" ? { en: "Attendance card", np: "हाजिरी कार्ड" } : { en: "Attendance summary", np: "मासिक हाजिरी सारांश" };
  const columns = shown.view === "register" ? registerColumns(data) : summaryColumns(data.showAmounts, data.rows.some((r) => r.shiftDays > 0 || Number(r.shiftAllowance) > 0));
  const fileStem = ["attendance", shown.view, data.monthLabel];
  const cardRows = (): CardFileRow[] => data.rows.flatMap((r) => r.days.map((cell) => ({ key: `${r.employeeId}:${cell.day}`, code: r.code, name: r.name, day: cell.day, weekday: data.dayHeads[cell.day - 1]?.weekday ?? "", cell })));
  const rowCount = data.rows.length;

  const sheets = () => {
    const lines = titleLines(context, `${title.en} — ${data.monthLabel}`, meta);
    if (cards) return [reportSheet(cardFileColumns, cardRows(), { name: "Attendance cards", title: lines })];
    return [reportSheet(columns, data.rows, { name: title.en, title: lines, numbered: true, totals: shown.view === "summary", landscape: true })];
  };
  const csvText = () => (cards ? reportCsv(cardFileColumns, cardRows()) : reportCsv(columns, data.rows, { numbered: true }));

  return (
    <ReportViewer
      title="Attendance report"
      description="A month from the attendance rules: the summary, the day register or attendance cards"
      status={data.rows.length ? <StatusChip status={data.closed ? "Closed" : "Open"} label={data.closed ? "Month closed" : "Month open"} /> : undefined}
      orientation={cards ? "portrait" : "landscape"}
      paramsSummary={`${title.en} · ${data.monthLabel} · ${data.rows.length} employee${data.rows.length === 1 ? "" : "s"}`}
      params={
        <>
          <ReportParam label="Fiscal year">
            <SelectField options={data.periods.fiscalYears} value={params.fiscalYearId} onChange={(v) => set({ fiscalYearId: v, month: data.periods.months[v]?.[0]?.value ?? "" })} aria-label="Fiscal year" />
          </ReportParam>
          <ReportParam label="Month">
            <SelectField options={data.periods.months[params.fiscalYearId] ?? []} value={params.month} onChange={(v) => set({ month: v })} aria-label="Month" />
          </ReportParam>
          <ReportParam label="Report">
            <SelectField options={VIEWS} value={params.view} onChange={(v) => set({ view: v as AttendanceView })} aria-label="Report" />
          </ReportParam>
          <PlaceParams places={places} value={params} onChange={set} />
        </>
      }
      onRun={() => run()}
      running={pending}
      ready={data.rows.length > 0}
      excel={context.canExport ? () => exporter.excel({ label: `${title.en} ${data.monthLabel}`, fileName: reportFileName(fileStem, "xlsx"), rowCount, sheets, creator: context.generatedBy }) : undefined}
      csv={context.canExport ? () => exporter.csv({ label: `${title.en} ${data.monthLabel}`, fileName: reportFileName(fileStem, "csv"), rowCount, text: csvText }) : undefined}
      exporting={exporter.exporting}
      exportNote={exportNote(context)}
      notice={
        <>
          <ReportNotices context={context} error={error} onDismiss={() => setError(null)} />
          {data.rows.length > 0 && !data.closed && <Notice tone="info">{data.monthLabel} is not closed for payroll: the figures can still change, and days after today are not counted yet.</Notice>}
        </>
      }
    >
      {data.rows.length === 0 ? (
        <ReportEmptyPaper orientation={cards ? "portrait" : "landscape"} icon={<CalendarDays className="h-5 w-5" />} title="Nobody to show" description="No one you cover was employed in this month with these parameters." />
      ) : cards ? (
        data.rows.map((r) => (
          <ReportPaper key={r.employeeId}>
            <ReportLetterhead
              company={context.company}
              title={title.en}
              titleNp={title.np}
              subtitle={`${data.monthLabel} · ${r.name} (${r.code})`}
              meta={[
                { label: "Designation", value: r.designation || "—" },
                { label: "Department", value: r.department || "—" },
                { label: "Branch", value: r.branch || "—" },
              ]}
              printedBy={context.generatedBy}
              printedOn={context.generatedOn}
            />
            <ReportTable columns={cardColumns(data)} rows={r.days} getRowId={(d) => String(d.day)} numbered={false} />
            <p className="mt-2 text-2xs">
              Present {r.present} · half days {r.halfDays} · on duty {r.onDuty} · paid leave {r.paidLeave} · unpaid leave {r.unpaidLeave} · absent {r.absent} · missing punch {r.missingPunch} · late {r.lateDays} · OT {r.otWorkDayHours + r.otOffDayHours} h ·{" "}
              {r.shiftDays > 0 && <>shift allowance days {r.shiftDays} · </>}
              <span className="font-semibold">payable days {r.payableDays}</span>
            </p>
            <div className="mt-10 flex justify-between text-2xs">
              <p className="w-48 border-t border-line-input pt-1">Employee</p>
              <p className="w-48 border-t border-line-input pt-1 text-right">Checked by</p>
            </div>
          </ReportPaper>
        ))
      ) : (
        <ReportPaper orientation="landscape">
          <ReportLetterhead company={context.company} title={title.en} titleNp={title.np} subtitle={data.monthLabel} meta={[...meta, { label: "Employees", value: String(data.rows.length) }]} printedBy={context.generatedBy} printedOn={context.generatedOn} />
          <ReportTable columns={columns} rows={data.rows} getRowId={(r) => r.employeeId} totals={shown.view === "summary"} dense />
          <ReportNote>
            {shown.view === "register" ? `Codes: ${LEGEND}.` : "Days are counted to today. Payable days = days employed less unpaid days (absence, unpaid leave, unpaid halves)."}
            {!data.showAmounts && shown.view === "summary" && " OT pay and the absence deduction are shown to people who can see the salary sheet."}
          </ReportNote>
        </ReportPaper>
      )}
    </ReportViewer>
  );
}
