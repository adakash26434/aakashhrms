"use client";

import { useState, useTransition } from "react";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { Combobox } from "@/components/kit/combobox";
import { SelectField } from "@/components/kit/select-field";
import { DateField } from "@/components/kit/date-field";
import { Notice } from "@/components/kit/notice";
import { EVENT_KINDS } from "@/lib/engines/employee-event.engine";
import { createEmployeeEventAction } from "@/app/actions/employee-event.actions";
import type { EventsPageData } from "@/lib/types/employee-event";

// New lifecycle event (G2): promotion (बढुवा), transfer (सरुवा) or
// confirmation (स्थायी). Due today or earlier → the employee record changes
// now; future-dated → scheduled. Optionally issues the matching letter.

interface NewEventWindowProps {
  open: boolean;
  onClose: () => void;
  data: EventsPageData;
  onSaved: (message: string, letterId: string | null, warning: string | null) => void;
}

export function NewEventWindow({ open, onClose, data, onSaved }: NewEventWindowProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [kind, setKind] = useState("");
  const [effectiveDateAd, setEffectiveDateAd] = useState("");
  const [toDesignationId, setToDesignationId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [toDepartmentId, setToDepartmentId] = useState("");
  const [reason, setReason] = useState("");
  const [issueLetter, setIssueLetter] = useState(true);
  const [letterLanguage, setLetterLanguage] = useState("np");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = !!employeeId || !!kind || !!effectiveDateAd || !!reason;
  const kindDef = EVENT_KINDS.find((k) => k.code === kind);

  const reset = () => {
    setEmployeeId("");
    setKind("");
    setEffectiveDateAd("");
    setToDesignationId("");
    setToBranchId("");
    setToDepartmentId("");
    setReason("");
    setIssueLetter(true);
    setLetterLanguage("np");
    setErrors({});
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await createEmployeeEventAction({
        employeeId,
        kind,
        effectiveDateAd,
        toDesignationId,
        toBranchId,
        toDepartmentId,
        reason,
        issueLetter: data.permissions.issueLetter && issueLetter,
        letterLanguage,
      });
      if (result.success) {
        const saved = result.data;
        reset();
        onSaved(
          saved.event.status === "scheduled"
            ? `${saved.event.kindName} scheduled for ${saved.event.effectiveDateBs}.`
            : `${saved.event.kindName} recorded and applied.`,
          saved.letterId,
          saved.letterWarning,
        );
      } else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window
      open={open}
      onClose={close}
      title="New lifecycle event"
      description="Due today or earlier applies to the employee record now; a future date is scheduled. Applied events are corrected by a new event, never edited."
      size="md"
      dirty={dirty}
      footer={
        <>
          <WindowButton onClick={close}>Cancel</WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending || !employeeId || !kind || !effectiveDateAd}>
            {pending ? "Saving…" : "Save event"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Event">
            <FieldRow label="Employee" required error={errors.employeeId}>
              <Combobox
                options={data.employees.map((e) => ({ value: e.id, label: e.fullName, hint: `${e.employeeCode} · ${e.branch}` }))}
                value={employeeId}
                onChange={setEmployeeId}
                placeholder="Type a name or code"
              />
            </FieldRow>
            <FieldRow label="What happened" required error={errors.kind}>
              <SelectField
                options={EVENT_KINDS.map((k) => ({ value: k.code, label: `${k.name} · ${k.nameNp}` }))}
                value={kind}
                onChange={setKind}
                placeholder="Choose"
              />
            </FieldRow>
            <FieldRow label="Effective date" required error={errors.effectiveDateAd}>
              <DateField value={effectiveDateAd} onChange={setEffectiveDateAd} />
            </FieldRow>
            {kind === "promotion" && (
              <FieldRow label="New designation" required error={errors.toDesignationId} help="Pay changes go through Salary structure as their own revision.">
                <SelectField
                  options={data.designations.map((d) => ({ value: d.id, label: d.name }))}
                  value={toDesignationId}
                  onChange={setToDesignationId}
                  placeholder="Choose the new designation"
                />
              </FieldRow>
            )}
            {kind === "transfer" && (
              <>
                <FieldRow label="New branch" error={errors.toBranchId}>
                  <SelectField options={data.branches.map((b) => ({ value: b.id, label: b.name }))} value={toBranchId} onChange={setToBranchId} placeholder="Unchanged" allowEmpty />
                </FieldRow>
                <FieldRow label="New department" error={errors.toDepartmentId}>
                  <SelectField options={data.departments.map((d) => ({ value: d.id, label: d.name }))} value={toDepartmentId} onChange={setToDepartmentId} placeholder="Unchanged" allowEmpty />
                </FieldRow>
              </>
            )}
            <FieldRow label="Reason" error={errors.reason} help="Goes on the letter as remarks when filled.">
              <textarea className={`${inputClass} h-auto min-h-16 max-w-none py-2`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </FieldRow>
          </FieldGroup>
          {data.permissions.issueLetter && (
            <FieldGroup title="Letter" description="The matching letter is issued right away with this event's details and the next chalani number.">
              <FieldRow label="Issue letter">
                <label className="flex h-8 items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={issueLetter} onChange={(e) => setIssueLetter(e.target.checked)} />
                  {kindDef ? `Issue the ${kindDef.name.toLowerCase()} letter (${kindDef.nameNp})` : "Issue the matching letter"}
                </label>
              </FieldRow>
              {issueLetter && (
                <FieldRow label="Language">
                  <SelectField
                    options={[
                      { value: "np", label: "नेपाली" },
                      { value: "en", label: "English" },
                    ]}
                    value={letterLanguage}
                    onChange={setLetterLanguage}
                  />
                </FieldRow>
              )}
            </FieldGroup>
          )}
        </PropertyForm>
      </div>
    </Window>
  );
}
