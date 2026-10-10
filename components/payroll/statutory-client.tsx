"use client";

import { useState, useTransition } from "react";
import { Download, FileCheck2, Landmark, PiggyBank, Receipt, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { Amount } from "@/components/kit/amount";
import { Notice } from "@/components/kit/notice";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { WindowButton } from "@/components/kit/window";
import { exportStatutoryFileAction, getCertificateListAction, getStatutoryMonthAction } from "@/app/actions/statutory.actions";
import { downloadTextFile } from "@/lib/export/download";
import { REVENUE_CODE, REVENUE_CODE_LABEL, STATUTORY_FILE_LABEL, type StatutoryFile } from "@/lib/constants/statutory-returns";
import type { CitRow, FundRow, FundSchedule, TdsRow } from "@/lib/engines/statutory-returns.engine";
import type { CertificateListData, CertificateListRow, StatutoryMonthData } from "@/lib/types/statutory";

// Statutory returns (4.8 / F9): the month's deposit schedules — eTDS (split into the social
// security tax and the remuneration tax), SSF, Provident Fund and CIT — from approved / locked
// payslips, each with its upload file built on the server, and the annual tax certificates.

type Tab = StatutoryFile | "certificates";

const money = (value: string) => <Amount value={Number(value)} />;
const amountColumn = <T,>(id: string, header: string, pick: (r: T) => string, width = 130): GridColumn<T> => ({
  id,
  header,
  value: (r) => Number(pick(r)),
  type: "amount",
  align: "right",
  width,
  cell: (r) => money(pick(r)),
  total: "sum",
});

const employeeColumn = <T extends { employeeName: string; employeeCode: string }>(): GridColumn<T> => ({
  id: "employee",
  header: "Employee",
  value: (r) => r.employeeName,
  sticky: true,
  width: 210,
  cell: (r) => (
    <span>
      {r.employeeName} <span className="text-ink-faint">· {r.employeeCode}</span>
    </span>
  ),
});

const numberColumn = <T extends { number: string | null }>(header: string): GridColumn<T> => ({
  id: "number",
  header,
  value: (r) => r.number ?? "",
  type: "code",
  width: 150,
  cell: (r) => (r.number ? <span className="font-mono">{r.number}</span> : <span className="text-warning">Missing</span>),
});

export function StatutoryClient({ initialMonth, initialCertificates }: { initialMonth: StatutoryMonthData; initialCertificates: CertificateListData }) {
  const [month, setMonth] = useState(initialMonth);
  const [certificates, setCertificates] = useState(initialCertificates);
  const [tab, setTab] = useState<Tab>("etds");
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const period = month.period;

  const loadMonth = (value: string) =>
    startTransition(async () => {
      const result = await getStatutoryMonthAction(value);
      if (result.success) setMonth(result.data);
      else setNotice({ tone: "danger", text: result.error });
    });

  const loadCertificates = (fiscalYearId: string) =>
    startTransition(async () => {
      const result = await getCertificateListAction(fiscalYearId);
      if (result.success) setCertificates(result.data);
      else setNotice({ tone: "danger", text: result.error });
    });

  const download = (file: StatutoryFile) =>
    startTransition(async () => {
      if (!period) return;
      const result = await exportStatutoryFileAction(file, period.value);
      if (!result.success) {
        setNotice({ tone: "danger", text: result.error });
        return;
      }
      downloadTextFile(result.data.filename, result.data.content);
      setNotice({ tone: "success", text: `${STATUTORY_FILE_LABEL[file].en} file for ${period.label} downloaded.` });
    });

  const tdsColumns: GridColumn<TdsRow>[] = [
    employeeColumn<TdsRow>(),
    { id: "pan", header: "PAN", value: (r) => r.pan ?? "", type: "code", width: 104, cell: (r) => (r.pan ? <span className="font-mono">{r.pan}</span> : <span className="text-warning">Missing</span>) },
    { id: "source", header: "Paid through", value: (r) => (r.source === "payroll" ? "Payroll" : "Final settlement"), width: 130, defaultHidden: !month.etds.rows.some((r) => r.source === "settlement") },
    { id: "date", header: "Paid on (BS)", value: (r) => r.paymentDateBs, type: "code", width: 112 },
    amountColumn<TdsRow>("gross", "Gross payment", (r) => r.gross, 130),
    amountColumn<TdsRow>("taxable", "Taxable", (r) => r.taxable, 120),
    amountColumn<TdsRow>("sst", `SST ${REVENUE_CODE.socialSecurityTax}`, (r) => r.sst, 110),
    amountColumn<TdsRow>("remuneration", `Remuneration ${REVENUE_CODE.remunerationTax}`, (r) => r.remuneration, 160),
    amountColumn<TdsRow>("tds", "TDS", (r) => r.tds, 110),
  ];

  const fundColumns = (numberLabel: string, employeeLabel: string, employerLabel: string): GridColumn<FundRow>[] => [
    employeeColumn<FundRow>(),
    numberColumn<FundRow>(numberLabel),
    amountColumn<FundRow>("base", "Contribution base", (r) => r.base, 150),
    amountColumn<FundRow>("employee", employeeLabel, (r) => r.employee),
    amountColumn<FundRow>("employer", employerLabel, (r) => r.employer),
    amountColumn<FundRow>("total", "Total", (r) => r.total),
  ];

  const citColumns: GridColumn<CitRow>[] = [employeeColumn<CitRow>(), numberColumn<CitRow>("CIT number"), amountColumn<CitRow>("amount", "Amount", (r) => r.amount, 150)];

  const certificateColumns: GridColumn<CertificateListRow>[] = [
    employeeColumn<CertificateListRow>(),
    { id: "pan", header: "PAN", value: (r) => r.pan ?? "", type: "code", width: 110, cell: (r) => (r.pan ? <span className="font-mono">{r.pan}</span> : <span className="text-warning">Missing</span>) },
    { id: "months", header: "Months", value: (r) => r.months, type: "number", align: "right", width: 90 },
    amountColumn<CertificateListRow>("gross", "Gross", (r) => r.gross, 150),
    amountColumn<CertificateListRow>("taxable", "Taxable", (r) => r.taxable, 150),
    amountColumn<CertificateListRow>("tds", "Tax withheld", (r) => r.tds, 150),
  ];

  const openCertificate = (r: CertificateListRow) => {
    if (!certificates.fiscalYearId) return;
    window.open(`/payroll/statutory/certificate/${r.employeeId}?fy=${encodeURIComponent(certificates.fiscalYearId)}`, "_blank", "noopener");
  };

  const tabs: (TabItem & { id: Tab })[] = [
    { id: "etds", label: "TDS (eTDS)", icon: Landmark, badge: month.etds.withoutPan ? <span className="text-3xs text-warning">{month.etds.withoutPan}</span> : undefined },
    { id: "ssf", label: "SSF", icon: ShieldCheck, badge: month.ssf.missingNumbers ? <span className="text-3xs text-warning">{month.ssf.missingNumbers}</span> : undefined },
    { id: "pf", label: "Provident Fund", icon: PiggyBank, badge: month.pf.missingNumbers ? <span className="text-3xs text-warning">{month.pf.missingNumbers}</span> : undefined },
    { id: "cit", label: "CIT", icon: Wallet, badge: month.cit.missingNumbers ? <span className="text-3xs text-warning">{month.cit.missingNumbers}</span> : undefined },
    { id: "certificates", label: "Tax certificates", icon: FileCheck2 },
  ];

  const fileButton = (file: StatutoryFile, rows: number) =>
    month.permissions.export && period ? (
      <WindowButton variant="primary" onClick={() => download(file)} disabled={pending || rows === 0}>
        <Download className="h-3.5 w-3.5" /> Download {STATUTORY_FILE_LABEL[file].en} file
      </WindowButton>
    ) : null;

  const missingNote = (count: number, what: string) =>
    count > 0 ? (
      <Notice tone="warning" className="mb-3">
        {count} {count === 1 ? "employee has" : "employees have"} no {what} on the record — fill it in under Workforce → Employees (Identity documents) before uploading.
      </Notice>
    ) : null;

  const fundTab = (file: "ssf" | "pf", schedule: FundSchedule, numberLabel: string, employeeLabel: string, employerLabel: string) => (
    <div className="p-3">
      {missingNote(schedule.missingNumbers, numberLabel)}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {fileButton(file, schedule.rows.length)}
        {file === "ssf" && period && <span className="text-xs text-ink-muted">Due by {period.due.ssf} (15 days after the month ends)</span>}
      </div>
      <DataGrid
        id={`statutory-${file}`}
        label={STATUTORY_FILE_LABEL[file].en}
        columns={fundColumns(numberLabel, employeeLabel, employerLabel)}
        rows={schedule.rows}
        getRowId={(r) => r.employeeId}
        rowTone={(r) => (r.number ? undefined : "warning")}
        exportModule="REPORTS_TAX_IRD"
        exportName={`${file}-schedule-${period?.value ?? ""}`}
        empty={{ title: "No contributions this month", description: "No payslip in the approved runs of this month deducts it." }}
        maxHeight="none"
      />
    </div>
  );

  return (
    <div>
      <PageBar
        title="Statutory returns"
        description="Monthly eTDS, SSF, Provident Fund and CIT schedules from approved and locked payroll, their upload files, and the annual tax certificates"
        actions={[{ id: "refresh", label: pending ? "Loading…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: pending, onClick: () => period && loadMonth(period.value) }]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      {month.partialScope && (
        <Notice tone="info" className="mb-3">
          Only employees in your branches or departments are included. The deposit files for the whole company need a company-wide role.
        </Notice>
      )}

      {tab !== "certificates" && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          {month.periods.length > 0 ? (
            <div className="w-52">
              <SelectField aria-label="Pay month" options={month.periods.map((p) => ({ value: p.value, label: p.label }))} value={period?.value ?? ""} onChange={loadMonth} />
            </div>
          ) : null}
          {period && (
            <>
              <span className="text-ink-muted">{period.fiscalYearLabel}</span>
              {period.finalRuns > 0 ? (
                <StatusChip status={period.lockedRuns === period.finalRuns ? "approved" : "pending"} label={`${period.lockedRuns} of ${period.finalRuns} final run${period.finalRuns === 1 ? "" : "s"} locked`} />
              ) : (
                <span className="text-xs text-ink-muted">No pay run — a final settlement was paid this month</span>
              )}
              {period.openRuns > 0 && <span className="text-xs text-warning">{period.openRuns} run{period.openRuns === 1 ? "" : "s"} still open — not included</span>}
            </>
          )}
        </div>
      )}

      {!period && tab !== "certificates" ? (
        <Notice tone="info" className="mb-3">
          No payroll run has been approved yet. The schedules appear once a run for the month is approved or locked.
        </Notice>
      ) : null}

      <Tabs variant="folder" items={tabs} value={tab} onChange={(next) => setTab(next as Tab)} label="Statutory returns">
        {tab === "etds" && (
          <div className="p-3">
            {month.etds.withoutPan > 0 && (
              <Notice tone="warning" className="mb-3">
                {month.etds.withoutPan} {month.etds.withoutPan === 1 ? "payee has" : "payees have"} tax withheld but no PAN on the record — eTDS needs the PAN.
              </Notice>
            )}
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              {month.etds.vouchers.map((v) => (
                <div key={v.revenueCode} className="rounded-md border border-line bg-surface px-3 py-2">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                    Revenue code {v.revenueCode} · {REVENUE_CODE_LABEL[v.revenueCode].np}
                  </p>
                  <p className="text-lg font-semibold tabular-nums">{money(v.tds)}</p>
                  <p className="text-2xs text-ink-muted">
                    {REVENUE_CODE_LABEL[v.revenueCode].en} · {v.transactions} transaction{v.transactions === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
              {period && (
                <div className="rounded-md border border-line bg-surface px-3 py-2">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">Deposit and file by</p>
                  <p className="text-lg font-semibold tabular-nums">{period.due.tds}</p>
                  <p className="text-2xs text-ink-muted">25 days after the month ends · {month.etds.nilPayees} paid with no tax</p>
                </div>
              )}
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {fileButton("etds", month.etds.lines.length)}
              <span className="text-xs text-ink-muted">One line per employee per revenue code: SST ({REVENUE_CODE.socialSecurityTax}) is the 1% on the first slab; SSF contributors do not pay it.</span>
            </div>
            <DataGrid
              id="statutory-etds"
              label="TDS schedule"
              columns={tdsColumns}
              rows={month.etds.rows}
              getRowId={(r) => r.key}
              rowTone={(r) => (r.pan ? undefined : "warning")}
              exportModule="REPORTS_TAX_IRD"
              exportName={`tds-schedule-${period?.value ?? ""}`}
              empty={{ title: "No tax withheld this month", description: "No payslip in the approved runs of this month withholds TDS." }}
              maxHeight="none"
            />
            <p className="mt-2 text-2xs text-ink-faint">
              <Receipt className="mr-1 inline h-3 w-3" aria-hidden />
              Leave salary paid outside payroll is not in this file yet. The column layout follows the eTDS transaction form; match it to the IRD template you upload with.
            </p>
          </div>
        )}
        {tab === "ssf" && fundTab("ssf", month.ssf, "SSF ID", "Employee 11%", "Employer 20%")}
        {tab === "pf" && fundTab("pf", month.pf, "PF number", "Employee 10%", "Employer 10%")}
        {tab === "cit" && (
          <div className="p-3">
            {missingNote(month.cit.missingNumbers, "CIT number")}
            <div className="mb-2">{fileButton("cit", month.cit.rows.length)}</div>
            <DataGrid
              id="statutory-cit"
              label="CIT statement"
              columns={citColumns}
              rows={month.cit.rows}
              getRowId={(r) => r.employeeId}
              rowTone={(r) => (r.number ? undefined : "warning")}
              exportModule="REPORTS_TAX_IRD"
              exportName={`cit-statement-${period?.value ?? ""}`}
              empty={{ title: "No CIT deducted this month" }}
              maxHeight="none"
            />
          </div>
        )}
        {tab === "certificates" && (
          <div className="p-3">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              {certificates.fiscalYears.length > 0 && (
                <div className="w-48">
                  <SelectField aria-label="Fiscal year" options={certificates.fiscalYears.map((y) => ({ value: y.id, label: y.label }))} value={certificates.fiscalYearId ?? ""} onChange={loadCertificates} />
                </div>
              )}
              <span className="text-xs text-ink-muted">Open a row for the printable certificate (पारिश्रमिक कर कट्टी प्रमाणपत्र). Only approved and locked months count.</span>
            </div>
            <DataGrid
              id="statutory-certificates"
              label="Tax certificates"
              columns={certificateColumns}
              rows={certificates.rows}
              getRowId={(r) => r.employeeId}
              onOpen={openCertificate}
              rowTone={(r) => (r.pan ? undefined : "warning")}
              exportModule="REPORTS_TAX_IRD"
              exportName="tax-withheld-by-employee"
              empty={{ title: "No approved payroll in this year" }}
              maxHeight="none"
            />
          </div>
        )}
      </Tabs>
    </div>
  );
}
