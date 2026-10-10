"use client";

import { useState, useTransition } from "react";
import { Combobox } from "@/components/kit/combobox";
import { SelectField } from "@/components/kit/select-field";
import { Notice } from "@/components/kit/notice";
import { ReportParam, type ReportMetaItem } from "@/components/kit/report-viewer";
import type { ReportContext, ReportPlaces } from "@/lib/types/report";

// Reports (4.11): what every report screen shares — loading a report with new parameters
// through its server action, and the branch / department / employee parameters (only the
// places the viewer covers are offered; the server checks again).

type Result<D> = { success: true; data: D } | { success: false; error: string; ref?: string };

export function useReport<D extends { params: object }>(initial: D, action: (params: D["params"]) => Promise<Result<D>>) {
  type P = D["params"];
  const [data, setData] = useState(initial);
  const [params, setParams] = useState<P>(initial.params);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (next: P = params) =>
    start(async () => {
      const result = await action(next);
      if (result.success) {
        setData(result.data);
        setParams(result.data.params);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  const set = (patch: Partial<P>) => setParams((p) => ({ ...p, ...patch }));
  return { data, params, set, run, pending, error, setError };
}

export interface PlaceValues {
  branchId: string;
  departmentId: string;
  employeeId: string;
}

/** Branch, department and (optionally) one employee, within the viewer's scope. */
export function PlaceParams({ places, value, onChange, employee = true }: { places: ReportPlaces; value: PlaceValues; onChange: (patch: Partial<PlaceValues>) => void; employee?: boolean }) {
  return (
    <>
      {places.branches.length > 1 && (
        <ReportParam label="Branch">
          <SelectField options={places.branches} value={value.branchId} onChange={(v) => onChange({ branchId: v })} allowEmpty placeholder="All branches" aria-label="Branch" />
        </ReportParam>
      )}
      {places.departments.length > 1 && (
        <ReportParam label="Department">
          <SelectField options={places.departments} value={value.departmentId} onChange={(v) => onChange({ departmentId: v })} allowEmpty placeholder="All departments" aria-label="Department" />
        </ReportParam>
      )}
      {employee && (
        <ReportParam label="Employee">
          <Combobox options={places.employees} value={value.employeeId} onChange={(v) => onChange({ employeeId: v })} allowClear placeholder="Everyone — type to pick one" aria-label="Employee" />
        </ReportParam>
      )}
    </>
  );
}

/** The parameter line on the letterhead: who is covered and which branch / department / person. */
export function placeMeta(context: ReportContext, places: ReportPlaces, value: PlaceValues): ReportMetaItem[] {
  const label = (list: { value: string; label: string }[], id: string) => list.find((o) => o.value === id)?.label ?? "";
  const meta: ReportMetaItem[] = [];
  if (value.employeeId) meta.push({ label: "Employee", value: label(places.employees, value.employeeId) });
  if (value.branchId) meta.push({ label: "Branch", value: label(places.branches, value.branchId) });
  else meta.push({ label: context.partialScope ? "Covers" : "Branches", value: context.scopeLabel });
  if (value.departmentId) meta.push({ label: "Department", value: label(places.departments, value.departmentId) });
  return meta;
}

/** Shown above the report when the viewer covers only part of the company, and for errors. */
export function ReportNotices({ context, error, onDismiss }: { context: ReportContext; error: string | null; onDismiss: () => void }) {
  return (
    <>
      {error && (
        <Notice tone="danger" onDismiss={onDismiss}>
          {error}
        </Notice>
      )}
      {context.partialScope && (
        <Notice tone="info">
          Only employees you cover are included ({context.scopeLabel}). Company-wide figures need a company-wide role.
        </Notice>
      )}
    </>
  );
}

/** Text for the Excel title lines and file meta: "Demo Sahakari", the report line, the parameter line. */
export function titleLines(context: ReportContext, report: string, meta: ReportMetaItem[]): string[] {
  return [context.company.name || "Company", report, [...meta.map((m) => `${m.label}: ${m.value}`), `Generated ${context.generatedOn}${context.generatedBy ? ` by ${context.generatedBy}` : ""}`].join(" · ")];
}

export const exportNote = (context: ReportContext) => (context.canExport ? undefined : "Exporting this report needs the Export permission");
