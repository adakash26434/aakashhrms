"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Clock3, FileSignature, Loader2, RefreshCw, Save, Send } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Confirm } from "@/components/kit/confirm";
import { DateCell } from "@/components/kit/date-cell";
import { Notice, type NoticeTone } from "@/components/kit/notice";
import { FieldGroup, FieldRow, PropertyForm, inputClass } from "@/components/kit/property-form";
import { SectionIndex } from "@/components/kit/section-index";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { cancelLegalChangeAction, companySetupPageAction, requestLegalChangeAction, saveCompanyProfileAction } from "@/app/actions/company-setup.actions";
import {
  LEGAL_LABEL,
  PROFILE_KEYS,
  industryLabel,
  legalChangeIsValid,
  legalChanges,
  normalizeLegalChange,
  normalizeProfileForm,
  profileChanges,
  profileIsValid,
  validateLegalChange,
  validateProfileForm,
} from "@/lib/engines/company-profile.engine";
import { INDUSTRY_SECTORS, type IndustrySectorKey } from "@/lib/constants/industry-types";
import type { CompanyProfileErrors, CompanyProfileForm, CompanySetupPage, LegalChangeErrors, LegalChangeForm, LegalDetails } from "@/lib/types/company-setup";
import { cn } from "@/lib/utils";

// Company setup (4.12c, template E): the legal registration the platform keeps (changed through
// a request it approves), the company's own contacts and the signatories printed on letters and
// reports, and the work schedule (the default shift, edited under Attendance → Shifts).

const SECTIONS = [
  { id: "company-legal", label: "Legal registration", fields: [] as (keyof CompanyProfileForm)[] },
  { id: "company-contact", label: "Contact", fields: ["displayName", "contactEmail", "contactPhone"] as (keyof CompanyProfileForm)[] },
  { id: "company-signatories", label: "Signatories", fields: ["signatory1Name", "signatory1Title", "signatory2Name", "signatory2Title"] as (keyof CompanyProfileForm)[] },
  { id: "company-schedule", label: "Work schedule", fields: [] as (keyof CompanyProfileForm)[] },
];

const shownLegal = (k: keyof LegalDetails, v: string) => (k === "industryType" ? industryLabel(v) : v || "Not set");

