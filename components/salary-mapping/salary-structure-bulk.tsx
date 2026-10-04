"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Columns3, Download, FileUp, ListPlus, Send, Trash2, Wand2 } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { Combobox } from "@/components/kit/combobox";
import { useDateText } from "@/components/kit/date-cell";
import { DateField } from "@/components/kit/date-field";
import { EditGrid, type EditGridColumn, type GridValueChange } from "@/components/kit/edit-grid";
import { inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton } from "@/components/kit/window";
import { authorizeExportAction } from "@/app/actions/export.actions";
import { submitSalaryChangeAction } from "@/app/actions/salary-structure.actions";
import { parseCsv, rowsToCsv, safeFilename } from "@/lib/export/csv";
import { downloadTextFile } from "@/lib/export/download";
import {
  EMPTY_LINES,
  applyTemplate,
  changedLines,
  gradeAmountFor,
  matchImport,
  structureTotals,
  templateFits,
  largeChangeWarning,
  validateLines,
  type ImportColumn,
} from "@/lib/engines/salary-structure.engine";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import type { RetirementScheme, SalaryStructureData, StructureLines, StructureRow, StructureTotals } from "@/lib/types/salary-structure";
import { cn } from "@/lib/utils";

interface GridRow {
  row: StructureRow;
  lines: StructureLines;
  original: StructureLines | null;
  totals: StructureTotals;
  originalTotals: StructureTotals | null;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  changed: boolean;
}

const SCHEME_OPTIONS = [
  { value: "ssf", label: "SSF" },
  { value: "pf", label: "PF" },
  { value: "none", label: "None" },
];
const COLUMNS_KEY = "aakash.salaryBulk.hiddenHeads";

function readHidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * Bulk edit (4.4): an Excel-like table of the chosen employees' salaries.
 * Load rows by branch / department / level (or add one person), edit with
 * the keyboard, paste from Excel, fill down, apply a template, or import a
 * CSV; then review the changes and send them as one batch.
 */
