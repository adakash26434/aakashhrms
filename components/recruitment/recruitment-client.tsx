"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Lock, Plus, RefreshCw, Users } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { StatusChip } from "@/components/kit/status-chip";
import { DateCell } from "@/components/kit/date-cell";
import { Notice } from "@/components/kit/notice";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { DateField } from "@/components/kit/date-field";
import { Confirm } from "@/components/kit/confirm";
import { APPLICANT_STAGES } from "@/lib/engines/recruitment.engine";
import {
  saveApprovedPositionAction,
  openVacancyAction,
  closeVacancyAction,
  getVacancyApplicantsAction,
  addApplicantAction,
  updateApplicantAction,
} from "@/app/actions/recruitment.actions";
import type { ApplicantView, PositionListRow, RecruitmentPageData, VacancyListRow } from "@/lib/types/recruitment";

// Recruitment & darbandi (G4): approved positions with live occupancy, open
// vacancies and the applicant pipeline with exam/interview marks and the
// merit order.

type RecruitTab = "darbandi" | "vacancies";

export function RecruitmentClient({ data }: { data: RecruitmentPageData }) {
  const router = useRouter();
  const [tab, setTab] = useState<RecruitTab>("darbandi");
  const [editingPosition, setEditingPosition] = useState<PositionListRow | null>(null);
  const [creatingPosition, setCreatingPosition] = useState(false);
  const [creatingVacancy, setCreatingVacancy] = useState(false);
  const [openVacancyRow, setOpenVacancyRow] = useState<VacancyListRow | null>(null);
  const [closing, setClosing] = useState<VacancyListRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const positionColumns: GridColumn<PositionListRow>[] = [
    { id: "branch", header: "Branch", value: (p) => p.branch, sticky: true, width: 160 },
    { id: "designation", header: "Designation", value: (p) => p.designation },
    { id: "positions", header: "दरबन्दी", value: (p) => p.positions, type: "number", align: "right", width: 90 },
    { id: "filled", header: "Filled", value: (p) => p.filled, type: "number", align: "right", width: 80 },
    { id: "vacant", header: "Vacant", value: (p) => p.vacant, type: "number", align: "right", width: 80, cell: (p) => (p.vacant > 0 ? <span className="font-semibold text-brand-strong">{p.vacant}</span> : <span>0</span>) },
    { id: "over", header: "Over", value: (p) => p.over, type: "number", align: "right", width: 70, cell: (p) => (p.over > 0 ? <span className="font-semibold text-danger">+{p.over}</span> : null) },
    { id: "ref", header: "Decision ref.", value: (p) => p.decisionRef, width: 150, defaultHidden: false },
    { id: "active", header: "Active", value: (p) => (p.isActive ? "Yes" : "No"), width: 80, cell: (p) => <StatusChip status={p.isActive ? "active" : "inactive"} /> },
  ];

  const vacancyColumns: GridColumn<VacancyListRow>[] = [
    { id: "designation", header: "Designation", value: (v) => v.designation, sticky: true },
    { id: "branch", header: "Branch", value: (v) => v.branch, width: 150 },
    { id: "openings", header: "Openings", value: (v) => v.openings, type: "number", align: "right", width: 90 },
    { id: "applicants", header: "Applicants", value: (v) => v.applicantCount, type: "number", align: "right", width: 100 },
    { id: "selected", header: "Selected", value: (v) => v.selectedCount, type: "number", align: "right", width: 90 },
    { id: "deadline", header: "Deadline", value: (v) => v.deadlineAd ?? "", cell: (v) => (v.deadlineAd ? <DateCell value={v.deadlineAd} /> : null), type: "date", width: 130 },
    { id: "status", header: "Status", value: (v) => v.status, width: 110, cell: (v) => <StatusChip status={v.status === "open" ? "active" : v.status === "cancelled" ? "cancelled" : "locked"} label={v.status === "open" ? "Open" : v.status === "cancelled" ? "Cancelled" : "Closed"} /> },
    { id: "close", header: "", value: () => "", width: 90, cell: (v) =>
        v.status === "open" && data.permissions.manage ? (
          <button type="button" className="inline-flex items-center gap-1 text-danger underline-offset-2 hover:underline cursor-pointer" onClick={(ev) => { ev.stopPropagation(); setClosing(v); }}>
            <Lock className="h-3.5 w-3.5" /> Close
          </button>
        ) : null },
  ];

  const tabs: (TabItem & { id: RecruitTab })[] = [
    { id: "darbandi", label: "दरबन्दी · Positions", icon: BriefcaseBusiness },
    { id: "vacancies", label: "Vacancies", icon: Users, badge: data.vacancies.filter((v) => v.status === "open").length || undefined },
  ];

  return (
    <div>
      <PageBar
        title="Recruitment"
        description="दरबन्दी (approved positions) with live occupancy, vacancies and the applicant merit list"
        actions={[
          { id: "new-vacancy", label: "Open vacancy", icon: Plus, group: "create", primary: true, hidden: !data.permissions.manage, onClick: () => setCreatingVacancy(true) },
          { id: "new-position", label: "Set दरबन्दी", icon: BriefcaseBusiness, group: "create", hidden: !data.permissions.manage, onClick: () => setCreatingPosition(true) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: refresh },
        ]}
      />
      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      <Tabs variant="folder" items={tabs} value={tab} onChange={(next) => setTab(next as RecruitTab)} label="Recruitment views">
        {tab === "darbandi" && (
          <div className="p-3">
            <DataGrid
              id="approved-positions"
              label="Approved positions"
              columns={positionColumns}
              rows={data.positions}
              getRowId={(p) => p.id}
              onOpen={data.permissions.manage ? (p) => setEditingPosition(p) : undefined}
              rowTone={(p) => (p.over > 0 ? "danger" : undefined)}
              exportModule="RECRUITMENT"
              exportName="darbandi"
              empty={{ title: "No approved positions yet", description: data.permissions.manage ? "Record the board-approved post count per designation and branch." : "दरबन्दी for your branches appears here." }}
            />
          </div>
        )}
        {tab === "vacancies" && (
          <div className="p-3">
            <DataGrid
              id="vacancies"
              label="Vacancies"
              columns={vacancyColumns}
              rows={data.vacancies}
              getRowId={(v) => v.id}
              onOpen={(v) => setOpenVacancyRow(v)}
              rowTone={(v) => (v.status === "cancelled" ? "danger" : v.status === "open" ? "info" : undefined)}
              exportModule="RECRUITMENT"
              exportName="vacancies"
              empty={{ title: "No vacancies", description: data.permissions.manage ? "Open a vacancy against a designation and branch." : "Vacancies for your branches appear here." }}
            />
          </div>
        )}
      </Tabs>

      <PositionWindow
        key={editingPosition?.id ?? (creatingPosition ? "new" : "closed")}
        open={creatingPosition || !!editingPosition}
        position={editingPosition}
        designations={data.designations}
        branches={data.branches}
        onClose={() => {
          setCreatingPosition(false);
          setEditingPosition(null);
        }}
        onSaved={() => {
          setCreatingPosition(false);
          setEditingPosition(null);
          setNotice("दरबन्दी saved.");
          refresh();
        }}
      />
      <VacancyWindow
        open={creatingVacancy}
        designations={data.designations}
        branches={data.branches}
        onClose={() => setCreatingVacancy(false)}
        onSaved={() => {
          setCreatingVacancy(false);
          setNotice("Vacancy opened.");
          refresh();
        }}
      />
      {openVacancyRow && (
        <ApplicantsWindow
          key={openVacancyRow.id}
          vacancy={openVacancyRow}
          canManage={data.permissions.manage}
          onClose={() => setOpenVacancyRow(null)}
          onChanged={refresh}
        />
      )}
      <Confirm
        open={!!closing}
        title="Close vacancy"
        message={`Close the ${closing?.designation} vacancy at ${closing?.branch}? Applicants keep their record; no more are added.`}
        confirmLabel="Close vacancy"
        onConfirm={async () => {
          if (!closing) return;
          const result = await closeVacancyAction(closing.id, false);
          setClosing(null);
          if (result.success) {
            setNotice("Vacancy closed.");
            refresh();
          } else setNotice(result.error);
        }}
        onCancel={() => setClosing(null)}
      />
    </div>
  );
}