export function CompanySetupClient({ initial }: { initial: CompanySetupPage }) {
  const [page, setPage] = useState(initial);
  const [form, setForm] = useState(initial.form);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<CompanyProfileErrors | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [loading, start] = useTransition();
  const formRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const edit = page.canEdit;
  // Checked and compared as the server will store it (trimmed, the email in lower case).
  const clean = normalizeProfileForm(form);
  const errors: CompanyProfileErrors = serverErrors ?? (tried ? validateProfileForm(clean) : {});
  const changes = profileChanges(page.form, clean);
  const waiting = page.request?.status === "PENDING" ? page.request : null;
  const rejected = page.request?.status === "REJECTED" ? page.request : null;

  const set = (key: keyof CompanyProfileForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors(null);
  };

  const reload = (message?: { tone: NoticeTone; text: string }) =>
    start(async () => {
      const result = await companySetupPageAction();
      if (!result.success) return setNotice({ tone: "danger", text: result.error });
      setPage(result.data);
      setForm(result.data.form);
      setTried(false);
      setServerErrors(null);
      setNotice(message ?? null);
    });

  const save = () => {
    setTried(true);
    const problems = validateProfileForm(clean);
    if (!profileIsValid(problems)) {
      setNotice({ tone: "danger", text: "Check the highlighted fields." });
      const first = PROFILE_KEYS.find((k) => problems[k]);
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
      return;
    }
    if (!changes.length) return;
    start(async () => {
      const result = await saveCompanyProfileAction(form);
      if (!result.success) {
        if ("validationErrors" in result && result.validationErrors) setServerErrors(result.validationErrors);
        return setNotice({ tone: "danger", text: result.error });
      }
      reload({ tone: "success", text: `Saved: ${result.data.changed.join(", ")}.` });
    });
  };

  const sectionItems = SECTIONS.map((s) => {
    const n = s.fields.filter((f) => errors[f]).length;
    return { id: s.id, label: s.label, state: n ? ("error" as const) : ("optional" as const), errors: n };
  });

  const input = (key: keyof CompanyProfileForm, label: string, help?: string, extra?: { type?: string; placeholder?: string; required?: boolean }) => (
    <FieldRow label={label} required={extra?.required} help={help} error={errors[key] ?? null}>
      <input
        name={key}
        type={extra?.type ?? "text"}
        className={inputClass}
        value={form[key]}
        placeholder={extra?.placeholder}
        readOnly={!edit}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={!!errors[key] || undefined}
      />
    </FieldRow>
  );
  const fact = (label: string, value: ReactNode) => (
    <FieldRow label={label}>
      <p className="pt-1.5 text-sm text-ink">{value}</p>
    </FieldRow>
  );

  const askReason = waiting ? "A request already waits for the platform" : !page.platform ? "The platform can't be reached right now" : undefined;
  return (
    <div>
      <PageBar
        title="Company setup"
        description="The legal registration, contacts, the signatories on letters and reports, and the work schedule"
        actions={[
          { id: "save", label: "Save", icon: Save, group: "create", primary: true, shortcut: "Ctrl+S", hidden: !edit, disabled: loading || !changes.length, disabledReason: changes.length ? undefined : "Nothing changed yet", onClick: save },
          { id: "ask", label: "Request a legal change…", icon: Send, group: "output", hidden: !edit, disabled: loading || !!askReason, disabledReason: askReason, onClick: () => setAsking(true) },
          { id: "refresh", label: loading ? "Loading…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: loading, onClick: () => reload() },
        ]}
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-3" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      {waiting && (
        <Notice tone="warning" className="mb-3">
          A change of the legal details waits for the platform — asked by {waiting.requestedBy} on <DateCell value={waiting.requestedAt.slice(0, 10)} variant="long" />:{" "}
          {legalChanges(page.legal, waiting.proposed)
            .map((k) => `${LEGAL_LABEL[k]} → ${shownLegal(k, waiting.proposed[k])}`)
            .join("; ") || "no change"}
          .{" "}
          {edit && (
            <button type="button" className="font-medium underline underline-offset-2" onClick={() => setWithdrawing(true)}>
              Withdraw the request
            </button>
          )}
        </Notice>
      )}
      {rejected && (
        <Notice tone="danger" className="mb-3">
          The platform did not approve the last change of the legal details{rejected.rejectionReason ? `: ${rejected.rejectionReason}` : "."}
        </Notice>
      )}
      {!page.platform && <Notice tone="info" className="mb-3">The platform can&apos;t be reached right now: the legal details shown are the company&apos;s copy, and change requests wait until it is back.</Notice>}
      {!edit && <Notice tone="info" className="mb-3">Changing these needs Organization → Edit with a company-wide role.</Notice>}

      <div className="@container">
        <div className="grid gap-4 @min-[66rem]:grid-cols-[12rem_minmax(0,1fr)]">
          <SectionIndex className="sticky top-4 self-start" label="Company" items={sectionItems} />
          <div ref={formRef} className="min-w-0">
            <PropertyForm enterNavigation={edit ? { end: () => saveRef.current } : undefined} onSubmit={edit ? save : undefined}>
              <section id="company-legal">
                <FieldGroup title="Legal registration" description="Kept by the platform from the company's registration. Ask for a change with the documents: it applies when the platform approves it.">
                  {(Object.keys(LEGAL_LABEL) as (keyof LegalDetails)[]).map((k) => (
                    <div key={k}>{fact(LEGAL_LABEL[k], <span className={cn(page.legal[k] && (k === "panVatNumber" || k === "registrationNumber") && "font-code tabular-nums", !page.legal[k] && "text-ink-faint")}>{shownLegal(k, page.legal[k])}</span>)}</div>
                  ))}
                </FieldGroup>
              </section>
              <section id="company-contact">
                <FieldGroup title="Contact" description="The name the company works under and how to reach its office.">
                  {input("displayName", "Display name", "Shown beside the legal name, e.g. on the self-service portal.", { required: true })}
                  {input("contactEmail", "Email", undefined, { type: "email", placeholder: "info@company.com" })}
                  {input("contactPhone", "Phone", undefined, { type: "tel", placeholder: "061-123456" })}
                </FieldGroup>
              </section>
              <section id="company-signatories">
                <FieldGroup title="Signatories" description="Printed under letters, salary sheets, tax certificates and settlement statements.">
                  {input("signatory1Name", "Prepared / verified by", undefined, { placeholder: "e.g. Ramesh Shrestha" })}
                  {input("signatory1Title", "Title", undefined, { placeholder: "e.g. Accounts Officer" })}
                  {input("signatory2Name", "Authorised / approved by", undefined, { placeholder: "e.g. Sita Sharma" })}
                  {input("signatory2Title", "Title", undefined, { placeholder: "e.g. Chief Executive Officer" })}
                </FieldGroup>
              </section>
              <section id="company-schedule">
                <FieldGroup title="Work schedule" description="The company's default shift. Working hours are set per shift, so branches and teams can work different hours.">
                  {fact("Office hours", `${page.schedule.coreStartTime} – ${page.schedule.coreEndTime}`)}
                  {fact("Weekly off", page.schedule.weeklyOffDays.length ? page.schedule.weeklyOffDays.join(", ") : "None")}
                  {fact("Working days a week", String(page.schedule.workingDaysPerWeek))}
                  {fact("Break", `${page.schedule.lunchBreakMinutes} minutes`)}
                  {fact("Grace", `${page.schedule.gracePeriodMinutes} minutes`)}
                  {fact("Half day from", `${page.schedule.halfDayThresholdHours} hours`)}
                  <div className="px-4 py-3">
                    <Link href="/timeAndLeave/attendance?tab=shifts" className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-strong hover:underline">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden /> Edit in Attendance → Shifts
                    </Link>
                  </div>
                </FieldGroup>
              </section>
            </PropertyForm>
            {edit && (
              <div className="mt-3 flex items-center justify-end gap-2">
                <span className="mr-auto text-2xs text-ink-muted">{changes.length ? `${changes.length} change${changes.length === 1 ? "" : "s"} not saved` : "No changes"}</span>
                <WindowButton onClick={() => (setForm(page.form), setTried(false), setServerErrors(null))} disabled={!changes.length || loading}>
                  Undo changes
                </WindowButton>
                <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={!changes.length || loading}>
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                </WindowButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {asking && (
        <LegalChangeWindow
          legal={page.legal}
          onClose={() => setAsking(false)}
          onSent={() => {
            setAsking(false);
            reload({ tone: "success", text: "Sent to the platform: the legal details change when it approves the request." });
          }}
        />
      )}
      <Confirm
        open={withdrawing}
        title="Withdraw the request?"
        message="The platform stops reviewing it; the legal details stay as they are."
        confirmLabel="Withdraw"
        onConfirm={async () => {
          if (!waiting) return;
          const result = await cancelLegalChangeAction(waiting.id);
          if (!result.success) throw new Error(result.error);
          setWithdrawing(false);
          reload({ tone: "success", text: "The request was withdrawn." });
        }}
        onCancel={() => setWithdrawing(false)}
      />
    </div>
  );
}

function LegalChangeWindow({ legal, onClose, onSent }: { legal: LegalDetails; onClose: () => void; onSent: () => void }) {
  const initial: LegalChangeForm = { ...legal, industryType: legal.industryType in INDUSTRY_SECTORS ? legal.industryType : "", reason: "", reference: "" };
  const [form, setForm] = useState<LegalChangeForm>(initial);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<LegalChangeErrors | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, start] = useTransition();
  const sendRef = useRef<HTMLButtonElement>(null);
  // Checked as the server will read it (trimmed, the PAN without spaces).
  const clean = normalizeLegalChange(form);
  const errors: LegalChangeErrors = serverErrors ?? (tried ? validateLegalChange(clean, legal) : {});
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const set = (key: keyof LegalChangeForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors(null);
    setFailure(null);
  };
  const send = () =>
    start(async () => {
      setTried(true);
      if (!legalChangeIsValid(validateLegalChange(clean, legal))) return setFailure("Check the highlighted fields.");
      const result = await requestLegalChangeAction(form);
      if (result.success) return onSent();
      setFailure(result.error);
      if ("validationErrors" in result && result.validationErrors) setServerErrors(result.validationErrors);
    });

  const field = (key: keyof LegalChangeForm, label: string, control: ReactNode, opts?: { required?: boolean; help?: string }) => (
    <FieldRow label={label} required={opts?.required} help={opts?.help} error={errors[key] ?? null}>
      {control}
    </FieldRow>
  );
  const text = (key: keyof LegalChangeForm, extra?: { mono?: boolean; placeholder?: string }) => (
    <input name={key} className={cn(inputClass, extra?.mono && "font-code")} value={form[key]} placeholder={extra?.placeholder} onChange={(e) => set(key, e.target.value)} aria-invalid={!!errors[key] || undefined} />
  );

  return (
    <Window
      open
      onClose={sending ? () => {} : onClose}
      dirty={dirty}
      size="md"
      title="Request a legal change"
      description="The platform checks it against the registrar's or IRD's documents; nothing changes until it approves."
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel disabled={sending} />
          <WindowButton ref={sendRef} variant="primary" onClick={send} disabled={sending || !dirty}>
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSignature className="h-3.5 w-3.5" />} Send request
          </WindowButton>
        </>
      }
    >
      <PropertyForm enterNavigation={{ end: () => sendRef.current }} onSubmit={send}>
        <FieldGroup title="The details as they should be">
          {field("legalName", LEGAL_LABEL.legalName, text("legalName"), { required: true })}
          {field("panVatNumber", LEGAL_LABEL.panVatNumber, text("panVatNumber", { mono: true, placeholder: "9 digits" }))}
          {field("registrationNumber", LEGAL_LABEL.registrationNumber, text("registrationNumber", { mono: true }))}
          {field(
            "industryType",
            LEGAL_LABEL.industryType,
            <SelectField
              name="industryType"
              options={(Object.keys(INDUSTRY_SECTORS) as IndustrySectorKey[]).map((k) => ({ value: k, label: INDUSTRY_SECTORS[k].label, hint: INDUSTRY_SECTORS[k].labelNepali }))}
              value={form.industryType}
              onChange={(v) => set("industryType", v)}
            />,
            { required: true }
          )}
          {field("headOfficeAddress", LEGAL_LABEL.headOfficeAddress, text("headOfficeAddress"))}
        </FieldGroup>
        <FieldGroup title="Why">
          {field(
            "reason",
            "Reason",
            <textarea name="reason" rows={3} className={cn(inputClass, "h-auto max-w-none py-1.5")} value={form.reason} placeholder="e.g. Renamed by the Office of the Company Registrar on 2083-05-12" onChange={(e) => set("reason", e.target.value)} aria-invalid={!!errors.reason || undefined} />,
            { required: true }
          )}
          {field("reference", "Document reference", text("reference", { placeholder: "e.g. OCR letter 2083/84-014" }))}
        </FieldGroup>
      </PropertyForm>
    </Window>
  );
}
