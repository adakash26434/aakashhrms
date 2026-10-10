"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Notice } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { FieldGroup, FieldRow, PropertyForm } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import {
  DEFAULT_RULE,
  MAX_AMOUNT,
  MAX_GRADES_AT_ONCE,
  MAX_PERCENT,
  ROUNDINGS,
  applyIncrement,
  describeRule,
  ruleErrors,
  type BasicRule,
  type IncrementContext,
  type IncrementRule,
  type Rounding,
} from "@/lib/engines/increment.engine";
import { needsStructure } from "@/lib/engines/salary-structure.engine";
import type { SalaryStructureData, StructureLines, StructureRow } from "@/lib/types/salary-structure";

// Mass increment (4.8 / F14): who (branch, department, level — or the selected rows) and the rule
// (basic by % or amount, or raised to the level's starting salary; grades added within the
// policy's cap). Applying fills the salary sheet, where the rows are checked and saved as one
// change through the salary approval flow.

const BASIC_OPTIONS: { value: BasicRule; label: string }[] = [
  { value: "percent", label: "Increase by a percentage" },
  { value: "amount", label: "Increase by an amount" },
  { value: "level_start", label: "Raise to the level's starting salary" },
  { value: "none", label: "No change" },
];

export interface IncrementTarget {
  /** Employees the rule applies to. */
  ids: string[];
  rule: IncrementRule;
}

/** Who a mass increment can reach: someone with a salary structure and no change waiting. */
export const incrementable = (r: StructureRow) => !needsStructure(r) && r.status !== "pending" && !!r.current;

