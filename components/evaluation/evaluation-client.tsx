"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, FilePen, FolderOpen, ListChecks, Lock, Plus, RefreshCw } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { StatusChip } from "@/components/kit/status-chip";
import { Notice } from "@/components/kit/notice";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Combobox } from "@/components/kit/combobox";
import { Confirm } from "@/components/kit/confirm";
import { DateCell } from "@/components/kit/date-cell";
import { EvaluationWindow } from "./evaluation-window";
import { EvaluationFormTab } from "./evaluation-form-tab";
import { EVALUATION_STAGES, activeStages, stageDef } from "@/lib/engines/evaluation.engine";
import { openEvaluationCycleAction, closeEvaluationCycleAction, startEvaluationsAction } from "@/app/actions/evaluation.actions";
import type { EvaluationListRow, EvaluationsPageData } from "@/lib/types/evaluation";

// Performance evaluation (G1): का.स.मू. register with "waiting for me",
// cycles, and the company's form. Open a row to score your stage.

type EvalTab = "evaluations" | "cycles" | "form";

export function EvaluationClient({ data, myUserId, initialStatus }: { data: EvaluationsPageData; myUserId: string; initialStatus?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<EvalTab>("evaluations");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>((): FilterValues => (initialStatus ? { status: initialStatus } : {}));
  const [openId, setOpenId] = useState<string | null>(null);
  const [openingCycle, setOpeningCycle] = useState(false);
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState<{ id: string; label: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();

  const refresh = () => startRefresh(() => router.refresh());

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.evaluations.filter((e) => {
      if (filters.cycle && e.cycleId !== filters.cycle) return false;
      if (filters.status === "waiting" && !e.waitingForMe) return false;
      else if (filters.status && filters.status !== "waiting" && e.status !== filters.status) return false;
      if (q && ![e.employeeName, e.employeeCode, e.designation, e.branch].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data.evaluations, filters, search]);

  const columns: GridColumn<EvaluationListRow>[] = [
    { id: "employee", header: "Employee", value: (e) => e.employeeName, sticky: true, cell: (e) => (
        <span>
          {e.employeeName} <span className="text-ink-faint">· {e.employeeCode}</span>
        </span>
      ) },
    { id: "designation", header: "Designation", value: (e) => e.designation, width: 150 },
    { id: "branch", header: "Branch", value: (e) => e.branch, width: 130, defaultHidden: true },
    { id: "cycle", header: "Cycle", value: (e) => e.cycleLabel, width: 160 },
    { id: "stage", header: "Stage", value: (e) => (e.status === "final" ? "Final" : e.stageName), width: 130, cell: (e) =>
        e.status === "final" ? <StatusChip status="approved" label="Final" /> : <StatusChip status={e.waitingForMe ? "review" : "pending"} label={e.waitingForMe ? "Waiting for me" : `With ${e.stageName.toLowerCase()}`} /> },
    { id: "total", header: "Total %", value: (e) => e.total, type: "number", align: "right", width: 90 },
    { id: "band", header: "Grade", value: (e) => (e.band ? `${e.band}${e.bandNp ? ` · ${e.bandNp}` : ""}` : ""), width: 170 },
  ];

  const tabs: (TabItem & { id: EvalTab })[] = [
    { id: "evaluations", label: "Evaluations", icon: ListChecks, badge: data.waitingForMe > 0 ? data.waitingForMe : undefined },
    { id: "cycles", label: "Cycles", icon: FolderOpen },
    { id: "form", label: "Form", icon: FilePen },
  ];

  const openCycles = data.cycles.filter((c) => c.status === "open");

  return (
    <div>
      <PageBar
        title="Performance evaluation"
        description={data.waitingForMe > 0 ? `${data.waitingForMe} evaluation${data.waitingForMe === 1 ? "" : "s"} waiting for your marks` : "का.स.मू. — cycles, marks and grades"}
        actions={[
          { id: "start", label: "Start evaluations", icon: ClipboardCheck, group: "create", primary: true, hidden: !data.permissions.start || !openCycles.length, onClick: () => setStarting(true) },
          { id: "open-cycle", label: "Open cycle", icon: Plus, group: "create", hidden: !data.permissions.open, onClick: () => setOpeningCycle(true) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: refresh },
        ]}
      />
      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      {data.formErrors.length > 0 && tab !== "form" && (
        <Notice tone="warning" className="mb-3">
          The evaluation form needs fixing before new evaluations start: {data.formErrors[0]}
        </Notice>
      )}
      <Tabs variant="folder" items={tabs} value={tab} onChange={(next) => setTab(next as EvalTab)} label="Evaluation views">
        {tab === "evaluations" && (
          <div className="p-3">
            <FilterStrip
              id="evaluations"
              className="mb-3"
              search={{ value: search, onChange: setSearch, placeholder: "Employee, code, designation or branch" }}
              filters={[
                { id: "cycle", label: "Cycle", options: data.cycles.map((c) => ({ value: c.id, label: c.label })), allLabel: "All cycles" },
                {
                  id: "status",
                  label: "Status",
                  options: [
                    { value: "waiting", label: "Waiting for me" },
                    { value: "in_progress", label: "In progress" },
                    { value: "final", label: "Final" },
                  ],
                  allLabel: "All statuses",
                },
              ]}
              values={filters}
              onChange={setFilters}
            />
            <DataGrid
              id="evaluations"
              label="Evaluations"
              columns={columns}
              rows={rows}
              getRowId={(e) => e.id}
              onOpen={(e) => setOpenId(e.id)}
              rowTone={(e) => (e.waitingForMe ? "info" : undefined)}
              exportModule="PERFORMANCE"
              exportName="evaluations"
              empty={{ title: "No evaluations", description: data.permissions.start ? "Open a cycle, then start evaluations for the employees in it." : "Evaluations for employees in your scope appear here." }}
            />
          </div>
        )}
        {tab === "cycles" && (
          <div className="p-3">
            <DataGrid
              id="evaluation-cycles"
              label="Evaluation cycles"
              columns={[
                { id: "label", header: "Cycle", value: (c: EvaluationsPageData["cycles"][number]) => c.label, sticky: true },
                { id: "fy", header: "Fiscal year", value: (c) => c.fiscalYearLabel, width: 130 },
                { id: "period", header: "Period", value: (c) => (c.period === "half-yearly" ? "Half-yearly" : "Annual"), width: 110 },
                { id: "progress", header: "Finalized", value: (c) => `${c.finalCount}/${c.evaluationCount}`, align: "right", width: 100 },
                { id: "opened", header: "Opened", value: (c) => c.openedAt.slice(0, 10), cell: (c) => <DateCell value={c.openedAt.slice(0, 10)} />, type: "date", width: 130 },
                { id: "status", header: "Status", value: (c) => c.status, width: 100, cell: (c) => <StatusChip status={c.status === "open" ? "active" : "locked"} label={c.status === "open" ? "Open" : "Closed"} /> },
                { id: "close", header: "", value: () => "", width: 90, cell: (c) =>
                    c.status === "open" && data.permissions.close ? (
                      <button type="button" className="inline-flex items-center gap-1 text-danger underline-offset-2 hover:underline cursor-pointer" onClick={(ev) => { ev.stopPropagation(); setClosing({ id: c.id, label: c.label }); }}>
                        <Lock className="h-3.5 w-3.5" /> Close
                      </button>
                    ) : null },
              ]}
              rows={data.cycles}
              getRowId={(c) => c.id}
              empty={{ title: "No cycles yet", description: "Open a cycle for the fiscal year, then start evaluations." }}
            />
          </div>
        )}
        {tab === "form" && <EvaluationFormTab initial={data.template.form} canEdit={data.permissions.editForm} onSaved={refresh} />}
      </Tabs>

      <EvaluationWindow evaluationId={openId} onClose={() => setOpenId(null)} canFinalize={data.permissions.finalize} myUserId={myUserId} onChanged={refresh} />
      <OpenCycleWindow open={openingCycle} onClose={() => setOpeningCycle(false)} fiscalYears={data.fiscalYears} onDone={(label) => { setOpeningCycle(false); setNotice(`Cycle "${label}" opened.`); refresh(); }} />
      <StartEvaluationsWindow open={starting} onClose={() => setStarting(false)} data={data} onDone={(text) => { setStarting(false); setNotice(text); refresh(); }} />
      <Confirm
        open={!!closing}
        title="Close cycle"
        message={`Close "${closing?.label}"? No more marks can be entered; evaluations still in progress stay as they are.`}
        tone="danger"
        confirmLabel="Close cycle"
        requireText="CLOSE"
        onConfirm={async () => {
          if (!closing) return;
          const result = await closeEvaluationCycleAction(closing.id);
          setClosing(null);
          if (result.success) {
            setNotice("Cycle closed.");
            refresh();
          } else setNotice(result.error);
        }}
        onCancel={() => setClosing(null)}
      />
    </div>
  );
}

function OpenCycleWindow({ open, onClose, fiscalYears, onDone }: { open: boolean; onClose: () => void; fiscalYears: { id: string; label: string }[]; onDone: (label: string) => void }) {
  const [fiscalYearId, setFiscalYearId] = useState("");
  const [label, setLabel] = useState("");
  const [period, setPeriod] = useState("annual");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await openEvaluationCycleAction({ fiscalYearId, label, period });
      if (result.success) {
        setFiscalYearId("");
        setLabel("");
        onDone(result.data.label);
      } else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open={open}
      onClose={onClose}
      title="Open evaluation cycle"
      size="sm"
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending || !fiscalYearId || !label.trim()}>
            {pending ? "Opening…" : "Open cycle"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Cycle">
            <FieldRow label="Fiscal year" required error={errors.fiscalYearId}>
              <SelectField options={fiscalYears.map((y) => ({ value: y.id, label: y.label }))} value={fiscalYearId} onChange={setFiscalYearId} placeholder="Choose" />
            </FieldRow>
            <FieldRow label="Name" required error={errors.label}>
              <input className={inputClass} value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} placeholder='e.g. "Annual 2082/83"' />
            </FieldRow>
            <FieldRow label="Period">
              <SelectField
                options={[
                  { value: "annual", label: "Annual" },
                  { value: "half-yearly", label: "Half-yearly" },
                ]}
                value={period}
                onChange={setPeriod}
              />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

function StartEvaluationsWindow({ open, onClose, data, onDone }: { open: boolean; onClose: () => void; data: EvaluationsPageData; onDone: (text: string) => void }) {
  const [cycleId, setCycleId] = useState("");
  const [raters, setRaters] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const stages = activeStages(data.template.form);
  const openCycles = data.cycles.filter((c) => c.status === "open");

  const start = () =>
    startTransition(async () => {
      setError(null);
      const result = await startEvaluationsAction({ cycleId, employeeIds: [], raters });
      if (result.success) {
        const { started, skipped } = result.data;
        setCycleId("");
        setRaters({});
        onDone(`${started} evaluation${started === 1 ? "" : "s"} started${skipped.length ? `; ${skipped.length} skipped` : ""}.`);
      } else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open={open}
      onClose={onClose}
      title="Start evaluations"
      description="Starts one evaluation for every active employee in your scope not yet in the cycle, with the form as it stands today."
      size="md"
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={start} disabled={pending || !cycleId}>
            {pending ? "Starting…" : "Start evaluations"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        {errors.raters && <Notice tone="danger">{errors.raters}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Cycle and raters">
            <FieldRow label="Cycle" required error={errors.cycleId}>
              <SelectField options={openCycles.map((c) => ({ value: c.id, label: c.label }))} value={cycleId} onChange={setCycleId} placeholder="Choose an open cycle" />
            </FieldRow>
            {stages.map((stage) => (
              <FieldRow
                key={stage}
                label={`${stageDef(stage)?.name} (${stageDef(stage)?.nameNp})`}
                error={errors[stage]}
                help={stage === "supervisor" ? "Leave empty to use each employee's own supervisor." : undefined}
              >
                <Combobox
                  options={data.raterOptions.map((u) => ({ value: u.id, label: u.name }))}
                  value={raters[stage] ?? ""}
                  onChange={(v) => setRaters((prev) => ({ ...prev, [stage]: v }))}
                  placeholder={stage === "supervisor" ? "Each employee's supervisor" : "Choose a user"}
                  allowClear
                />
              </FieldRow>
            ))}
          </FieldGroup>
        </PropertyForm>
        <p className="text-xs text-ink-muted">
          An employee whose raters cannot be worked out (no supervisor account, or the rater would be the employee) is skipped and listed — fix and start again; the rest are unaffected.
        </p>
      </div>
    </Window>
  );
}

export { EVALUATION_STAGES };