function PositionWindow({ open, position, designations, branches, onClose, onSaved }: { open: boolean; position: PositionListRow | null; designations: { id: string; name: string }[]; branches: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [designationId, setDesignationId] = useState(position?.designationId ?? "");
  const [branchId, setBranchId] = useState(position?.branchId ?? "");
  const [positions, setPositions] = useState(position ? String(position.positions) : "1");
  const [decisionRef, setDecisionRef] = useState(position?.decisionRef ?? "");
  const [note, setNote] = useState(position?.note ?? "");
  const [isActive, setIsActive] = useState(position?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveApprovedPositionAction({ designationId, branchId, positions: Number(positions), decisionRef, note, isActive });
      if (result.success) onSaved();
      else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open={open}
      onClose={onClose}
      title={position ? `दरबन्दी — ${position.designation} · ${position.branch}` : "Set दरबन्दी"}
      description="The board- or AGM-approved post count for a designation at a branch. Saving the same pair again updates it."
      size="sm"
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending || !designationId || !branchId}>
            {pending ? "Saving…" : "Save"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="दरबन्दी">
            <FieldRow label="Designation" required error={errors.designationId}>
              <SelectField options={designations.map((d) => ({ value: d.id, label: d.name }))} value={designationId} onChange={setDesignationId} placeholder="Choose" disabled={!!position} />
            </FieldRow>
            <FieldRow label="Branch" required error={errors.branchId}>
              <SelectField options={branches.map((b) => ({ value: b.id, label: b.name }))} value={branchId} onChange={setBranchId} placeholder="Choose" disabled={!!position} />
            </FieldRow>
            <FieldRow label="Approved posts" required error={errors.positions}>
              <input type="number" min={0} max={999} className={`${inputClass} w-24 text-right tabular-nums`} value={positions} onChange={(e) => setPositions(e.target.value)} />
            </FieldRow>
            <FieldRow label="Decision ref." error={errors.decisionRef} help="Board / AGM minute, e.g. सञ्चालक समिति नि.नं. १२/२०८२">
              <input className={inputClass} value={decisionRef} maxLength={100} onChange={(e) => setDecisionRef(e.target.value)} />
            </FieldRow>
            <FieldRow label="Note" error={errors.note}>
              <input className={inputClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            </FieldRow>
            <FieldRow label="Active">
              <label className="flex h-8 items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Counted in दरबन्दी
              </label>
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

function VacancyWindow({ open, designations, branches, onClose, onSaved }: { open: boolean; designations: { id: string; name: string }[]; branches: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [designationId, setDesignationId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [openings, setOpenings] = useState("1");
  const [deadlineAd, setDeadlineAd] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await openVacancyAction({ designationId, branchId, openings: Number(openings), deadlineAd, note });
      if (result.success) {
        setDesignationId("");
        setBranchId("");
        setOpenings("1");
        setDeadlineAd("");
        setNote("");
        onSaved();
      } else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open={open}
      onClose={onClose}
      title="Open vacancy"
      size="sm"
      footer={
        <>
          <WindowButton onClick={onClose}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending || !designationId || !branchId}>
            {pending ? "Opening…" : "Open vacancy"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Vacancy">
            <FieldRow label="Designation" required error={errors.designationId}>
              <SelectField options={designations.map((d) => ({ value: d.id, label: d.name }))} value={designationId} onChange={setDesignationId} placeholder="Choose" />
            </FieldRow>
            <FieldRow label="Branch" required error={errors.branchId}>
              <SelectField options={branches.map((b) => ({ value: b.id, label: b.name }))} value={branchId} onChange={setBranchId} placeholder="Choose" />
            </FieldRow>
            <FieldRow label="Openings" required error={errors.openings}>
              <input type="number" min={1} max={99} className={`${inputClass} w-24 text-right tabular-nums`} value={openings} onChange={(e) => setOpenings(e.target.value)} />
            </FieldRow>
            <FieldRow label="Deadline" error={errors.deadlineAd}>
              <DateField value={deadlineAd} onChange={setDeadlineAd} />
            </FieldRow>
            <FieldRow label="Note" error={errors.note}>
              <input className={inputClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

function ApplicantsWindow({ vacancy, canManage, onClose, onChanged }: { vacancy: VacancyListRow; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const [applicants, setApplicants] = useState<ApplicantView[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = async () => {
    const result = await getVacancyApplicantsAction(vacancy.id);
    if (result.success) setApplicants(result.data);
    else setError(result.error);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getVacancyApplicantsAction(vacancy.id);
      if (cancelled) return;
      if (result.success) setApplicants(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [vacancy.id]);

  const add = () =>
    startTransition(async () => {
      setError(null);
      const result = await addApplicantAction(vacancy.id, { fullName, phone, email });
      if (result.success) {
        setFullName("");
        setPhone("");
        setEmail("");
        setAdding(false);
        await reload();
        onChanged();
      } else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  const update = (id: string, patch: { stage?: string; examMarks?: string; interviewMarks?: string }) =>
    startTransition(async () => {
      setError(null);
      const result = await updateApplicantAction(id, patch);
      if (result.success) {
        await reload();
        onChanged();
      } else {
        const fieldError = "validationErrors" in result && result.validationErrors ? Object.values(result.validationErrors)[0] : null;
        setError(fieldError ?? result.error);
      }
    });

  const editable = canManage && vacancy.status === "open";

  return (
    <Window
      open
      onClose={onClose}
      title={`${vacancy.designation} — ${vacancy.branch}`}
      description={`${vacancy.openings} opening${vacancy.openings === 1 ? "" : "s"} · merit = exam + interview marks`}
      size="xl"
      footer={
        <>
          <WindowButton onClick={onClose}>Close</WindowButton>
          {editable && (
            <WindowButton variant="primary" onClick={() => setAdding((v) => !v)}>
              <Plus className="h-3.5 w-3.5" /> Add applicant
            </WindowButton>
          )}
        </>
      }
    >
      {error && (
        <Notice tone="danger" className="mb-3">
          {error}
        </Notice>
      )}
      {adding && (
        <div className="mb-3 rounded-md border border-line bg-surface-sunken p-3">
          <PropertyForm enterNavigation>
            <FieldGroup title="New applicant">
              <FieldRow label="Name" required error={errors.fullName}>
                <input className={inputClass} value={fullName} maxLength={255} onChange={(e) => setFullName(e.target.value)} />
              </FieldRow>
              <FieldRow label="Phone" error={errors.phone}>
                <input className={inputClass} value={phone} maxLength={50} onChange={(e) => setPhone(e.target.value)} />
              </FieldRow>
              <FieldRow label="Email" error={errors.email}>
                <input className={inputClass} value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} />
              </FieldRow>
              <FieldRow label="">
                <WindowButton variant="primary" onClick={add} disabled={pending || fullName.trim().length < 2}>
                  {pending ? "Adding…" : "Add"}
                </WindowButton>
              </FieldRow>
            </FieldGroup>
          </PropertyForm>
        </div>
      )}
      {!applicants ? (
        <p className="p-4 text-sm text-ink-muted">Loading…</p>
      ) : applicants.length === 0 ? (
        <p className="p-4 text-sm text-ink-muted">No applicants yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-line-input text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="w-14 py-1.5 pr-2">Merit</th>
              <th className="py-1.5 pr-2">Applicant</th>
              <th className="w-24 py-1.5 pr-2 text-right">परीक्षा</th>
              <th className="w-24 py-1.5 pr-2 text-right">अन्तर्वार्ता</th>
              <th className="w-20 py-1.5 pr-2 text-right">Total</th>
              <th className="w-40 py-1.5 pr-2">Stage</th>
            </tr>
          </thead>
          <tbody>
            {applicants.map((a) => (
              <ApplicantRowView key={a.id} applicant={a} editable={editable} pending={pending} onUpdate={update} />
            ))}
          </tbody>
        </table>
      )}
    </Window>
  );
}

function ApplicantRowView({ applicant, editable, pending, onUpdate }: { applicant: ApplicantView; editable: boolean; pending: boolean; onUpdate: (id: string, patch: { stage?: string; examMarks?: string; interviewMarks?: string }) => void }) {
  const [exam, setExam] = useState(applicant.examMarks === null ? "" : String(applicant.examMarks));
  const [interview, setInterview] = useState(applicant.interviewMarks === null ? "" : String(applicant.interviewMarks));

  const marksEditable = editable && applicant.stage !== "hired" && applicant.stage !== "rejected";

  return (
    <tr className={applicant.stage === "rejected" ? "border-b border-line opacity-60" : "border-b border-line"}>
      <td className="py-1.5 pr-2 text-center font-semibold tabular-nums">{applicant.rank ?? "—"}</td>
      <td className="py-1.5 pr-2">
        {applicant.fullName}
        {(applicant.phone || applicant.email) && <span className="text-ink-faint"> · {[applicant.phone, applicant.email].filter(Boolean).join(" · ")}</span>}
      </td>
      <td className="py-1 pr-2 text-right">
        {marksEditable ? (
          <input type="number" step={0.5} min={0} max={100} className={`${inputClass} h-7 w-20 text-right tabular-nums`} value={exam} onChange={(e) => setExam(e.target.value)} onBlur={() => exam !== (applicant.examMarks === null ? "" : String(applicant.examMarks)) && onUpdate(applicant.id, { examMarks: exam })} aria-label={`${applicant.fullName} exam marks`} />
        ) : (
          <span className="tabular-nums">{applicant.examMarks ?? "—"}</span>
        )}
      </td>
      <td className="py-1 pr-2 text-right">
        {marksEditable ? (
          <input type="number" step={0.5} min={0} max={100} className={`${inputClass} h-7 w-20 text-right tabular-nums`} value={interview} onChange={(e) => setInterview(e.target.value)} onBlur={() => interview !== (applicant.interviewMarks === null ? "" : String(applicant.interviewMarks)) && onUpdate(applicant.id, { interviewMarks: interview })} aria-label={`${applicant.fullName} interview marks`} />
        ) : (
          <span className="tabular-nums">{applicant.interviewMarks ?? "—"}</span>
        )}
      </td>
      <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">{applicant.total ?? "—"}</td>
      <td className="py-1 pr-2">
        {editable && applicant.stage !== "hired" ? (
          <SelectField
            aria-label={`${applicant.fullName} stage`}
            options={APPLICANT_STAGES.map((s) => ({ value: s.code, label: `${s.name} · ${s.nameNp}` }))}
            value={applicant.stage}
            onChange={(next) => next !== applicant.stage && onUpdate(applicant.id, { stage: next })}
            disabled={pending}
          />
        ) : (
          <StatusChip status={applicant.stage === "hired" ? "approved" : applicant.stage === "selected" ? "review" : applicant.stage === "rejected" ? "rejected" : "pending"} label={`${applicant.stageName}${applicant.stageNameNp ? ` · ${applicant.stageNameNp}` : ""}`} />
        )}
      </td>
    </tr>
  );
}