export function SalaryIncrementWindow({
  data,
  selectedIds,
  linesOf,
  contextOf,
  onClose,
  onApply,
}: {
  data: SalaryStructureData;
  /** Rows selected in the table (more than one: "only the selected rows"). */
  selectedIds: readonly string[];
  /** A row's lines as the table has them now (edited or current). */
  linesOf: (row: StructureRow) => StructureLines;
  contextOf: (row: StructureRow) => IncrementContext;
  onClose: () => void;
  onApply: (target: IncrementTarget) => void;
}) {
  const [rule, setRule] = useState<IncrementRule>(DEFAULT_RULE);
  const [filters, setFilters] = useState({ branch: "", dept: "", level: "" });
  const [onlySelected, setOnlySelected] = useState(selectedIds.length > 1);
  const [touched, setTouched] = useState(false);
  const gradesOff = data.gradePolicy?.calculationMethod === "DISABLED_NO_GRADES";
  const anyLevelMax = data.levels.some((l) => l.maxSalary > 0);

  const targets = useMemo(() => {
    const byId = new Map(data.rows.map((r) => [r.employeeId, r]));
    if (onlySelected) return selectedIds.map((id) => byId.get(id)).filter((r): r is StructureRow => !!r && incrementable(r));
    return data.rows.filter(
      (r) =>
        incrementable(r) &&
        (!filters.branch || r.branchId === filters.branch) &&
        (!filters.dept || r.departmentId === filters.dept) &&
        (!filters.level || r.levelCode === filters.level),
    );
  }, [data.rows, filters, onlySelected, selectedIds]);
  const waiting = data.rows.filter((r) => r.status === "pending").length;

  const errors = ruleErrors(rule);
  const preview = useMemo(
    () =>
      targets.slice(0, 6).map((r) => {
        const before = linesOf(r);
        const result = applyIncrement(before, rule, contextOf(r));
        return { r, before, after: result.lines, notes: result.notes };
      }),
    [targets, rule, linesOf, contextOf],
  );
  const set = <K extends keyof IncrementRule>(k: K, v: IncrementRule[K]) => setRule((cur) => ({ ...cur, [k]: v }));
  const apply = () => {
    setTouched(true);
    if (Object.keys(errors).length || !targets.length) return;
    onApply({ ids: targets.map((r) => r.employeeId), rule });
  };

  return (
    <Window
      open
      onClose={onClose}
      size="lg"
      title="Mass increment"
      description="One rule for many salaries. The salary sheet shows the result; nothing is saved until you Save it for approval."
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={apply} disabled={!targets.length}>
            <TrendingUp className="h-3.5 w-3.5" /> Apply to {targets.length} employee{targets.length === 1 ? "" : "s"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        <PropertyForm>
          <FieldGroup title="Who" description={waiting ? `${waiting} with a salary change waiting for approval are left out.` : undefined}>
            {selectedIds.length > 1 && (
              <FieldRow label={`Only the ${selectedIds.length} selected rows`}>
                <YesNoField value={onlySelected} onChange={setOnlySelected} />
              </FieldRow>
            )}
            {!onlySelected && (
              <>
                <FieldRow label="Branch">
                  <SelectField name="inc-branch" options={data.branches.map((b) => ({ value: b.id, label: b.name }))} value={filters.branch} onChange={(v) => setFilters({ ...filters, branch: v })} placeholder="All branches" allowEmpty />
                </FieldRow>
                <FieldRow label="Department">
                  <SelectField name="inc-dept" options={data.departments.map((d) => ({ value: d.id, label: d.name }))} value={filters.dept} onChange={(v) => setFilters({ ...filters, dept: v })} placeholder="All departments" allowEmpty />
                </FieldRow>
                <FieldRow label="Level">
                  <SelectField name="inc-level" options={data.levels.map((l) => ({ value: l.code, label: `${l.code} · ${l.name}` }))} value={filters.level} onChange={(v) => setFilters({ ...filters, level: v })} placeholder="All levels" allowEmpty />
                </FieldRow>
              </>
            )}
            <FieldRow label="Employees">
              <p className="py-1 text-xs text-ink">
                <strong className="tabular-nums">{targets.length}</strong> with a salary structure
              </p>
            </FieldRow>
          </FieldGroup>

          <FieldGroup title="Rule" description="Increments only: basic and grades never go down. The grade amount follows the grade policy.">
            <FieldRow label="Basic salary" error={touched ? errors.basic : undefined}>
              <SelectField name="inc-basic" options={BASIC_OPTIONS} value={rule.basic} onChange={(v) => set("basic", v as BasicRule)} />
            </FieldRow>
            {(rule.basic === "percent" || rule.basic === "amount") && (
              <>
                <FieldRow label={rule.basic === "percent" ? "Percentage" : "Amount (NPR a month)"} required error={touched ? errors.value : undefined} help={rule.basic === "percent" ? `Up to ${MAX_PERCENT}%.` : `Up to ${MAX_AMOUNT.toLocaleString("en-IN")}.`}>
                  <NumberField name="inc-value" value={rule.value} decimals={rule.basic === "percent" ? 2 : 0} min={0} max={rule.basic === "percent" ? MAX_PERCENT : MAX_AMOUNT} onChange={(n) => set("value", n)} aria-label={rule.basic === "percent" ? "Percentage" : "Amount"} />
                </FieldRow>
                <FieldRow label="Round the new basic up to">
                  <SelectField name="inc-round" options={ROUNDINGS.map((n) => ({ value: String(n), label: n === 1 ? "the rupee" : `the next ${n}` }))} value={String(rule.roundTo)} onChange={(v) => set("roundTo", Number(v) as Rounding)} />
                </FieldRow>
              </>
            )}
            {!gradesOff && (
              <FieldRow label="Add grades" error={touched ? errors.grades : undefined} help={data.gradePolicy?.maxGradesAllowedPerLevel ? `At most ${data.gradePolicy.maxGradesAllowedPerLevel} grades per level (grade policy).` : undefined}>
                <NumberField name="inc-grades" value={rule.grades} decimals={0} min={0} max={MAX_GRADES_AT_ONCE} showZero onChange={(n) => set("grades", n)} aria-label="Grades to add" />
              </FieldRow>
            )}
            {anyLevelMax && rule.basic !== "none" && (
              <FieldRow label="Not above the level's maximum">
                <YesNoField value={rule.capAtLevelMax} onChange={(v) => set("capAtLevelMax", v)} />
              </FieldRow>
            )}
          </FieldGroup>
        </PropertyForm>

        {!Object.keys(errors).length && preview.length > 0 && (
          <section aria-label="Preview" className="rounded-md border border-line bg-surface-sunken px-3 py-2">
            <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-ink-faint">
              Preview · {describeRule(rule)}
              {targets.length > preview.length ? ` · first ${preview.length} of ${targets.length}` : ""}
            </p>
            <table className="w-full text-xs tabular-nums">
              <tbody>
                {preview.map(({ r, before, after, notes }) => (
                  <tr key={r.employeeId} className="border-b border-line/70 last:border-0">
                    <td className="py-1 pr-2 text-ink">
                      {r.fullName} <span className="font-code text-3xs text-ink-faint">{r.employeeCode}</span>
                    </td>
                    <td className="py-1 pr-2 text-right text-ink-muted">{before.basic.toLocaleString("en-IN")}</td>
                    <td className="py-1 pr-2 text-right font-medium text-ink">→ {after.basic.toLocaleString("en-IN")}</td>
                    {!gradesOff && (
                      <td className="py-1 pr-2 text-right text-ink-muted">
                        {before.gradeCount} → {after.gradeCount} gr.
                      </td>
                    )}
                    <td className="py-1 text-2xs text-warning">{notes.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {!targets.length && <Notice tone="info">Nobody matches: choose another branch, department or level.</Notice>}
      </div>
    </Window>
  );
}
