"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Columns3, Download, FileUp, ListPlus, Send, Trash2, TrendingUp, Undo2, Wand2 } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { Combobox } from "@/components/kit/combobox";
import { Notice } from "@/components/kit/notice";
import { useDateText } from "@/components/kit/date-cell";
import { SaveButtons, SaveOutcome, describeChanges, money, saveOutcome } from "./salary-structure-approval";
import { DateField } from "@/components/kit/date-field";
import { EditGrid, type EditGridColumn, type GridValueChange } from "@/components/kit/edit-grid";
import { inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton } from "@/components/kit/window";
import { authorizeExportAction } from "@/app/actions/export.actions";
import { submitSalaryChangeAction } from "@/app/actions/salary-structure.actions";
import type { SubmitResult } from "@/lib/services/salary-structure.service";
import { parseCsv, rowsToCsv, safeFilename } from "@/lib/export/csv";
import { downloadTextFile } from "@/lib/export/download";
import {
  EMPTY_LINES,
  applyTemplate,
  changedLines,
  estimatePay,
  gradeAmountFor,
  headAppliesTo,
  matchImport,
  needsStructure,
  setupEffectiveFrom,
  setupLines,
  templateFits,
  templatesFor,
  largeChangeWarning,
  validateLines,
  type ImportColumn,
} from "@/lib/engines/salary-structure.engine";
import { applyIncrement, describeRule, type IncrementContext } from "@/lib/engines/increment.engine";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { SalaryIncrementWindow, type IncrementTarget } from "./salary-increment-window";
import type { RetirementScheme, SalaryStructureData, StructureLines, StructureRow, StructureTotals, TemplateRow } from "@/lib/types/salary-structure";
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
 *
 * Bulk add (4.4b): everyone with no structure yet or only basic + grade, each
 * filled from the first template that fits and SSF where expected, sent as
 * one set-up batch (unchanged rows confirm basic + grade only).
 *
 * From a template (Templates → Apply to employees): everyone it fits, with the
 * template applied, ready to check and send through approval.
 *
 * Mass increment (4.8 / F14): one rule (basic by % or amount, or raised to the level's
 * starting salary; grades added) for the chosen employees, applied to the table and sent as
 * one "increment" batch through approval.
 */