export function SalaryStructureBulk({ data, onSubmitted }: { data: SalaryStructureData; onSubmitted: () => void }) {
  const policy = data.gradePolicy;
  const settings = useMemo(() => ({ ssfBase: data.ssfBase, pfPercent: data.pfPercent }), [data.ssfBase, data.pfPercent]);
  const manualPolicy = policy?.calculationMethod === "MANUAL_INPUT";
  const gradesOff = policy?.calculationMethod === "DISABLED_NO_GRADES";
  const byId = useMemo(() => new Map(data.rows.map((r) => [r.employeeId, r])), [data.rows]);
  const levelStart = useCallback((code: string) => data.levels.find((l) => l.code === code || l.name === code)?.minSalary ?? 0, [data.levels]);

  const [ids, setIds] = useState<string[]>([]);
  const [edited, setEdited] = useState<Record<string, StructureLines>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, Record<string, string>>>({});
  const [filters, setFilters] = useState({ branch: "", dept: "", level: "" });
  const [effectiveFrom, setEffectiveFrom] = useState(nepalDateIso());
  const dateText = useDateText();
  const [reason, setReason] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  // Browser storage is only readable after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHidden(readHidden()), []);
  const [chooser, setChooser] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "warning" | "danger"; text: string; list?: string[] } | null>(null);
  const [imported, setImported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const startLines = useCallback(
    (r: StructureRow): StructureLines => r.current?.lines ?? { ...EMPTY_LINES, basic: levelStart(r.levelCode), scheme: "ssf" },
    [levelStart]
  );

  const rows: GridRow[] = useMemo(
    () =>
      ids
        .map((id) => byId.get(id))
        .filter((r): r is StructureRow => !!r)
        .map((r) => {
          const original = r.current?.lines ?? null;
          const lines = edited[r.employeeId] ?? startLines(r);
          const check = validateLines(lines, data.heads, levelStart(r.levelCode));
          return {
            row: r,
            lines,
            original,
            totals: structureTotals(lines, data.heads, settings),
            originalTotals: r.current?.totals ?? null,
            errors: { ...check.errors, ...(serverErrors[r.employeeId] ?? {}) },
            warnings: { ...check.warnings, ...(largeChangeWarning(original?.basic, lines.basic) && !check.warnings.basic ? { basic: largeChangeWarning(original?.basic, lines.basic)! } : {}) },
            changed: !original || changedLines(original, lines).length > 0,
          };
        }),
    [ids, byId, edited, data.heads, settings, levelStart, startLines, serverErrors]
  );

  /** Rows that can be loaded: active, not already in the table, with no change waiting. */
  const loadable = (r: StructureRow) => r.status !== "pending" && !ids.includes(r.employeeId);
  const waiting = data.rows.filter((r) => r.status === "pending").length;

  const loadRows = () => {
    const match = data.rows.filter(
      (r) => loadable(r) && (!filters.branch || r.branchId === filters.branch) && (!filters.dept || r.departmentId === filters.dept) && (!filters.level || r.levelCode === filters.level)
    );
    setIds((cur) => [...cur, ...match.map((r) => r.employeeId)]);
    setNotice({ tone: "info", text: `${match.length} employee${match.length === 1 ? "" : "s"} added to the table.${waiting ? ` ${waiting} with a change waiting for approval are left out.` : ""}` });
  };

  // Label heads (Basic Salary / Grade Amount) only when someone's structure holds an amount on them.
  const amountHeads = data.heads.filter((h) => h.kind === "amount" && (!h.labelOnly || data.rows.some((r) => (r.current?.lines.amounts[h.id] ?? 0) > 0)));
  const computedHeads = data.heads.filter((h) => h.kind === "computed");

  const setLines = (employeeId: string, fn: (l: StructureLines) => StructureLines) =>
    setEdited((cur) => {
      const r = byId.get(employeeId)!;
      const base = cur[employeeId] ?? startLines(r);
      const next = fn(base);
      return { ...cur, [employeeId]: { ...next, gradeAmount: next.gradeManual || manualPolicy ? next.gradeAmount : gradeAmountFor(next, policy) } };
    });

  const onChange = (changes: GridValueChange[]) => {
    setServerErrors({});
    for (const ch of changes) {
      setLines(ch.rowId, (l) => {
        const v = ch.value;
        if (ch.colId === "basic") return { ...l, basic: Number(v) || 0 };
        if (ch.colId === "gradeCount") return { ...l, gradeCount: Math.trunc(Number(v) || 0) };
        if (ch.colId === "gradeAmount") return { ...l, gradeAmount: Number(v) || 0 };
        if (ch.colId === "gradeManual") return { ...l, gradeManual: !!v };
        if (ch.colId === "scheme") return { ...l, scheme: (v as RetirementScheme) ?? "none" };
        if (ch.colId.startsWith("head:")) return { ...l, amounts: { ...l.amounts, [ch.colId.slice(5)]: Number(v) || 0 } };
        if (ch.colId.startsWith("comp:")) {
          const id = ch.colId.slice(5);
          return { ...l, computed: v ? [...new Set([...l.computed, id])] : l.computed.filter((x) => x !== id) };
        }
        return l;
      });
    }
  };

  const columns = useMemo<EditGridColumn<GridRow>[]>(() => {
    const cols: EditGridColumn<GridRow>[] = [
      { id: "code", header: "Code", kind: "readonly", pinned: true, width: 88, align: "left", value: (r) => r.row.employeeCode },
      { id: "name", header: "Employee", kind: "readonly", pinned: true, width: 170, align: "left", value: (r) => r.row.fullName },
      {
        id: "basic",
        header: "Basic",
        group: "Base pay",
        kind: "number",
        width: 108,
        value: (r) => r.lines.basic,
        original: (r) => r.original?.basic ?? 0,
        error: (r) => r.errors.basic,
        warning: (r) => r.warnings.basic,
      },
    ];
    if (!gradesOff) {
      cols.push({ id: "gradeCount", header: "Grades", group: "Base pay", kind: "number", width: 72, value: (r) => r.lines.gradeCount, original: (r) => r.original?.gradeCount ?? 0, error: (r) => r.errors.gradeCount });
      if (!manualPolicy)
        cols.push({ id: "gradeManual", header: "By hand", group: "Base pay", kind: "check", width: 70, value: (r) => r.lines.gradeManual, original: (r) => r.original?.gradeManual ?? false, hint: "Yes: type the grade amount instead of using the grade policy" });
      cols.push({
        id: "gradeAmount",
        header: "Grade amount",
        group: "Base pay",
        kind: "number",
        width: 104,
        value: (r) => r.lines.gradeAmount,
        original: (r) => r.original?.gradeAmount ?? 0,
        editable: (r) => manualPolicy || r.lines.gradeManual,
        error: (r) => r.errors.gradeAmount,
        hint: "Worked out by the grade policy unless By hand is Yes",
      });
    }
    cols.push({ id: "scheme", header: "Scheme", group: "Base pay", kind: "choice", width: 78, options: SCHEME_OPTIONS, value: (r) => r.lines.scheme, original: (r) => r.original?.scheme ?? "none", hint: "SSF, PF or None" });
    for (const h of amountHeads.filter((x) => !hidden.includes(x.id))) {
      cols.push({
        id: `head:${h.id}`,
        header: headTitle(h),
        group: h.type === "allowance" ? "Allowances" : "Deductions",
        kind: "number",
        width: 116,
        value: (r) => r.lines.amounts[h.id] ?? 0,
        original: (r) => r.original?.amounts[h.id] ?? 0,
        error: (r) => r.errors[h.id],
        warning: (r) => r.warnings[h.id],
        hint: h.rule,
      });
    }
    for (const h of computedHeads.filter((x) => !hidden.includes(x.id))) {
      cols.push({
        id: `comp:${h.id}`,
        header: h.name,
        group: "Worked out by payroll",
        kind: "check",
        width: 104,
        value: (r) => r.lines.computed.includes(h.id),
        original: (r) => !!r.original?.computed.includes(h.id),
        hint: h.rule,
      });
    }
    cols.push(
      { id: "gross", header: "Gross", group: "Monthly", kind: "readonly", width: 112, value: (r) => r.totals.gross, format: money, hint: "Basic + grade + allowances" },
      { id: "net", header: "Net before tax", group: "Monthly", kind: "readonly", width: 120, value: (r) => r.totals.netBeforeTax, format: money, hint: "Gross − deductions − SSF / PF (employee)" },
      {
        id: "change",
        header: "Change",
        group: "Monthly",
        kind: "readonly",
        width: 104,
        value: (r) => r.totals.gross - (r.originalTotals?.gross ?? 0),
        format: (v) => {
          const n = Number(v);
          if (!n) return <span className="text-ink-faint">—</span>;
          return <span className={n > 0 ? "text-success" : "text-danger"}>{n > 0 ? "+" : ""}{money(n)}</span>;
        },
      }
    );
    return cols;
  }, [amountHeads, computedHeads, hidden, gradesOff, manualPolicy]);

  const changedRows = rows.filter((r) => r.changed);
  const errorRows = rows.filter((r) => Object.keys(r.errors).length);
  const before = changedRows.reduce((n, r) => n + (r.originalTotals?.gross ?? 0), 0);
  const after = changedRows.reduce((n, r) => n + r.totals.gross, 0);
  // Employer cost (gross + SSF / PF employer share): the budget effect of the change.
  const costChange = changedRows.reduce((n, r) => n + r.totals.employerCost - (r.originalTotals?.employerCost ?? 0), 0);

  // ---------------------------------------------------------------------------
  // Templates, CSV
  // ---------------------------------------------------------------------------

  const applyTemplateToRows = () => {
    const t = data.templates.find((x) => x.id === templateId);
    if (!t) return;
    const targets = (selectedRows.length > 1 ? selectedRows : ids).filter((id) => {
      const r = byId.get(id)!;
      return templateFits(t, { levelCode: r.levelCode, designationId: r.designationId });
    });
    for (const id of targets) {
      const r = byId.get(id)!;
      setLines(id, (l) => applyTemplate(t, l, data.heads, levelStart(r.levelCode), policy));
    }
    setNotice({ tone: "info", text: `Template "${t.name}" applied to ${targets.length} row${targets.length === 1 ? "" : "s"} it fits. Ctrl+Z in the table does not undo a template; reload the rows instead.` });
  };

  const csvColumns: ImportColumn[] = useMemo(
    () => [
      { id: "basic", header: "Basic", kind: "number" },
      ...(gradesOff ? [] : [{ id: "gradeCount", header: "Grades", kind: "number" as const }, { id: "gradeAmount", header: "Grade amount (by hand only)", kind: "number" as const }]),
      { id: "scheme", header: "Scheme (SSF/PF/None)", kind: "scheme" },
      ...amountHeads.map((h) => ({ id: `head:${h.id}`, header: headTitle(h), kind: "number" as const })),
      ...computedHeads.map((h) => ({ id: `comp:${h.id}`, header: `${h.name} (Yes/No)`, kind: "yesno" as const })),
    ],
    [amountHeads, computedHeads, gradesOff]
  );

  const downloadTemplate = async () => {
    const list = rows.length ? rows.map((r) => r.row) : data.rows.filter(loadable);
    const auth = await authorizeExportAction({ module: "SALARY_MAPPING", label: "Salary bulk template", rowCount: list.length });
    if (!auth.allowed) {
      setNotice({ tone: "danger", text: auth.error ?? "You cannot export salary data." });
      return;
    }
    const lines = (r: StructureRow) => edited[r.employeeId] ?? startLines(r);
    const csv = rowsToCsv(
      ["Employee code", "Employee", ...csvColumns.map((c) => c.header)],
      list.map((r) => {
        const l = lines(r);
        return [
          r.employeeCode,
          r.fullName,
          ...csvColumns.map((c) =>
            c.id === "basic" ? l.basic : c.id === "gradeCount" ? l.gradeCount : c.id === "gradeAmount" ? (l.gradeManual ? l.gradeAmount : "") : c.id === "scheme" ? l.scheme.toUpperCase() : c.id.startsWith("head:") ? l.amounts[c.id.slice(5)] ?? 0 : l.computed.includes(c.id.slice(5)) ? "Yes" : "No"
          ),
        ];
      })
    );
    downloadTextFile(`salary-bulk-${safeFilename(effectiveFrom)}.csv`, csv);
  };

  const importFile = async (file: File) => {
    if (file.size > 2_000_000) {
      setNotice({ tone: "danger", text: "That file is too large (2 MB at most)." });
      return;
    }
    const text = await file.text();
    const table = parseCsv(text);
    const byCode = new Map(data.rows.map((r) => [r.employeeCode, r]));
    const result = matchImport(table, csvColumns, new Set(byCode.keys()));
    const skipped: string[] = [];
    const add: string[] = [];
    for (const [code, values] of result.values) {
      const r = byCode.get(code)!;
      if (r.status === "pending") {
        skipped.push(`${code}: a change is already waiting for approval`);
        continue;
      }
      if (!ids.includes(r.employeeId) && !add.includes(r.employeeId)) add.push(r.employeeId);
      onChange(Object.entries(values).map(([colId, value]) => ({ rowId: r.employeeId, colId, value: colId === "scheme" ? String(value) : value })));
      if (values.gradeAmount !== undefined && values.gradeAmount !== 0) setLines(r.employeeId, (l) => ({ ...l, gradeManual: true, gradeAmount: Number(values.gradeAmount) }));
    }
    setIds((cur) => [...cur, ...add]);
    setImported(true);
    const list = [
      ...result.unknownCodes.map((c) => `Unknown employee code: ${c}`),
      ...result.unknownColumns.map((c) => `Column not used: ${c}`),
      ...result.errors.map((e) => `${e.code} · ${e.column}: ${e.message}`),
      ...skipped,
    ];
    setNotice({
      // Rows came in: notes about the rest are a warning, cell errors stay red.
      tone: result.errors.length ? "danger" : list.length ? "warning" : "info",
      text: `Imported ${result.values.size - skipped.length} row${result.values.size - skipped.length === 1 ? "" : "s"} into the table (changed cells are marked). Nothing is saved until you send the changes.`,
      list,
    });
  };

  const submit = async () => {
    setSubmitting(true);
    const result = await submitSalaryChangeAction({
      kind: imported ? "import" : "bulk",
      effectiveFrom,
      reason,
      rows: changedRows.map((r) => ({ employeeId: r.row.employeeId, lines: r.lines })),
    });
    setSubmitting(false);
    if (!result.success) {
      setReviewing(false);
      if (result.validationErrors) setServerErrors(result.validationErrors);
      setNotice({ tone: "danger", text: result.error });
      return;
    }
    setReviewing(false);
    setIds([]);
    setEdited({});
    setReason("");
    setImported(false);
    onSubmitted();
  };

  const canReview = changedRows.length > 0 && !errorRows.length && !!effectiveFrom && reason.trim().length >= 3;
  // Said next to the button, not only in a tooltip.
  const reviewBlocker = !changedRows.length
    ? null
    : errorRows.length
      ? "Fix the cells in red first"
      : !effectiveFrom
        ? "Choose the effective date (step 2)"
        : reason.trim().length < 3
          ? "Give a reason (step 2)"
          : null;

  return (
    <div className="space-y-3 p-3 @container">
      {/* 1. Rows */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface-panel px-3 py-2">
        <StepLabel n={1} text="Employees" hint={ids.length ? `${ids.length} in the table` : "Pick who to revise"} />
        <label className="w-44 text-2xs font-medium text-ink-label">
          Branch
          <SelectField name="bulk-branch" options={data.branches.map((b) => ({ value: b.id, label: b.name }))} value={filters.branch} onChange={(v) => setFilters({ ...filters, branch: v })} placeholder="All branches" allowEmpty />
        </label>
        <label className="w-48 text-2xs font-medium text-ink-label">
          Department
          <SelectField name="bulk-dept" options={data.departments.map((d) => ({ value: d.id, label: d.name }))} value={filters.dept} onChange={(v) => setFilters({ ...filters, dept: v })} placeholder="All departments" allowEmpty />
        </label>
        <label className="w-40 text-2xs font-medium text-ink-label">
          Level
          <SelectField name="bulk-level" options={data.levels.map((l) => ({ value: l.code, label: `${l.code} · ${l.name}` }))} value={filters.level} onChange={(v) => setFilters({ ...filters, level: v })} placeholder="All levels" allowEmpty />
        </label>
        <WindowButton onClick={loadRows}>
          <ListPlus className="h-3.5 w-3.5" /> Add matching employees
        </WindowButton>
        <div className="w-60">
          <Combobox
            name="bulk-add"
            aria-label="Add one employee"
            placeholder="Add one employee…"
            options={data.rows.filter(loadable).map((r) => ({ value: r.employeeId, label: r.fullName, hint: r.employeeCode }))}
            value=""
            onChange={(v) => v && setIds((cur) => [...cur, v])}
          />
        </div>
        {ids.length > 0 && (
          <WindowButton
            onClick={() => {
              const drop = new Set(selectedRows.length ? selectedRows : []);
              setIds((cur) => cur.filter((id) => !drop.has(id)));
            }}
            disabled={!selectedRows.length}
            title="Remove the rows covered by the selection"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove selected rows
          </WindowButton>
        )}
      </div>

      {/* 2. Change details */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface-panel px-3 py-2">
        <StepLabel n={2} text="Change details" hint="Applies to every row" />
        <label className="w-76 text-2xs font-medium text-ink-label">
          Effective from <span className="text-danger">*</span>
          <DateField name="bulk-effective" value={effectiveFrom} onChange={setEffectiveFrom} />
        </label>
        <label className="min-w-60 flex-1 text-2xs font-medium text-ink-label">
          Reason <span className="text-danger">*</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Annual increment 2083/84" className={cn(inputClass, "max-w-none")} />
        </label>
        {data.templates.some((t) => t.isActive) && (
          <>
            <label className="w-52 text-2xs font-medium text-ink-label">
              Template
              <SelectField name="bulk-template" options={data.templates.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))} value={templateId} onChange={setTemplateId} placeholder="Choose…" />
            </label>
            <WindowButton onClick={applyTemplateToRows} disabled={!templateId || !ids.length} title="Applies to the selected rows (or all rows) the template fits">
              <Wand2 className="h-3.5 w-3.5" /> Apply {selectedRows.length > 1 ? `to ${selectedRows.length} selected` : "to all rows"}
            </WindowButton>
          </>
        )}
        <span className="ml-auto flex flex-wrap gap-2">
          <WindowButton onClick={() => setChooser(true)} title="Choose which pay-head columns show">
            <Columns3 className="h-3.5 w-3.5" /> Columns
          </WindowButton>
          {data.permissions.export && (
            <WindowButton onClick={downloadTemplate} title="CSV of these rows (or everyone) to fill in Excel">
              <Download className="h-3.5 w-3.5" /> Download CSV
            </WindowButton>
          )}
          <WindowButton onClick={() => fileRef.current?.click()} title="Load a filled-in CSV into the table">
            <FileUp className="h-3.5 w-3.5" /> Import CSV
          </WindowButton>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
        </span>
      </div>

      {notice && (
        <div role={notice.tone === "danger" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-xs", notice.tone === "danger" ? "border-danger/30 bg-danger-subtle text-danger" : notice.tone === "warning" ? "border-warning/40 bg-warning-subtle text-ink" : "border-info/25 bg-info-subtle text-info")}>
          <p>{notice.text}</p>
          {notice.list && notice.list.length > 0 && (
            <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-5 text-2xs">
              {notice.list.slice(0, 50).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <EditGrid
        label="Salary bulk edit"
        rows={rows}
        getRowId={(r) => r.row.employeeId}
        columns={columns}
        onChange={onChange}
        onSelectRows={setSelectedRows}
        maxHeight="calc(100vh - 430px)"
        empty={
          <span>
            Add employees with the filters above (or import a CSV), then edit their salaries here like a spreadsheet: type to replace, Ctrl+D to fill
            down, Ctrl+V to paste from Excel.
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-line-card bg-surface px-3 py-2 text-xs">
        <span>
          <span className="text-ink-muted">Rows</span> <strong className="tabular-nums">{rows.length}</strong>
        </span>
        <span>
          <span className="text-ink-muted">Changed</span> <strong className="tabular-nums">{changedRows.length}</strong>
        </span>
        {errorRows.length > 0 && <span className="font-medium text-danger">{errorRows.length} row{errorRows.length === 1 ? "" : "s"} with errors</span>}
        <span>
          <span className="text-ink-muted">Monthly gross</span> <Amount value={before} /> → <Amount value={after} emphasis />
        </span>
        <span className="text-ink-muted">Difference</span>
        <span className={cn("-ml-3 font-semibold tabular-nums", after - before > 0 ? "text-success" : after - before < 0 ? "text-danger" : "text-ink")}>
          {after - before > 0 ? "+" : ""}
          <Amount value={after - before} />
        </span>
        {reviewBlocker && <span className="ml-auto text-2xs text-warning">{reviewBlocker}</span>}
        <WindowButton variant="primary" className={reviewBlocker ? undefined : "ml-auto"} disabled={!canReview} onClick={() => setReviewing(true)} title={canReview ? undefined : "Change some rows, fix errors, and give the date and reason first"}>
          <Send className="h-3.5 w-3.5" /> Review {changedRows.length || ""} change{changedRows.length === 1 ? "" : "s"}
        </WindowButton>
      </div>

      {chooser && (
        <Window open onClose={() => setChooser(false)} title="Columns" description="Pay heads shown in the table (your choice is remembered)." size="sm" footer={<WindowButton variant="primary" onClick={() => setChooser(false)}>Done</WindowButton>}>
          <ul className="space-y-1.5 text-sm">
            {[...amountHeads, ...computedHeads].map((h) => (
              <li key={h.id}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={!hidden.includes(h.id)}
                    onChange={(e) => {
                      const next = e.target.checked ? hidden.filter((x) => x !== h.id) : [...hidden, h.id];
                      setHidden(next);
                      try {
                        localStorage.setItem(COLUMNS_KEY, JSON.stringify(next));
                      } catch {
                        /* preference only */
                      }
                    }}
                  />
                  {h.name}
                  <span className="text-2xs text-ink-faint">{h.rule}</span>
                </label>
              </li>
            ))}
          </ul>
        </Window>
      )}

      {reviewing && (
        <Window
          open
          onClose={submitting ? () => {} : () => setReviewing(false)}
          size="xl"
          title={`Review ${changedRows.length} salary change${changedRows.length === 1 ? "" : "s"}`}
          description={`Effective from ${dateText(effectiveFrom)} · ${reason}`}
          footer={
            <>
              <span className="mr-auto text-2xs text-ink-muted">{data.approvalRequired ? "Sent for approval by someone else; nothing changes until then." : "Takes effect once saved."}</span>
              <WindowButton onClick={() => setReviewing(false)} disabled={submitting}>
                Back to the table
              </WindowButton>
              <WindowButton variant="primary" onClick={submit} disabled={submitting}>
                <Send className="h-3.5 w-3.5" /> {data.approvalRequired ? "Send for approval" : "Save changes"}
              </WindowButton>
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className="border-b border-line-strong text-left text-2xs uppercase tracking-wide text-ink-muted">
                  <th className="py-1.5 pr-2">Employee</th>
                  <th className="py-1.5 pr-2">What changes</th>
                  <th className="py-1.5 pr-2 text-right">Gross now</th>
                  <th className="py-1.5 pr-2 text-right">New gross</th>
                  <th className="py-1.5 text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {changedRows.map((r) => {
                  const was = r.originalTotals?.gross ?? 0;
                  const diff = r.totals.gross - was;
                  const parts = r.original ? describeChanges(r.original, r.lines, data.heads) : ["New structure"];
                  return (
                    <tr key={r.row.employeeId} className="border-b border-line">
                      <td className="py-1.5 pr-2">
                        <span className="font-medium text-ink">{r.row.fullName}</span> <span className="font-code text-3xs text-ink-faint">{r.row.employeeCode}</span>
                      </td>
                      <td className="py-1.5 pr-2 text-ink-muted">
                        {parts.map((p) => (
                          <span key={p} className="block">
                            {p}
                          </span>
                        ))}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <Amount value={was} />
                      </td>
                      <td className="py-1.5 pr-2 text-right font-medium">
                        <Amount value={r.totals.gross} />
                      </td>
                      <td className={cn("py-1.5 text-right font-medium", diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "")}>
                        {diff > 0 ? "+" : ""}
                        <Amount value={diff} />
                        {was > 0 && <span className="ml-1 text-3xs">({((diff / was) * 100).toFixed(1)}%)</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2" colSpan={2}>
                    Total monthly gross
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <Amount value={before} />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <Amount value={after} />
                  </td>
                  <td className="py-2 text-right">
                    {after - before > 0 ? "+" : ""}
                    <Amount value={after - before} />
                  </td>
                </tr>
                <tr className="text-ink-muted">
                  <td className="pb-2" colSpan={4}>
                    Employer cost per month (gross + employer SSF / PF)
                  </td>
                  <td className="pb-2 text-right font-medium">
                    {costChange > 0 ? "+" : ""}
                    <Amount value={costChange} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Window>
      )}
    </div>
  );
}

/** Numbered step title at the start of a setup strip ("1 Employees · Pick who to revise"). */
function StepLabel({ n, text, hint }: { n: number; text: string; hint: string }) {
  return (
    <p className="mb-0.5 flex w-full items-baseline gap-2 text-xs">
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand text-3xs font-semibold text-white">{n}</span>
      <span className="font-semibold text-ink">{text}</span>
      <span className="text-2xs text-ink-faint">{hint}</span>
    </p>
  );
}

const money = (v: unknown) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SCHEME_NAME: Record<RetirementScheme, string> = { ssf: "SSF", pf: "PF", none: "None" };

/** What changed for one employee, with old → new values ("Basic 22,000.00 → 24,500.00"). */
function describeChanges(before: StructureLines, after: StructureLines, heads: SalaryStructureData["heads"]): string[] {
  const name = (id: string) => heads.find((h) => h.id === id)?.name ?? "Pay head";
  return changedLines(before, after).map((k) => {
    if (k === "basic") return `Basic ${money(before.basic)} → ${money(after.basic)}`;
    if (k === "gradeCount") return `Grades ${before.gradeCount} → ${after.gradeCount}`;
    if (k === "gradeAmount") return `Grade ${money(before.gradeAmount)} → ${money(after.gradeAmount)}${after.gradeManual ? " (by hand)" : ""}`;
    if (k === "scheme") return `Scheme ${SCHEME_NAME[before.scheme]} → ${SCHEME_NAME[after.scheme]}`;
    if (k === "computed") {
      const added = after.computed.filter((id) => !before.computed.includes(id)).map(name);
      const removed = before.computed.filter((id) => !after.computed.includes(id)).map(name);
      return [added.length ? `Adds ${added.join(", ")}` : "", removed.length ? `Removes ${removed.join(", ")}` : ""].filter(Boolean).join("; ");
    }
    return `${name(k)} ${money(before.amounts[k] ?? 0)} → ${money(after.amounts[k] ?? 0)}`;
  });
}

/** Column title for a pay head; label heads ("Grade Amount") are told apart from the base-pay columns. */
const headTitle = (h: SalaryStructureData["heads"][number]) => (h.labelOnly ? `${h.name} (pay head)` : h.name);
