"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Columns3,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  Lock,
  MinusCircle,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  TableProperties,
  Trash2,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { EditGrid, type EditGridColumn, type GridValueChange } from "@/components/kit/edit-grid";
import { WindowButton } from "@/components/kit/window";
import { StatusChip } from "@/components/kit/status-chip";
import { usePopupPosition } from "@/components/kit/use-popup-position";
import { usePersistedPrefs } from "@/components/kit/data-grid";
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
  matchImport,
  templateFits,
  type ImportColumn,
} from "@/lib/engines/salary-structure.engine";
import { applyIncrement, describeRule, type IncrementContext } from "@/lib/engines/increment.engine";
import { adToBS, bsToAD, BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { nepalToday, toIsoDate } from "@/lib/utils/nepal-time";
import type {
  RetirementScheme,
  SalaryStructureData,
  StructureLines,
  StructureRow,
  StructureTotals,
} from "@/lib/types/salary-structure";
import { cn } from "@/lib/utils";
import { saveOutcome } from "./salary-structure-approval";
import { SalaryIncrementWindow, type IncrementTarget } from "./salary-increment-window";

interface SheetGridRow {
  row: StructureRow;
  lines: StructureLines;
  original: StructureLines | null;
  totals: StructureTotals;
  originalTotals: StructureTotals | null;
  dashainAmount: number;
  totalSalary: number;
  grossEarnings: number;
  retirementDeduction: number;
  totalDeductions: number;
  netPayable: number;
  costToCompany: number;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  changed: boolean;
}

const MONTH_NAMES_UPPER = BS_MONTHS_EN.slice(1).map((m) => m.toUpperCase());

const SCHEME_OPTIONS = [
  { value: "ssf", label: "SSF" },
  { value: "pf", label: "PF" },
  { value: "none", label: "None" },
];

const DEFAULT_HIDDEN_COLS = ["accountNo", "designation", "ssfEmployer", "costToCompany"];

const money = (v: unknown): string => {
  const n = Number(v);
  if (isNaN(n) || n === 0) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface ColumnDef {
  id: string;
  header: string;
  hideable?: boolean;
}

export function SalaryStructureSheet({
  data,
  onSubmitted,
  onAddNew,
  onOpenApprovals,
  onOpenRevise,
  initialTemplateId = null,
}: {
  data: SalaryStructureData;
  onSubmitted: (result: SubmitResult) => void;
  onAddNew?: () => void;
  onOpenApprovals?: () => void;
  onOpenRevise?: (row: StructureRow) => void;
  initialTemplateId?: string | null;
}) {
  const policy = data.gradePolicy;
  const manualPolicy = policy?.calculationMethod === "MANUAL_INPUT";
  const gradesOff = policy?.calculationMethod === "DISABLED_NO_GRADES";

  const settings = useMemo(
    () => ({ ssfBase: data.ssfBase, pfPercent: data.pfPercent }),
    [data.ssfBase, data.pfPercent]
  );
  const byId = useMemo(() => new Map(data.rows.map((r) => [r.employeeId, r])), [data.rows]);
  const levelStart = useCallback(
    (code: string) => data.levels.find((l) => l.code === code || l.name === code)?.minSalary ?? 0,
    [data.levels]
  );
  const levelMax = useCallback(
    (code: string) => data.levels.find((l) => l.code === code || l.name === code)?.maxSalary ?? 0,
    [data.levels]
  );

  // Default BS Year and BS Month based on Kathmandu today
  const todayBS = useMemo(() => adToBS(nepalToday()), []);
  const [bsYear, setBsYear] = useState<number>(todayBS.year || 2083);
  const [bsMonth, setBsMonth] = useState<number>(todayBS.month || 6); // 1 = Baisakh ... 6 = Aswin
  const [showDataOnly, setShowDataOnly] = useState<boolean>(false);

  // Filters & search
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Columns visibility dropdown (consistent with DataGrid across all modules)
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const columnsButtonRef = useRef<HTMLButtonElement>(null);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  // Batch details
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState<false | "submit" | "approve">(false);
  const [templateId, setTemplateId] = useState<string>(initialTemplateId ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  // Mass increment (F14): the window, whether the edits came from one (the batch kind), and the
  // sheet as it was before it was applied (Undo).
  const [incrementOpen, setIncrementOpen] = useState(false);
  const [incremented, setIncremented] = useState(false);
  const [undo, setUndo] = useState<{ edited: Record<string, StructureLines>; label: string } | null>(null);

  // Derived effectiveFrom ISO string calculated from BS Year and BS Month (1st day of BS month)
  const effectiveFrom = useMemo(() => {
    const adDate = bsToAD(bsYear, bsMonth, 1);
    return isNaN(adDate.getTime()) ? toIsoDate(nepalToday()) : toIsoDate(adDate);
  }, [bsYear, bsMonth]);


  // Identify pay heads
  const allowanceHead = useMemo(
    () => data.heads.find((h) => h.kind === "amount" && h.type === "allowance" && !h.occasional),
    [data.heads]
  );
  const deductionHead = useMemo(
    () => data.heads.find((h) => h.kind === "amount" && h.type === "deduction" && h.scheme !== "ssf" && h.scheme !== "pf"),
    [data.heads]
  );
  const festivalHead = useMemo(
    () =>
      data.heads.find(
        (h) =>
          h.payroll.isFestivalAllowance ||
          h.code.toUpperCase() === "FEST" ||
          h.name.toLowerCase().includes("festival") ||
          h.name.toLowerCase().includes("dashain")
      ),
    [data.heads]
  );

  const startLines = useCallback(
    (r: StructureRow): StructureLines => {
      return (
        r.current?.lines ?? {
          ...EMPTY_LINES,
          basic: levelStart(r.levelCode),
          scheme: r.ssfExpected ? "ssf" : "none",
        }
      );
    },
    [levelStart]
  );

  const [edited, setEdited] = useState<Record<string, StructureLines>>(() => {
    if (!initialTemplateId) return {};
    const t = data.templates.find((tpl) => tpl.id === initialTemplateId);
    if (!t) return {};
    const next: Record<string, StructureLines> = {};
    for (const r of data.rows) {
      if (templateFits(t, r)) {
        next[r.employeeId] = applyTemplate(t, startLines(r), data.heads, levelStart(r.levelCode), policy, r);
      }
    }
    return next;
  });

  const [notice, setNotice] = useState<{ tone: "info" | "warning" | "danger"; text: string; list?: string[] } | null>(() => {
    if (!initialTemplateId) return null;
    const t = data.templates.find((tpl) => tpl.id === initialTemplateId);
    if (!t) return null;
    return {
      tone: "info",
      text: `Template "${t.name}" applied to matching employees. Review and Save.`,
    };
  });

  const setRowLines = useCallback(
    (employeeId: string, fn: (l: StructureLines) => StructureLines) => {
      setEdited((cur) => {
        const r = byId.get(employeeId);
        if (!r) return cur;
        const base = cur[employeeId] ?? startLines(r);
        const next = fn(base);
        return {
          ...cur,
          [employeeId]: {
            ...next,
            gradeAmount: next.gradeManual || manualPolicy ? next.gradeAmount : gradeAmountFor(next, policy),
          },
        };
      });
    },
    [byId, startLines, policy, manualPolicy]
  );

  // Build grid rows with full mathematical synchronization including festival allowance
  const allGridRows: SheetGridRow[] = useMemo(() => {
    return data.rows.map((r) => {
      const original = r.current?.lines ?? null;
      const lines = edited[r.employeeId] ?? startLines(r);
      const totals = estimatePay(lines, data.heads, r.profile, data.tax, settings);
      const isChanged = !original || changedLines(original, lines).length > 0;

      // Extract Dashain / Festival allowance
      let dashainAmount = 0;
      if (festivalHead) {
        if (lines.amounts[festivalHead.id] !== undefined) {
          dashainAmount = Number(lines.amounts[festivalHead.id]) || 0;
        } else if (lines.computed.includes(festivalHead.id)) {
          dashainAmount = lines.basic + lines.gradeAmount;
        }
      } else if (lines.amounts.festival !== undefined) {
        dashainAmount = Number(lines.amounts.festival) || 0;
      }

      // Calculations matching exact payslip definitions:
      const totalSalary = lines.basic + lines.gradeAmount + totals.allowances + dashainAmount;
      const grossEarnings = totalSalary + totals.employerInEarnings;
      const retirementDeduction = totals.retirementDeduction;
      const incomeTax = totals.incomeTax ?? 0;
      const totalDeductions = retirementDeduction + totals.otherDeductions + incomeTax;
      const netPayable = grossEarnings - totalDeductions;
      const costToCompany = lines.scheme === "pf" ? grossEarnings + totals.retirementEmployer : grossEarnings;

      return {
        row: r,
        lines,
        original,
        totals,
        originalTotals: r.current?.totals ?? null,
        dashainAmount,
        totalSalary,
        grossEarnings,
        retirementDeduction,
        totalDeductions,
        netPayable,
        costToCompany,
        errors: {},
        warnings: {},
        changed: isChanged,
      };
    });
  }, [data.rows, edited, startLines, data.heads, data.tax, settings, festivalHead]);

  // Filter rows by search, branch, and department
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allGridRows.filter((item) => {
      const r = item.row;
      if (branchFilter && r.branchId !== branchFilter) return false;
      if (deptFilter && r.departmentId !== deptFilter) return false;
      if (q && !r.fullName.toLowerCase().includes(q) && !r.employeeCode.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allGridRows, branchFilter, deptFilter, search]);

  // Handle cell changes in EditGrid
  const handleGridChange = (changes: GridValueChange[]) => {
    for (const ch of changes) {
      const empId = ch.rowId;
      const col = ch.colId;
      const numVal = Math.max(0, Number(ch.value) || 0);

      setRowLines(empId, (l) => {
        if (col === "basic") {
          return { ...l, basic: numVal };
        }
        if (col === "gradeCount") {
          const nextCount = Math.trunc(numVal);
          const next = { ...l, gradeCount: nextCount };
          return {
            ...next,
            gradeAmount: next.gradeManual || manualPolicy ? next.gradeAmount : gradeAmountFor(next, policy),
          };
        }
        if (col === "gradeManual") {
          const isManual = Boolean(ch.value);
          const next = { ...l, gradeManual: isManual };
          return {
            ...next,
            gradeAmount: isManual || manualPolicy ? next.gradeAmount : gradeAmountFor(next, policy),
          };
        }
        if (col === "gradeAmount") {
          return { ...l, gradeManual: true, gradeAmount: numVal };
        }
        if (col === "scheme") {
          return { ...l, scheme: (ch.value as RetirementScheme) || "none" };
        }
        if (col === "allowances") {
          const nextAmounts = { ...l.amounts };
          const allowanceHeads = data.heads.filter(
            (h) => h.kind === "amount" && h.type === "allowance" && !h.occasional && h.id !== festivalHead?.id
          );
          for (const ah of allowanceHeads) {
            delete nextAmounts[ah.id];
          }
          const primaryId = allowanceHead?.id ?? allowanceHeads[0]?.id ?? "allowance";
          nextAmounts[primaryId] = numVal;
          return { ...l, amounts: nextAmounts };
        }
        if (col === "otherDeductions") {
          const nextAmounts = { ...l.amounts };
          const deductionHeads = data.heads.filter(
            (h) => h.kind === "amount" && h.type === "deduction" && h.scheme !== "ssf" && h.scheme !== "pf"
          );
          for (const dh of deductionHeads) {
            delete nextAmounts[dh.id];
          }
          const primaryId = deductionHead?.id ?? deductionHeads[0]?.id ?? "deduction";
          nextAmounts[primaryId] = numVal;
          return { ...l, amounts: nextAmounts };
        }
        if (col === "dashain") {
          if (festivalHead) {
            const comp =
              numVal > 0
                ? [...new Set([...l.computed, festivalHead.id])]
                : l.computed.filter((id) => id !== festivalHead.id);
            return {
              ...l,
              amounts: { ...l.amounts, [festivalHead.id]: numVal },
              computed: comp,
            };
          }
          return { ...l, amounts: { ...l.amounts, festival: numVal } };
        }
        return l;
      });
    }
  };

  // Master catalog of all available columns
  const allAvailableColumns = useMemo<ColumnDef[]>(() => {
    return [
      { id: "code", header: "Code", hideable: false },
      { id: "name", header: "Employee", hideable: true },
      { id: "accountNo", header: "A/C No", hideable: true },
      { id: "department", header: "Department", hideable: true },
      { id: "designation", header: "Designation", hideable: true },
      { id: "level", header: "Level", hideable: true },
      { id: "basic", header: "Basic", hideable: true },
      ...(!gradesOff
        ? [
            { id: "gradeCount", header: "Grades", hideable: true },
            { id: "gradeManual", header: "By hand", hideable: true },
            { id: "gradeAmount", header: "Grade", hideable: true },
          ]
        : []),
      { id: "allowances", header: "Allowances", hideable: true },
      { id: "dashain", header: "Festival", hideable: true },
      { id: "totalSalary", header: "Total salary", hideable: true },
      { id: "ssfEmployer", header: "SSF employer 20%", hideable: true },
      { id: "grossEarnings", header: "Gross earnings", hideable: true },
      { id: "retirement", header: "SSF / PF deduction", hideable: true },
      { id: "otherDeductions", header: "Other deductions", hideable: true },
      { id: "incomeTax", header: "Income tax (est.)", hideable: true },
      { id: "totalDeductions", header: "Total deductions", hideable: true },
      { id: "netPayable", header: "Net payable (est.)", hideable: true },
      { id: "costToCompany", header: "Cost to company", hideable: true },
      { id: "scheme", header: "Scheme", hideable: true },
      { id: "effective", header: "Effective from", hideable: true },
      { id: "status", header: "Status", hideable: true },
      { id: "actions", header: "Action", hideable: true },
    ];
  }, [gradesOff]);

  const allColumnIds = useMemo(() => allAvailableColumns.map((c) => c.id), [allAvailableColumns]);
  const [prefs, savePrefs, hasSavedPrefs] = usePersistedPrefs("salary-sheet", allColumnIds);
  const hiddenIds = useMemo(
    () => new Set(hasSavedPrefs ? prefs.hidden : DEFAULT_HIDDEN_COLS),
    [hasSavedPrefs, prefs.hidden]
  );

  const toggleColumn = useCallback(
    (columnId: string) => {
      const next = new Set(hiddenIds);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      savePrefs({ ...prefs, hidden: [...next] });
    },
    [hiddenIds, prefs, savePrefs]
  );

  const resetColumns = useCallback(() => {
    savePrefs(null);
  }, [savePrefs]);

  const columnsMenuStyle = usePopupPosition(columnsButtonRef, columnsMenuOpen, {
    width: 240,
    maxWidth: 240,
    height: Math.min(420, allAvailableColumns.length * 32 + 84),
  });

  // Built columns for EditGrid based on hiddenIds
  const columns = useMemo<EditGridColumn<SheetGridRow>[]>(() => {
    const isEditable = !showDataOnly && data.permissions.edit;
    const isVisible = (id: string) => !hiddenIds.has(id);

    const cols: EditGridColumn<SheetGridRow>[] = [
      {
        id: "select",
        header: "✓",
        kind: "check",
        pinned: true,
        width: 44,
        align: "center",
        value: (r) => selectedIds.includes(r.row.employeeId),
        editable: () => true,
      },
      {
        id: "code",
        header: "Code",
        kind: "readonly",
        pinned: true,
        width: 80,
        align: "left",
        value: (r) => r.row.employeeCode,
      },
      {
        id: "name",
        header: "Employee",
        kind: "readonly",
        pinned: true,
        width: 170,
        align: "left",
        value: (r) => (r.row.employeeId === data.me.employeeId ? `${r.row.fullName} (You)` : r.row.fullName),
      },
    ];

    if (isVisible("accountNo")) {
      cols.push({
        id: "accountNo",
        header: "A/C No",
        kind: "readonly",
        width: 110,
        align: "left",
        value: (r) => r.row.bankAccountNumber || "—",
      });
    }

    if (isVisible("department")) {
      cols.push({
        id: "department",
        header: "Department",
        kind: "readonly",
        width: 130,
        align: "left",
        value: (r) => r.row.departmentName,
      });
    }

    if (isVisible("designation")) {
      cols.push({
        id: "designation",
        header: "Designation",
        kind: "readonly",
        width: 130,
        align: "left",
        value: (r) => r.row.designationName,
      });
    }

    if (isVisible("level")) {
      cols.push({
        id: "level",
        header: "Level",
        kind: "readonly",
        width: 80,
        align: "left",
        value: (r) => r.row.levelCode,
      });
    }

    // Basic
    cols.push({
      id: "basic",
      header: "Basic",
      kind: isEditable ? "number" : "readonly",
      width: 116,
      align: "right",
      value: (r) => r.lines.basic,
      original: (r) => r.original?.basic ?? 0,
      format: money,
      editable: () => isEditable,
    });

    // Grade controls: Grades, By hand, Grade
    if (!gradesOff) {
      if (isVisible("gradeCount")) {
        cols.push({
          id: "gradeCount",
          header: "Grades",
          kind: isEditable ? "number" : "readonly",
          width: 72,
          align: "right",
          value: (r) => r.lines.gradeCount,
          original: (r) => r.original?.gradeCount ?? 0,
          editable: () => isEditable,
          hint: "Number of grade increments",
        });
      }

      if (!manualPolicy && isVisible("gradeManual")) {
        cols.push({
          id: "gradeManual",
          header: "By hand",
          kind: isEditable ? "check" : "readonly",
          width: 74,
          align: "center",
          value: (r) => r.lines.gradeManual,
          original: (r) => r.original?.gradeManual ?? false,
          editable: () => isEditable,
          hint: "Check to type grade amount manually instead of using grade policy formula",
        });
      }

      cols.push({
        id: "gradeAmount",
        header: "Grade",
        kind: isEditable ? "number" : "readonly",
        width: 96,
        align: "right",
        value: (r) => r.lines.gradeAmount,
        original: (r) => r.original?.gradeAmount ?? 0,
        format: money,
        editable: (r) => isEditable && (manualPolicy || r.lines.gradeManual),
        hint: "Grade amount (editable when 'By hand' is checked or policy is manual)",
      });
    }

    // Allowances
    cols.push({
      id: "allowances",
      header: "Allowances",
      kind: isEditable ? "number" : "readonly",
      width: 110,
      align: "right",
      value: (r) => r.totals.allowances,
      original: (r) => r.originalTotals?.allowances ?? 0,
      format: money,
      editable: () => isEditable,
      hint: "Monthly allowances sum",
    });

    // Festival Allowance
    if (isVisible("dashain")) {
      cols.push({
        id: "dashain",
        header: "Festival",
        kind: isEditable ? "number" : "readonly",
        width: 110,
        align: "right",
        value: (r) => r.dashainAmount,
        format: money,
        editable: () => isEditable,
        hint: "Festival / Dashain allowance (adds to earnings and recalculates net pay)",
      });
    }

    // Total salary
    if (isVisible("totalSalary")) {
      cols.push({
        id: "totalSalary",
        header: "Total salary",
        kind: "readonly",
        width: 116,
        align: "right",
        value: (r) => r.totalSalary,
        format: money,
        hint: "Basic + Grade + Allowances + Festival allowance",
      });
    }

    // SSF employer 20%
    if (isVisible("ssfEmployer")) {
      cols.push({
        id: "ssfEmployer",
        header: "SSF employer 20%",
        kind: "readonly",
        width: 130,
        align: "right",
        value: (r) => r.totals.employerInEarnings,
        format: money,
        hint: "SSF Employer 20% contribution shown in earnings",
      });
    }

    // Gross earnings
    if (isVisible("grossEarnings")) {
      cols.push({
        id: "grossEarnings",
        header: "Gross earnings",
        kind: "readonly",
        width: 124,
        align: "right",
        value: (r) => r.grossEarnings,
        format: money,
        hint: "Total salary + SSF employer 20%",
      });
    }

    // SSF / PF deduction
    cols.push({
      id: "retirement",
      header: "SSF / PF deduction",
      kind: "readonly",
      width: 136,
      align: "right",
      value: (r) => r.retirementDeduction,
      format: money,
      hint: "SSF 31% (11% employee + 20% employer) or PF employee 10% deduction",
    });

    // Other deductions
    cols.push({
      id: "otherDeductions",
      header: "Other deductions",
      kind: isEditable ? "number" : "readonly",
      width: 120,
      align: "right",
      value: (r) => r.totals.otherDeductions,
      original: (r) => r.originalTotals?.otherDeductions ?? 0,
      format: money,
      editable: () => isEditable,
      hint: "Other fixed deductions and CIT",
    });

    // Income tax (est.)
    if (isVisible("incomeTax")) {
      cols.push({
        id: "incomeTax",
        header: "Income tax (est.)",
        kind: "readonly",
        width: 120,
        align: "right",
        value: (r) => r.totals.incomeTax ?? 0,
        format: money,
        hint: "Monthly income tax TDS estimated by payroll engine slabs",
      });
    }

    // Total deductions
    if (isVisible("totalDeductions")) {
      cols.push({
        id: "totalDeductions",
        header: "Total deductions",
        kind: "readonly",
        width: 124,
        align: "right",
        value: (r) => r.totalDeductions,
        format: money,
        hint: "Retirement deduction + Other deductions + Income tax",
      });
    }

    // Net payable (est.)
    cols.push({
      id: "netPayable",
      header: "Net payable (est.)",
      kind: "readonly",
      width: 130,
      align: "right",
      value: (r) => r.netPayable,
      format: (v) => <span className="font-semibold text-ink">{money(v)}</span>,
      hint: "Gross earnings minus total deductions",
    });

    // Cost to company
    if (isVisible("costToCompany")) {
      cols.push({
        id: "costToCompany",
        header: "Cost to company",
        kind: "readonly",
        width: 126,
        align: "right",
        value: (r) => r.costToCompany,
        format: money,
        hint: "Gross earnings + PF employer share",
      });
    }

    // Scheme
    if (isVisible("scheme")) {
      cols.push({
        id: "scheme",
        header: "Scheme",
        kind: isEditable ? "choice" : "readonly",
        width: 84,
        align: "center",
        options: SCHEME_OPTIONS,
        value: (r) => r.lines.scheme,
        original: (r) => r.original?.scheme ?? "none",
        format: (v) => (v ? String(v).toUpperCase() : "—"),
        editable: () => isEditable,
        hint: "Retirement scheme: SSF, PF, or None",
      });
    }

    // Effective from
    if (isVisible("effective")) {
      cols.push({
        id: "effective",
        header: "Effective from",
        kind: "readonly",
        width: 110,
        align: "center",
        value: (r) => r.row.current?.effectiveFrom ?? effectiveFrom,
        hint: "Effective from date for this revision",
      });
    }

    // Status
    if (isVisible("status")) {
      cols.push({
        id: "status",
        header: "Status",
        kind: "readonly",
        width: 104,
        align: "center",
        value: (r) =>
          r.changed
            ? "Modified"
            : r.row.status === "pending"
              ? "Waiting"
              : r.row.status === "setup"
                ? "Basic only"
                : "Current",
        format: (_, r) => {
          if (r.changed) return <StatusChip status="review" label="Modified" />;
          if (r.row.status === "pending") return <StatusChip status="pending" label="Waiting" />;
          if (r.row.status === "setup") return <StatusChip status="onHold" label="Basic only" />;
          if (r.row.status === "none") return <StatusChip status="draft" label="No structure" />;
          return <StatusChip status="active" label="Current" />;
        },
      });
    }

    // Actions
    if (isVisible("actions")) {
      cols.push({
        id: "actions",
        header: "Action",
        kind: "readonly",
        width: 76,
        align: "center",
        value: () => "",
        format: (_, r) => (
          <div className="flex items-center justify-center gap-1">
            {onOpenRevise && (
              <button
                type="button"
                onClick={() => onOpenRevise(r.row)}
                className="cursor-pointer rounded p-1 text-ink-muted hover:bg-surface-panel hover:text-brand"
                title="Revise detailed breakdown modal"
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
            )}
            {r.row.current?.id && (
              <button
                type="button"
                onClick={() =>
                  window.open(`/workforce/salary-mapping/letter/${r.row.current!.id}`, "_blank", "noopener")
                }
                className="cursor-pointer rounded p-1 text-ink-muted hover:bg-surface-panel hover:text-ink"
                title="Print salary revision letter"
              >
                <Printer className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ),
      });
    }

    return cols;
  }, [
    showDataOnly,
    data.permissions.edit,
    selectedIds,
    data.me.employeeId,
    hiddenIds,
    gradesOff,
    manualPolicy,
    effectiveFrom,
    onOpenRevise,
  ]);

  // Handle select checkbox
  const handleSelectCheckboxChange = (changes: GridValueChange[]) => {
    for (const ch of changes) {
      if (ch.colId === "select") {
        const id = ch.rowId;
        const val = !!ch.value;
        setSelectedIds((cur) => (val ? [...new Set([...cur, id])] : cur.filter((x) => x !== id)));
      }
    }
  };

  const handleCombinedGridChange = (changes: GridValueChange[]) => {
    const selectChanges = changes.filter((c) => c.colId === "select");
    const dataChanges = changes.filter((c) => c.colId !== "select");
    if (selectChanges.length) handleSelectCheckboxChange(selectChanges);
    if (dataChanges.length) handleGridChange(dataChanges);
  };

  // Totals calculations across visible rows
  const totalsSummary = useMemo(() => {
    let basic = 0;
    let grade = 0;
    let allowance = 0;
    let festival = 0;
    let totalSalary = 0;
    let retirement = 0;
    let otherDeductions = 0;
    let incomeTax = 0;
    let totalDeductions = 0;
    let netPayable = 0;

    for (const r of filteredRows) {
      basic += r.lines.basic;
      grade += r.lines.gradeAmount;
      allowance += r.totals.allowances;
      festival += r.dashainAmount;
      totalSalary += r.totalSalary;
      retirement += r.retirementDeduction;
      otherDeductions += r.totals.otherDeductions;
      incomeTax += r.totals.incomeTax ?? 0;
      totalDeductions += r.totalDeductions;
      netPayable += r.netPayable;
    }

    return {
      basic,
      grade,
      allowance,
      festival,
      totalSalary,
      retirement,
      otherDeductions,
      incomeTax,
      totalDeductions,
      netPayable,
    };
  }, [filteredRows]);

  const changedRows = allGridRows.filter((r) => r.changed);
  // What saving will do (the same rule as the server, custom approval rules included, 4.12d).
  const outcome = saveOutcome(
    data,
    changedRows.map((r) => ({ employeeId: r.row.employeeId, before: r.originalTotals?.totalSalary ?? null, after: r.totals.totalSalary, branchId: r.row.branchId, departmentId: r.row.departmentId }))
  );
  // Back-dated changes are allowed (the team's F7 pays the difference as arrears in the next run).
  const payrollLocked: string | null = null;

  // Save handler (submit for approval or save as final)
  const handleSave = async (approveNow: boolean) => {
    if (!changedRows.length) {
      setNotice({ tone: "warning", text: "No rows have been modified to save." });
      return;
    }
    if (payrollLocked) {
      setNotice({ tone: "danger", text: payrollLocked });
      return;
    }

    setSubmitting(approveNow ? "approve" : "submit");
    const monthName = MONTH_NAMES_UPPER[bsMonth - 1] ?? "MONTH";
    const batchReason = reason.trim() || `${monthName} ${bsYear} Salary Distribution`;

    const result = await submitSalaryChangeAction(
      {
        kind: incremented ? "increment" : "bulk",
        effectiveFrom,
        reason: batchReason,
        rows: changedRows.map((r) => ({ employeeId: r.row.employeeId, lines: r.lines })),
      },
      { approveNow }
    );

    setSubmitting(false);
    if (!result.success) {
      setNotice({ tone: "danger", text: result.error });
      return;
    }

    setEdited({});
    setReason("");
    setIncremented(false);
    setUndo(null);
    onSubmitted(result.data);
  };

  // Discard / Cancel edits
  const handleCancelEdits = () => {
    setEdited({});
    setIncremented(false);
    setUndo(null);
    setNotice({ tone: "info", text: "All unsaved changes in the sheet have been discarded." });
  };

  // ---------------------------------------------------------------------------
  // Mass increment (F14): one rule (basic by % or amount, or raised to the level's starting salary;
  // grades added within the policy's cap) applied to the sheet, then saved as one "increment"
  // batch through the salary approval flow (the server checks every row again).
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
    setUndo({ edited, label: "The mass increment" });
    setEdited(next);
    setIncremented(true);
    setIncrementOpen(false);
    if (!reason.trim()) setReason(`Increment: ${describeRule(rule)}`.slice(0, 200));
    setNotice({
      tone: notes.length ? "warning" : "info",
      text: `Increment applied (${describeRule(rule)}): ${changed} of ${targets.length} salar${targets.length === 1 ? "y" : "ies"} change. Check the rows, then Save to send them for approval.`,
      list: notes,
    });
  };

  const undoLast = () => {
    if (!undo) return;
    setEdited(undo.edited);
    setIncremented(false);
    setNotice({ tone: "info", text: `${undo.label} undone: the rows are back as they were before it.` });
    setUndo(null);
  };

  // Apply template to selected rows (or all rows)
  const handleApplyTemplate = () => {
    const t = data.templates.find((tpl) => tpl.id === templateId);
    if (!t) return;
    const targets = selectedIds.length > 0 ? selectedIds : data.rows.map((r) => r.employeeId);
    const next: Record<string, StructureLines> = { ...edited };
    let count = 0;
    for (const id of targets) {
      const r = byId.get(id);
      if (r && templateFits(t, r)) {
        next[id] = applyTemplate(t, edited[id] ?? startLines(r), data.heads, levelStart(r.levelCode), policy, r);
        count++;
      }
    }
    setEdited(next);
    setNotice({
      tone: "info",
      text: `Template "${t.name}" applied to ${count} employee${count === 1 ? "" : "s"}.`,
    });
  };

  // Export CSV
  const handleDownloadCsv = async () => {
    const auth = await authorizeExportAction({
      module: "SALARY_MAPPING",
      label: "Salary sheet export",
      rowCount: filteredRows.length,
    });
    if (!auth.allowed) {
      setNotice({ tone: "danger", text: auth.error ?? "Export not allowed." });
      return;
    }
    const visibleCols = columns.filter((c) => c.id !== "select");
    const headers = visibleCols.map((c) => c.header);
    const csv = rowsToCsv(
      headers,
      filteredRows.map((r) =>
        visibleCols.map((c) => {
          const val = c.value(r);
          return val === null || val === undefined ? "" : String(val);
        })
      )
    );
    const monthStr = MONTH_NAMES_UPPER[bsMonth - 1] ?? "MONTH";
    downloadTextFile(`salary-sheet-${bsYear}-${safeFilename(monthStr)}.csv`, csv);
  };

  // Copy visible columns and selected rows as TSV (ready for Excel)
  const handleCopyRows = async () => {
    const targetRows = selectedIds.length > 0 ? filteredRows.filter((r) => selectedIds.includes(r.row.employeeId)) : filteredRows;
    if (!targetRows.length) return;
    const visibleCols = columns.filter((c) => c.id !== "select");
    const tsv = [
      visibleCols.map((c) => c.header).join("\t"),
      ...targetRows.map((r) =>
        visibleCols
          .map((c) => {
            const val = c.value(r);
            return val === null || val === undefined ? "" : String(val);
          })
          .join("\t")
      ),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      setNotice({ tone: "info", text: `Copied ${targetRows.length} row${targetRows.length === 1 ? "" : "s"} — paste into Excel.` });
    } catch {
      setNotice({ tone: "warning", text: "Copy is blocked by the browser." });
    }
  };

  // Import CSV
  const handleImportCsv = async (file: File) => {
    if (file.size > 2_000_000) {
      setNotice({ tone: "danger", text: "File must be under 2 MB." });
      return;
    }
    const text = await file.text();
    const table = parseCsv(text);
    const csvCols: ImportColumn[] = [
      { id: "basic", header: "Basic", kind: "number" },
      { id: "gradeAmount", header: "Grade", kind: "number" },
      { id: "gradeCount", header: "Grades", kind: "number" },
    ];
    const byCode = new Map(data.rows.map((r) => [r.employeeCode, r]));
    const result = matchImport(table, csvCols, new Set(byCode.keys()));
    const next: Record<string, StructureLines> = { ...edited };
    let importedCount = 0;
    for (const [code, vals] of result.values) {
      const r = byCode.get(code);
      if (r) {
        const base = next[r.employeeId] ?? startLines(r);
        next[r.employeeId] = {
          ...base,
          basic: vals.basic !== undefined ? Number(vals.basic) : base.basic,
          gradeCount: vals.gradeCount !== undefined ? Math.trunc(Number(vals.gradeCount)) : base.gradeCount,
          gradeAmount: vals.gradeAmount !== undefined ? Number(vals.gradeAmount) : base.gradeAmount,
          gradeManual: vals.gradeAmount !== undefined ? true : base.gradeManual,
        };
        importedCount++;
      }
    }
    setEdited(next);
    setNotice({
      tone: "info",
      text: `Imported figures for ${importedCount} employees from CSV.`,
    });
  };

  // Selected row for Print revision letter
  const selectedFirstRow = selectedIds.length ? byId.get(selectedIds[0]) : null;
  const printLetterId = selectedFirstRow?.current?.id;

  // Outside click to close columns menu
  useEffect(() => {
    if (!columnsMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        columnsMenuRef.current &&
        !columnsMenuRef.current.contains(e.target as Node) &&
        columnsButtonRef.current &&
        !columnsButtonRef.current.contains(e.target as Node)
      ) {
        setColumnsMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setColumnsMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [columnsMenuOpen]);

  return (
    <div className="space-y-2.5 rounded-lg border border-line bg-surface p-3 font-sans shadow-sm">
      {/* 1. Header: Employee Salary Sheet */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-brand/20 bg-brand-subtle text-brand">
            <TableProperties className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink">
              Employee Salary Sheet
            </h2>
            <p className="text-2xs text-ink-muted">
              Period: <strong className="font-medium text-ink">{MONTH_NAMES_UPPER[bsMonth - 1]} {bsYear} BS</strong> &middot; Effective {effectiveFrom} &middot; {filteredRows.length} employees {changedRows.length > 0 && <span className="font-semibold text-warning">({changedRows.length} modified)</span>}
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5">
          {data.permissions.add && (
            <WindowButton variant="default" onClick={onAddNew} title="Add employee salary structure">
              <Plus className="h-3.5 w-3.5 text-brand" /> New
            </WindowButton>
          )}

          <WindowButton
            variant="default"
            onClick={handleCancelEdits}
            disabled={!changedRows.length}
            title="Discard unsaved changes in sheet"
          >
            <MinusCircle className="h-3.5 w-3.5 text-danger" /> Cancel
          </WindowButton>

          {data.permissions.edit && (
            <WindowButton
              variant="primary"
              onClick={() => handleSave(false)}
              disabled={!changedRows.length || !!submitting || !!payrollLocked}
              title="Save and submit batch for approval"
            >
              {submitting === "submit" ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </WindowButton>
          )}

          {data.permissions.edit && outcome.canSaveAndApprove && (
            <WindowButton
              variant="default"
              onClick={() => handleSave(true)}
              disabled={!changedRows.length || !!submitting || !!payrollLocked}
              title="Save and final approve immediately"
            >
              {submitting === "approve" ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 text-brand" />
              )}
              Save As Final
            </WindowButton>
          )}

          {data.permissions.delete && (
            <WindowButton
              variant="default"
              onClick={() => {
                if (selectedIds.length) {
                  const next = { ...edited };
                  for (const id of selectedIds) delete next[id];
                  setEdited(next);
                  setNotice({ tone: "info", text: `Reset edits for ${selectedIds.length} employees.` });
                }
              }}
              disabled={!selectedIds.length}
              title="Reset selected rows"
            >
              <Trash2 className="h-3.5 w-3.5 text-danger" /> Delete
            </WindowButton>
          )}

          {data.permissions.edit && (
            <WindowButton onClick={() => setIncrementOpen(true)} disabled={!data.rows.some((r) => r.current)} title="One rule for many salaries: basic by % or amount, grades added">
              <TrendingUp className="h-3.5 w-3.5 text-brand" /> Mass increment
            </WindowButton>
          )}

          {onOpenApprovals && (
            <WindowButton variant="default" onClick={onOpenApprovals} title="View pending approval changes">
              <FileSpreadsheet className="h-3.5 w-3.5 text-info" /> Approvals
            </WindowButton>
          )}

          {data.permissions.edit && (
            <>
              <WindowButton onClick={() => fileRef.current?.click()} title="Import figures from CSV">
                <FileUp className="h-3.5 w-3.5" /> Import
              </WindowButton>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImportCsv(f);
                  e.target.value = "";
                }}
              />
            </>
          )}

          {printLetterId && (
            <WindowButton
              onClick={() => window.open(`/workforce/salary-mapping/letter/${printLetterId}`, "_blank", "noopener")}
              title="Print salary revision letter for selected employee"
            >
              <Printer className="h-3.5 w-3.5" /> Letter
            </WindowButton>
          )}

          <WindowButton
            variant="default"
            onClick={() => {
              setSearch("");
              setBranchFilter("");
              setDeptFilter("");
              setSelectedIds([]);
            }}
            title="Reset filters"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </WindowButton>
        </div>
      </div>

      {/* Notice alert banner if any */}
      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-center justify-between rounded border px-3 py-1.5 text-xs",
            notice.tone === "danger"
              ? "border-danger/40 bg-danger-subtle text-danger"
              : notice.tone === "warning"
                ? "border-warning/40 bg-warning-subtle text-ink"
                : "border-info/30 bg-info-subtle text-info"
          )}
        >
          <span>
            {notice.text}
            {undo && (
              <button type="button" onClick={undoLast} className="ml-2 cursor-pointer font-medium text-brand-strong underline-offset-2 hover:underline">
                Undo
              </button>
            )}
            {notice.list && notice.list.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {notice.list.slice(0, 8).map((n) => (
                  <li key={n}>{n}</li>
                ))}
                {notice.list.length > 8 && <li>… and {notice.list.length - 8} more</li>}
              </ul>
            )}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="cursor-pointer font-bold text-ink-muted hover:text-ink"
          >
            ✕
          </button>
        </div>
      )}

      {payrollLocked && (
        <div role="alert" className="flex items-center gap-1.5 rounded border border-warning/40 bg-warning-subtle px-3 py-1.5 text-xs text-ink">
          <Lock className="h-3.5 w-3.5 text-warning" />
          <span>{payrollLocked}</span>
        </div>
      )}

      {/* 2. Main Salary Sheet Grid Frame (Matches DataGrid across all modules) */}
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {/* Unified DataGrid-style Header Bar */}
        <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-1.5">
          {/* Left: Toolbar controls */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
            <label className="flex cursor-pointer select-none items-center gap-1.5 font-medium text-ink text-xs">
              <input
                type="checkbox"
                checked={showDataOnly}
                onChange={(e) => setShowDataOnly(e.target.checked)}
                className="h-4 w-4 rounded border-line-input text-brand focus:ring-brand"
              />
              Show Data Only
            </label>

            <div className="h-4 w-px bg-line" />

            <div className="flex items-center gap-1.5">
              <span className="text-2xs font-semibold uppercase tracking-wider text-ink-muted">Year:</span>
              <select
                value={bsYear}
                onChange={(e) => setBsYear(Number(e.target.value))}
                className="h-7 rounded border border-line-input bg-surface px-2 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
              >
                {[2080, 2081, 2082, 2083, 2084, 2085, 2086].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-2xs font-semibold uppercase tracking-wider text-ink-muted">Month:</span>
              <select
                value={bsMonth}
                onChange={(e) => setBsMonth(Number(e.target.value))}
                className="h-7 rounded border border-line-input bg-surface px-2 text-xs font-bold text-ink focus:border-brand focus:outline-none"
              >
                {MONTH_NAMES_UPPER.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {data.templates.length > 0 && data.permissions.edit && (
              <div className="flex items-center gap-1">
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="h-7 rounded border border-line-input bg-surface px-2 text-2xs text-ink focus:border-brand focus:outline-none"
                >
                  <option value="">Apply Template...</option>
                  {data.templates
                    .filter((t) => t.isActive)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleApplyTemplate}
                  disabled={!templateId}
                  className="flex h-7 cursor-pointer items-center gap-1 rounded bg-brand/10 px-2 text-2xs font-medium text-brand hover:bg-brand/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Wand2 className="h-3 w-3" /> Apply
                </button>
              </div>
            )}

            <div className="relative w-36 sm:w-40 shrink-0">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 w-full rounded border border-line-input bg-surface pl-8 pr-2 text-xs text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
              />
            </div>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-7 w-32 shrink-0 rounded border border-line-input bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none cursor-pointer"
              title="Filter by branch"
            >
              <option value="">All Branches</option>
              {data.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-7 w-36 shrink-0 rounded border border-line-input bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none cursor-pointer"
              title="Filter by department"
            >
              <option value="">All Departments</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Right: Selected counter, Row count, Copy, Export, Columns */}
          {selectedIds.length > 0 && (
            <span className="rounded-md bg-selection px-2 py-0.5 text-2xs font-medium text-brand-strong tabular-nums">
              {selectedIds.length} selected
              <button
                type="button"
                className="ml-1.5 underline-offset-2 hover:underline cursor-pointer"
                onClick={() => setSelectedIds([])}
              >
                Clear
              </button>
            </span>
          )}

          <span className="text-2xs text-ink-faint tabular-nums">
            {filteredRows.length.toLocaleString("en-IN")} {filteredRows.length === 1 ? "row" : "rows"}
          </span>

          <button
            type="button"
            onClick={handleCopyRows}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-ink-muted hover:bg-surface-sunken hover:text-ink cursor-pointer"
            title="Copy selected rows to paste in Excel (Ctrl C)"
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Copy</span>
          </button>

          {data.permissions.export && (
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-ink-muted hover:bg-surface-sunken hover:text-ink cursor-pointer"
              title="Export visible columns as CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          {/* Consistent Columns Dropdown (Identical to DataGrid across all modules) */}
          <div className="relative" ref={columnsMenuRef}>
            <button
              ref={columnsButtonRef}
              type="button"
              onClick={() => setColumnsMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={columnsMenuOpen}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-ink-muted hover:bg-surface-sunken hover:text-ink cursor-pointer"
              title="Choose visible columns"
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Columns</span>
            </button>

            {columnsMenuOpen && columnsMenuStyle && (
              <div
                style={columnsMenuStyle}
                className="z-50 flex w-60 flex-col rounded-lg border border-line bg-surface p-1.5 shadow-lg"
              >
                <p className="px-2 pb-1 pt-0.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                  Show columns
                </p>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {allAvailableColumns.map((c, i) => (
                    <label
                      key={c.id}
                      className={cn(
                        "flex items-center gap-2 rounded px-2 py-1.5 text-sm text-ink hover:bg-surface-sunken cursor-pointer select-none",
                        (i === 0 || c.hideable === false) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={i === 0 || !hiddenIds.has(c.id)}
                        disabled={i === 0 || c.hideable === false}
                        onChange={() => toggleColumn(c.id)}
                      />
                      <span>{c.header}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetColumns();
                    setColumnsMenuOpen(false);
                  }}
                  className="mt-1 flex w-full shrink-0 items-center gap-2 rounded px-2 py-1.5 text-xs text-ink-muted hover:bg-surface-sunken cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset widths and columns
                </button>
              </div>
            )}
          </div>
        </div>

        <EditGrid
          label="Salary Sheet Table"
          rows={filteredRows}
          getRowId={(r) => r.row.employeeId}
          columns={columns}
          onChange={handleCombinedGridChange}
          singleClickEdit={!showDataOnly}
          maxHeight="calc(100vh - 380px)"
          empty={
            <div className="flex flex-col items-center justify-center py-12 text-center text-xs text-ink-muted">
              <FileSpreadsheet className="mb-2 h-8 w-8 text-line-strong" />
              <p className="font-medium text-ink">No employees found in this view</p>
              <p className="text-2xs text-ink-muted">Adjust your search or period filters</p>
            </div>
          }
        />
      </div>

      {/* 4. Totals Footer */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-md border border-line-subtle bg-surface-panel px-3.5 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span>
            <span className="text-ink-muted">Employees:</span>{" "}
            <strong className="font-mono text-ink">{filteredRows.length}</strong>
          </span>
          <span>
            <span className="text-ink-muted">Basic:</span>{" "}
            <strong className="font-mono text-ink">{money(totalsSummary.basic)}</strong>
          </span>
          {!gradesOff && (
            <span>
              <span className="text-ink-muted">Grade:</span>{" "}
              <strong className="font-mono text-ink">{money(totalsSummary.grade)}</strong>
            </span>
          )}
          <span>
            <span className="text-ink-muted">Allowances:</span>{" "}
            <strong className="font-mono text-ink">{money(totalsSummary.allowance)}</strong>
          </span>
          {totalsSummary.festival > 0 && (
            <span>
              <span className="text-ink-muted">Festival:</span>{" "}
              <strong className="font-mono text-ink">{money(totalsSummary.festival)}</strong>
            </span>
          )}
          <span>
            <span className="text-ink-muted">Total Salary:</span>{" "}
            <strong className="font-mono text-ink">{money(totalsSummary.totalSalary)}</strong>
          </span>
          <span>
            <span className="text-ink-muted">SSF/PF Deduct:</span>{" "}
            <strong className="font-mono text-ink">{money(totalsSummary.retirement)}</strong>
          </span>
          <span>
            <span className="text-ink-muted">Other Deduct:</span>{" "}
            <strong className="font-mono text-ink">{money(totalsSummary.otherDeductions)}</strong>
          </span>
          <span>
            <span className="text-ink-muted">TDS:</span>{" "}
            <strong className="font-mono text-ink">{money(totalsSummary.incomeTax)}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">Total Net Payable:</span>
          <span className="font-mono text-base font-bold text-brand">
            NPR {money(totalsSummary.netPayable)}
          </span>
        </div>
      </div>

      {incrementOpen && (
        <SalaryIncrementWindow
          data={data}
          selectedIds={selectedIds}
          linesOf={linesOf}
          contextOf={contextOf}
          onClose={() => setIncrementOpen(false)}
          onApply={runIncrement}
        />
      )}
    </div>
  );
}