export function SalaryStructureBulk({
  data,
  onSubmitted,
  setup = false,
  onLeaveSetup,
  templatePreset = null,
  incrementPreset = false,
}: {
  data: SalaryStructureData;
  onSubmitted: (result: SubmitResult) => void;
  setup?: boolean;
  onLeaveSetup?: () => void;
  /** Opened from a template's "Apply to employees". */
  templatePreset?: string | null;
  /** Opened from the toolbar's "Mass increment": the increment window opens at once. */
  incrementPreset?: boolean;
}) {
  const policy = data.gradePolicy;
  const settings = useMemo(() => ({ ssfBase: data.ssfBase, pfPercent: data.pfPercent }), [data.ssfBase, data.pfPercent]);
  const manualPolicy = policy?.calculationMethod === "MANUAL_INPUT";
  const gradesOff = policy?.calculationMethod === "DISABLED_NO_GRADES";
  const byId = useMemo(() => new Map(data.rows.map((r) => [r.employeeId, r])), [data.rows]);
  const levelStart = useCallback((code: string) => data.levels.find((l) => l.code === code || l.name === code)?.minSalary ?? 0, [data.levels]);
  const levelMax = useCallback((code: string) => data.levels.find((l) => l.code === code || l.name === code)?.maxSalary ?? 0, [data.levels]);
  const preset = data.templates.find((t) => t.id === templatePreset) ?? null;

  // Bulk add starts with everyone who needs a structure (each filled by startLines below);
  // Apply to employees with everyone the template fits.
  const [initial] = useState(() => {
    if (preset && !setup) {
      const list = data.rows.filter((r) => r.status !== "pending" && templateFits(preset, r));
      return { ids: list.map((r) => r.employeeId), effectiveFrom: nepalDateIso(), reason: `Template "${preset.name}" applied`, spread: false, left: data.rows.filter((r) => r.status === "pending" && templateFits(preset, r)).length };
    }
    if (!setup) return { ids: [] as string[], effectiveFrom: nepalDateIso(), reason: "", spread: false, left: 0 };
    const list = data.rows.filter(needsStructure);
    // One date for the batch: the latest of their start dates (set up one by one to use each joining date).
    const dates = list.map((r) => setupEffectiveFrom(r.joiningDate, r.employeeId, data.finalisedUntil)).sort();
    return { ids: list.map((r) => r.employeeId), effectiveFrom: dates[dates.length - 1] ?? nepalDateIso(), reason: "Salary structure set up", spread: dates.length > 1 && dates[0] !== dates[dates.length - 1], left: 0 };
  });
  const [ids, setIds] = useState<string[]>(initial.ids);
  const [serverErrors, setServerErrors] = useState<Record<string, Record<string, string>>>({});
  const [filters, setFilters] = useState({ branch: "", dept: "", level: "" });
  const [effectiveFrom, setEffectiveFrom] = useState(initial.effectiveFrom);
  const dateText = useDateText();
  const [reason, setReason] = useState(initial.reason);
  const [templateId, setTemplateId] = useState(preset?.id ?? "");
  // The table as it was before the last template or increment was applied (Undo).
  const [undo, setUndo] = useState<{ edited: Record<string, StructureLines>; label: string } | null>(null);
  const [incrementOpen, setIncrementOpen] = useState(incrementPreset && !setup);
  const [incremented, setIncremented] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  // Browser storage is only readable after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHidden(readHidden()), []);
  const [chooser, setChooser] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState<false | "submit" | "approve">(false);
  const [notice, setNotice] = useState<{ tone: "info" | "warning" | "danger"; text: string; list?: string[] } | null>(() =>
    preset && !setup
      ? {
          tone: "info",
          text: `Template "${preset.name}" applied to the ${initial.ids.length} employee${initial.ids.length === 1 ? "" : "s"} it fits: their allowances and deductions are replaced by the template's. Check the rows, remove anyone it should not change, then review and send.${initial.left ? ` ${initial.left} with a change waiting for approval are left out.` : ""}`,
        }
      : null
  );
  const [imported, setImported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // A row's starting lines. Bulk add: from the first template that fits and SSF where
  // expected, keeping the basic + grade from the employee form (else the level's scale).
  const startLines = useCallback(
    (r: StructureRow): StructureLines => {
      if (setup && needsStructure(r)) {
        const from = r.current?.lines ?? { ...EMPTY_LINES, basic: levelStart(r.levelCode) };
        return setupLines(from, templatesFor(data.templates, r).fitting[0] ?? null, r.ssfExpected, data.heads, policy, { levelStart: r.current ? null : levelStart(r.levelCode), employee: r });
      }
      return r.current?.lines ?? { ...EMPTY_LINES, basic: levelStart(r.levelCode), scheme: "ssf" };
    },
    [levelStart, setup, data.templates, data.heads, policy]
  );

  /** A template on one row: as Add new does for someone needing a structure, else as a revision. */
  const fillFrom = useCallback(
    (t: TemplateRow, r: StructureRow, l: StructureLines): StructureLines =>
      setup && needsStructure(r)
        ? setupLines(l, t, r.ssfExpected, data.heads, policy, { levelStart: r.current ? null : levelStart(r.levelCode), employee: r })
        : applyTemplate(t, l, data.heads, levelStart(r.levelCode), policy, r),
    [setup, data.heads, policy, levelStart]
  );

  const [edited, setEdited] = useState<Record<string, StructureLines>>(() => {
    if (!preset || setup) return {};
    const out: Record<string, StructureLines> = {};
    for (const id of initial.ids) {
      const r = byId.get(id)!;
      out[id] = fillFrom(preset, r, startLines(r));
    }
    return out;
  });

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
            // As payroll would pay it, income tax estimated (the same calculatePayslip).
            totals: estimatePay(lines, data.heads, r.profile, data.tax, settings),
            originalTotals: r.current?.totals ?? null,
            errors: { ...check.errors, ...(serverErrors[r.employeeId] ?? {}) },
            warnings: { ...check.warnings, ...(largeChangeWarning(original?.basic, lines.basic) && !check.warnings.basic ? { basic: largeChangeWarning(original?.basic, lines.basic)! } : {}) },
            // In set-up every row is sent: an unchanged one confirms basic + grade only.
            changed: setup || !original || changedLines(original, lines).length > 0,
          };
        }),
    [ids, byId, edited, data.heads, data.tax, settings, levelStart, startLines, serverErrors, setup]
  );

  /** Rows that can be loaded: active, not already in the table, with no change waiting (Bulk add: those needing a structure). */
  const loadable = (r: StructureRow) => r.status !== "pending" && !ids.includes(r.employeeId) && (!setup || needsStructure(r));
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
    setUndo(null);
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
      { id: "name", header: "Employee", kind: "readonly", pinned: true, width: 170, align: "left", value: (r) => (r.row.employeeId === data.me.employeeId ? `${r.row.fullName} (you)` : r.row.fullName) },
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
    // Pay heads set for some departments / designations only (Pay heads) can be typed
    // only for those employees; one already held outside its list stays, with a warning.
    const forRow = (h: (typeof amountHeads)[number], r: GridRow) => headAppliesTo(h, r.row);
    const outside = "This pay head is set for other departments / designations (Pay heads)";
    for (const h of amountHeads.filter((x) => !hidden.includes(x.id))) {
      cols.push({
        id: `head:${h.id}`,
        header: headTitle(h),
        group: h.type === "allowance" ? "Allowances" : "Deductions",
        kind: "number",
        width: 116,
        value: (r) => r.lines.amounts[h.id] ?? 0,
        original: (r) => r.original?.amounts[h.id] ?? 0,
        editable: (r) => forRow(h, r) || (r.lines.amounts[h.id] ?? 0) > 0,
        error: (r) => r.errors[h.id],
        warning: (r) => r.warnings[h.id] ?? (!forRow(h, r) && (r.lines.amounts[h.id] ?? 0) > 0 ? outside : undefined),
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
        editable: (r) => forRow(h, r) || r.lines.computed.includes(h.id),
        hint: h.rule,
      });
    }
    cols.push(
      { id: "totalSalary", header: "Total salary", group: "Monthly", kind: "readonly", width: 116, value: (r) => r.totals.totalSalary, format: money, hint: "Basic + grade + allowances" },
      { id: "totalDeductions", header: "Total deductions", group: "Monthly", kind: "readonly", width: 120, value: (r) => r.totals.totalDeductions, format: money, hint: "SSF 31% / PF + other deductions + income tax (estimate)" },
      { id: "netPayable", header: "Net payable (est.)", group: "Monthly", kind: "readonly", width: 128, value: (r) => r.totals.netPayable, format: money, hint: "Gross earnings (total salary + SSF employer 20%) − total deductions" },
      {
        id: "change",
        header: "Change",
        group: "Monthly",
        kind: "readonly",
        width: 104,
        value: (r) => r.totals.totalSalary - (r.originalTotals?.totalSalary ?? 0),
        format: (v) => {
          const n = Number(v);
          if (!n) return <span className="text-ink-faint">—</span>;
          return <span className={n > 0 ? "text-success" : "text-danger"}>{n > 0 ? "+" : ""}{money(n)}</span>;
        },
      }
    );
    return cols;
  }, [amountHeads, computedHeads, hidden, gradesOff, manualPolicy, data.me.employeeId]);

  const changedRows = rows.filter((r) => r.changed);
  const errorRows = rows.filter((r) => Object.keys(r.errors).length);
  const before = changedRows.reduce((n, r) => n + (r.originalTotals?.totalSalary ?? 0), 0);
  const after = changedRows.reduce((n, r) => n + r.totals.totalSalary, 0);
  // Cost to company (gross earnings + PF employer): the budget effect of the change.
  const costChange = changedRows.reduce((n, r) => n + r.totals.costToCompany - (r.originalTotals?.costToCompany ?? 0), 0);

  // ---------------------------------------------------------------------------
  // Templates, CSV
  // ---------------------------------------------------------------------------

  const applyTemplateToRows = () => {
    const t = data.templates.find((x) => x.id === templateId);
    if (!t) return;
    const scope = selectedRows.length > 1 ? selectedRows : ids;
    const targets = scope.filter((id) => templateFits(t, byId.get(id)!));
    setUndo({ edited, label: `Template "${t.name}"` });
    for (const id of targets) {
      const r = byId.get(id)!;
      setLines(id, (l) => fillFrom(t, r, l));
    }
    const skipped = scope.length - targets.length;
    setNotice({
      tone: "info",
      text: `Template "${t.name}" applied to ${targets.length} row${targets.length === 1 ? "" : "s"} it fits: their allowances and deductions are replaced by the template's.${skipped ? ` ${skipped} row${skipped === 1 ? "" : "s"} it does not fit ${skipped === 1 ? "was" : "were"} left as ${skipped === 1 ? "it was" : "they were"}.` : ""}`,
    });
  };

  const undoTemplate = () => {
    if (!undo) return;
    setEdited(undo.edited);
    setNotice({ tone: "info", text: `${undo.label} undone: the rows are back as they were before it.` });
    setUndo(null);
  };

  // ---------------------------------------------------------------------------
  // Mass increment (F14)
  // ---------------------------------------------------------------------------

  const linesOf = useCallback((r: StructureRow) => edited[r.employeeId] ?? startLines(r), [edited, startLines]);
  const contextOf = useCallback(
    (r: StructureRow): IncrementContext => ({ levelStart: levelStart(r.levelCode), levelMax: levelMax(r.levelCode), maxGrades: policy?.maxGradesAllowedPerLevel ?? 0, gradesOff }),
    [levelStart, levelMax, policy, gradesOff]
  );

  const runIncrement = ({ ids: targets, rule }: IncrementTarget) => {
    const next = { ...edited };
    const notes: string[] = [];
    let changed = 0;
    for (const id of targets) {
      const r = byId.get(id);
      if (!r) continue;
      const result = applyIncrement(next[id] ?? startLines(r), rule, contextOf(r));
      const l = result.lines;
      if (result.changed) changed++;
      if (rule.grades > 0 && l.gradeManual && !manualPolicy) notes.push(`${r.employeeCode} ${r.fullName}: grade amount is typed by hand — check it`);
      for (const n of result.notes) notes.push(`${r.employeeCode} ${r.fullName}: ${n}`);
      next[id] = { ...l, gradeAmount: l.gradeManual || manualPolicy ? l.gradeAmount : gradeAmountFor(l, policy) };
    }
    setServerErrors({});
    setUndo({ edited, label: "The mass increment" });
    setEdited(next);
    setIds((cur) => [...cur, ...targets.filter((id) => !cur.includes(id))]);
    setIncremented(true);
    setIncrementOpen(false);
    if (!reason.trim()) setReason(`Increment: ${describeRule(rule)}`.slice(0, 200));
    setNotice({
      tone: notes.length ? "warning" : "info",
      text: `Increment applied (${describeRule(rule)}): ${changed} of ${targets.length} salar${targets.length === 1 ? "y" : "ies"} change. Check the rows, then review and send.`,
      list: notes,
    });
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

  const submit = async (approveNow: boolean) => {
    setSubmitting(approveNow ? "approve" : "submit");
    const result = await submitSalaryChangeAction({
      kind: setup ? "setup" : imported ? "import" : incremented ? "increment" : "bulk",
      effectiveFrom,
      reason,
      rows: changedRows.map((r) => ({ employeeId: r.row.employeeId, lines: r.lines })),
    }, { approveNow });
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
    setIncremented(false);
    onSubmitted(result.data);
  };

  // What saving will do (same rule as the server) and whether payroll is still open for the date.
  const outcome = saveOutcome(
    data,
    changedRows.map((r) => ({ employeeId: r.row.employeeId, before: r.originalTotals?.totalSalary ?? null, after: r.totals.totalSalary, branchId: r.row.branchId, departmentId: r.row.departmentId }))
  );
  const ownInTable = !!data.me.employeeId && ids.includes(data.me.employeeId);
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
      {setup && (
        <Notice
          tone="info"
          title="Bulk add: salary structures"
          action={
            onLeaveSetup && (
              <WindowButton onClick={onLeaveSetup}>
                <Undo2 className="h-3.5 w-3.5" /> Switch to Bulk edit
              </WindowButton>
            )
          }
        >
          Everyone with no salary structure yet or only basic + grade from the employee form. Each row starts from the first template for its level /
          designation and SSF where the company has it; check the amounts, remove anyone not ready, then review and save. A basic + grade row left as it is
          confirms that nothing else applies.
          {initial.spread ? " They joined on different dates: one effective date applies to all, so set up one by one to start each from their own joining date." : ""}
        </Notice>
      )}
      {/* 1. Rows */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface-panel px-3 py-2">
        <StepLabel n={1} text="Employees" hint={ids.length ? `${ids.length} in the table` : setup ? "Pick who to add" : "Pick who to revise"} />
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

      {/* 2. Change details. Top-aligned: the date field's BS line hangs below its input,
          so bottom alignment would push the other inputs and buttons down. */}
      <div className="flex flex-wrap items-start gap-2 rounded-md border border-line bg-surface-panel px-3 py-2">
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
            <span className="flex flex-col">
              <LabelSpacer />
              <WindowButton onClick={applyTemplateToRows} disabled={!templateId || !ids.length} title="Applies to the selected rows (or all rows) the template fits">
                <Wand2 className="h-3.5 w-3.5" /> Apply {selectedRows.length > 1 ? `to ${selectedRows.length} selected` : "to all rows"}
              </WindowButton>
            </span>
          </>
        )}
        {!setup && (
          <span className="flex flex-col">
            <LabelSpacer />
            <WindowButton onClick={() => setIncrementOpen(true)} title="One rule for many salaries: basic by % or amount, grades added">
              <TrendingUp className="h-3.5 w-3.5" /> Mass increment
            </WindowButton>
          </span>
        )}
        <span className="ml-auto flex flex-wrap gap-x-2">
          <LabelSpacer />
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
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{notice.text}</span>
            {undo && (
              <button type="button" onClick={undoTemplate} className="cursor-pointer font-medium text-brand-strong underline-offset-2 hover:underline">
                Undo
              </button>
            )}
          </p>
          {notice.list && notice.list.length > 0 && (
            <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-5 text-2xs">
              {notice.list.slice(0, 50).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {ownInTable && (
        <p role="status" className="rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-xs text-ink">
          Your own salary is in this table, so the whole change waits for another approver.{" "}
          {data.me.isAdministrator ? "Remove your row to save and approve the rest now." : null}
        </p>
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
          <span className="text-ink-muted">Monthly total salary</span> <Amount value={before} /> → <Amount value={after} emphasis />
        </span>
        <span className="text-ink-muted">Difference</span>
        <span className={cn("-ml-3 font-semibold tabular-nums", after - before > 0 ? "text-success" : after - before < 0 ? "text-danger" : "text-ink")}>
          {after - before > 0 ? "+" : ""}
          <Amount value={after - before} />
        </span>
        {reviewBlocker && <span className="ml-auto max-w-xl text-right text-2xs text-warning">{reviewBlocker}</span>}
        <WindowButton variant="primary" className={reviewBlocker ? undefined : "ml-auto"} disabled={!canReview} onClick={() => setReviewing(true)} title={canReview ? undefined : "Change some rows, fix errors, and give the date and reason first"}>
          <Send className="h-3.5 w-3.5" /> Review {changedRows.length || ""} change{changedRows.length === 1 ? "" : "s"}
        </WindowButton>
      </div>

      {incrementOpen && (
        <SalaryIncrementWindow data={data} tableIds={ids} selectedIds={selectedRows} linesOf={linesOf} contextOf={contextOf} onClose={() => setIncrementOpen(false)} onApply={runIncrement} />
      )}

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
          title={setup ? `Review ${changedRows.length} salary structure${changedRows.length === 1 ? "" : "s"} to add` : `Review ${changedRows.length} salary change${changedRows.length === 1 ? "" : "s"}`}
          description={`Effective from ${dateText(effectiveFrom)} · ${reason}`}
          footer={
            <>
              <SaveOutcome data={data} outcome={outcome} className="mr-auto" />
              <WindowButton onClick={() => setReviewing(false)} disabled={!!submitting}>
                Back to the table
              </WindowButton>
              <SaveButtons outcome={outcome} saving={submitting} onSave={(now) => void submit(now)} plainLabel={setup ? "Save structures" : "Save changes"} />
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className="border-b border-line-strong text-left text-2xs uppercase tracking-wide text-ink-muted">
                  <th className="py-1.5 pr-2">Employee</th>
                  <th className="py-1.5 pr-2">What changes</th>
                  <th className="py-1.5 pr-2 text-right">Total salary now</th>
                  <th className="py-1.5 pr-2 text-right">New total salary</th>
                  <th className="py-1.5 pr-2 text-right">Change</th>
                  <th className="py-1.5 text-right">Net payable (est.)</th>
                </tr>
              </thead>
              <tbody>
                {changedRows.map((r) => {
                  const was = r.originalTotals?.totalSalary ?? 0;
                  const diff = r.totals.totalSalary - was;
                  const listed = r.original ? describeChanges(r.original, r.lines, data.heads) : ["New structure"];
                  const parts = listed.length ? listed : ["Confirmed: basic + grade only"];
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
                        <Amount value={r.totals.totalSalary} />
                      </td>
                      <td className={cn("py-1.5 pr-2 text-right font-medium", diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "")}>
                        {diff > 0 ? "+" : ""}
                        <Amount value={diff} />
                        {was > 0 && <span className="ml-1 text-3xs">({((diff / was) * 100).toFixed(1)}%)</span>}
                      </td>
                      <td className="py-1.5 text-right">
                        <Amount value={r.totals.netPayable} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2" colSpan={2}>
                    Total monthly salary
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <Amount value={before} />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <Amount value={after} />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {after - before > 0 ? "+" : ""}
                    <Amount value={after - before} />
                  </td>
                  <td className="py-2 text-right">
                    <Amount value={changedRows.reduce((n, r) => n + r.totals.netPayable, 0)} />
                  </td>
                </tr>
                <tr className="text-ink-muted">
                  <td className="pb-2" colSpan={4}>
                    Change in cost to company per month (gross earnings + PF employer)
                  </td>
                  <td className="pb-2 pr-2 text-right font-medium">
                    {costChange > 0 ? "+" : ""}
                    <Amount value={costChange} />
                  </td>
                  <td />
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

/** Column title for a pay head; label heads ("Grade Amount") are told apart from the base-pay columns. */
const headTitle = (h: SalaryStructureData["heads"][number]) => (h.labelOnly ? `${h.name} (pay head)` : h.name);

/** An empty label line, so buttons in a top-aligned strip sit level with the inputs. */
function LabelSpacer() {
  return <span aria-hidden className="block w-full text-2xs font-medium">&nbsp;</span>;
}
