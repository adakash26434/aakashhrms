"use client";

import { useState, useTransition } from "react";
import { Download, RefreshCw } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Panel } from "@/components/kit/panel";
import { Notice } from "@/components/kit/notice";
import { SelectField } from "@/components/kit/select-field";
import { DateCell } from "@/components/kit/date-cell";
import { getHrAnalyticsAction } from "@/app/actions/hr-analytics.actions";
import { authorizeExportAction } from "@/app/actions/export.actions";
import { toCsv, safeFilename } from "@/lib/export/csv";
import { downloadTextFile } from "@/lib/export/download";
import type { CountRow, ReturnRow } from "@/lib/engines/hr-analytics.engine";
import type { HrAnalyticsData } from "@/lib/types/hr-analytics";
import { cn } from "@/lib/utils";

// HR analytics (G13): KPI tiles, headcount tables and the DoC / COPOMIS staff
// return for one fiscal year, within the viewer's scope. Headcount only.

function Tile({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "warning" | "danger" }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className={cn("text-xl font-semibold tabular-nums text-ink", tone === "warning" && "text-warning", tone === "danger" && "text-danger")}>{value}</p>
      {hint && <p className="text-2xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function CountTable({ rows, label }: { rows: CountRow[]; label: string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-ink-muted">
          <th className="px-3 py-1.5">{label}</th>
          <th className="px-3 py-1.5 text-right">Total</th>
          <th className="px-3 py-1.5 text-right">Female</th>
          <th className="px-3 py-1.5 text-right">Male</th>
          <th className="px-3 py-1.5 text-right">Other</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="px-3 py-3 text-ink-muted">Nobody in scope.</td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-line/60">
            <td className="px-3 py-1.5">{r.label}</td>
            <td className="px-3 py-1.5 text-right tabular-nums font-medium">{r.count}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{r.female}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{r.male}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{r.other}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Movement and training rows carry a total only. */
const genderless = (r: ReturnRow) => r.itemNp !== "" && r.male + r.female + r.other === 0 && !/Total staff|disabilities/.test(r.item);

export function HrAnalyticsClient({ initial }: { initial: HrAnalyticsData }) {
  const [data, setData] = useState(initial);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const load = (fiscalYearId: string) =>
    startTransition(async () => {
      const result = await getHrAnalyticsAction(fiscalYearId);
      if (result.success) setData(result.data);
      else setNotice({ tone: "danger", text: result.error });
    });

  const exportReturn = () =>
    startTransition(async () => {
      const gate = await authorizeExportAction({ module: "EMPLOYEES", label: "DoC staff return (CSV)", rowCount: data.staffReturn.length });
      if (!gate.allowed) {
        setNotice({ tone: "danger", text: gate.error ?? "Export not allowed" });
        return;
      }
      const year = data.fiscalYears.find((y) => y.id === data.fiscalYearId)?.label ?? "";
      const csv = toCsv<ReturnRow>(
        [
          { header: "Item", value: (r) => r.item.trim() },
          { header: "विवरण", value: (r) => r.itemNp },
          { header: "Male", value: (r) => r.male },
          { header: "Female", value: (r) => r.female },
          { header: "Other", value: (r) => r.other },
          { header: "Total", value: (r) => r.total },
        ],
        data.staffReturn,
      );
      downloadTextFile(`${safeFilename(`staff-return-${year}`)}.csv`, csv);
      setNotice({ tone: "success", text: "Staff return exported." });
    });

  const s = data.summary;
  return (
    <div>
      <PageBar
        title="HR analytics"
        description="Headcount, movement, tenure, leave, training and the staff section of the Department of Cooperatives return — for employees in your scope, no pay figures"
        actions={[
          { id: "export", label: "Export staff return", icon: Download, group: "output", hidden: !data.permissions.export, disabled: pending, onClick: exportReturn },
          { id: "refresh", label: pending ? "Loading…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: pending, onClick: () => load(data.fiscalYearId) },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <div className="w-48">
          <SelectField options={data.fiscalYears.map((y) => ({ value: y.id, label: y.label }))} value={data.fiscalYearId} onChange={load} />
        </div>
        <span className="text-ink-muted">
          <DateCell value={data.period.startAd} /> → <DateCell value={data.period.endAd} />
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <Tile label="Active staff" value={s.active} />
        <Tile label="Female" value={`${s.femaleShare}%`} hint={`${s.female} of ${s.active}`} />
        <Tile label="Permanent" value={s.permanent} />
        <Tile label="Joined" value={s.joined} hint="this year" />
        <Tile label="Left" value={s.left} hint="this year" />
        <Tile label="Turnover" value={`${s.turnoverRate}%`} hint="left ÷ average headcount" tone={s.turnoverRate >= 20 ? "warning" : undefined} />
        <Tile label="Avg tenure" value={`${s.averageTenureYears} y`} />
        <Tile label="Avg age" value={s.averageAge} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="By branch">
          <CountTable rows={data.byBranch} label="Branch" />
        </Panel>
        <Panel title="By department">
          <CountTable rows={data.byDepartment} label="Department" />
        </Panel>
        <Panel title="By designation">
          <CountTable rows={data.byDesignation} label="Designation" />
        </Panel>
        <Panel title="By employment category">
          <CountTable rows={data.byCategory} label="Category" />
        </Panel>
        <Panel title="By age">
          <CountTable rows={data.byAge} label="Age band" />
        </Panel>
        <Panel title="Leave and cases this year" padded>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-muted">Leave applications</dt>
            <dd className="text-right tabular-nums">{data.leave.applications}</dd>
            <dt className="text-ink-muted">Approved</dt>
            <dd className="text-right tabular-nums">{data.leave.approved}</dd>
            <dt className="text-ink-muted">Approved days</dt>
            <dd className="text-right tabular-nums">{data.leave.days}</dd>
            {data.cases && (
              <>
                <dt className="text-ink-muted">Disciplinary cases</dt>
                <dd className="text-right tabular-nums">{data.cases.disciplinary}</dd>
                <dt className="text-ink-muted">Grievances</dt>
                <dd className="text-right tabular-nums">{data.cases.grievance}</dd>
                <dt className="text-ink-muted">Still open</dt>
                <dd className={cn("text-right tabular-nums", data.cases.open > 0 && "text-warning")}>{data.cases.open}</dd>
              </>
            )}
          </dl>
        </Panel>
      </div>

      <Panel title="Staff return (Department of Cooperatives / COPOMIS — कर्मचारी विवरण)" className="mt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-muted">
              <th className="px-3 py-1.5">Item</th>
              <th className="px-3 py-1.5">विवरण</th>
              <th className="px-3 py-1.5 text-right">Male</th>
              <th className="px-3 py-1.5 text-right">Female</th>
              <th className="px-3 py-1.5 text-right">Other</th>
              <th className="px-3 py-1.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.staffReturn.map((r) => (
              <tr key={r.item} className={cn("border-b border-line/60", r.item.startsWith("  ") && "text-ink-muted")}>
                <td className={cn("px-3 py-1.5", r.item.startsWith("  ") && "pl-7")}>{r.item.trim()}</td>
                <td className="px-3 py-1.5">{r.itemNp}</td>
                {(["male", "female", "other"] as const).map((g) => (
                  <td key={g} className="px-3 py-1.5 text-right tabular-nums">
                    {genderless(r) ? "—" : r[g]}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
