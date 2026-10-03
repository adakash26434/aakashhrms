"use client";

import { useRef, useState } from "react";
import { Loader2, UserCheck, UserX } from "lucide-react";
import { DateField } from "@/components/kit/date-field";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton } from "@/components/kit/window";
import { setEmployeeStatusAction } from "@/app/actions/employee.actions";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import type { EmployeeValidationErrors } from "@/lib/types/employee";
import { SEPARATION_PLANS, SEPARATION_TYPES } from "./employee-form-separation";

export interface StatusTarget {
  id: string;
  fullName: string;
  employeeCode: string;
  status: "Active" | "Inactive";
}

/**
 * Make an employee inactive (with separation details) or active again.
 * Employees are never deleted: this is how someone leaves, and it switches
 * their self-service login off at once (on again when reactivated).
 */
export function EmployeeStatusWindow({ target, onClose, onDone }: { target: StatusTarget | null; onClose: () => void; onDone: () => void }) {
  if (!target) return null;
  return <StatusWindowBody key={target.id + target.status} target={target} onClose={onClose} onDone={onDone} />;
}

function StatusWindowBody({ target, onClose, onDone }: { target: StatusTarget; onClose: () => void; onDone: () => void }) {
  const leaving = target.status === "Active";
  const [lastDay, setLastDay] = useState(nepalDateIso());
  const [notice, setNotice] = useState("");
  const [type, setType] = useState("");
  const [plan, setPlan] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<EmployeeValidationErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);

  const submit = async () => {
    if (pending) return;
    setFailure(null);
    const local: EmployeeValidationErrors = {};
    if (leaving) {
      if (!lastDay) local.terminationDate = "Enter the last working day";
      if (!type) local.terminationType = "Choose a separation type";
      if (reason.trim().length < 3) local.terminationReason = "Give a short reason";
    }
    setErrors(local);
    if (Object.keys(local).length) return;
    setPending(true);
    const result = await setEmployeeStatusAction(
      target.id,
      leaving ? "Inactive" : "Active",
      leaving ? { terminationDate: lastDay, terminationType: type, terminationReason: reason, terminationPlan: plan || undefined, informedDate: notice || undefined } : undefined
    );
    setPending(false);
    if (!result.success) {
      if (result.validationErrors) setErrors(result.validationErrors);
      setFailure(result.error);
      return;
    }
    onDone();
  };

  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title={leaving ? `Make ${target.fullName} inactive` : `Make ${target.fullName} active again`}
      description={target.employeeCode}
      size={leaving ? "lg" : "sm"}
      footer={
        <>
          <WindowButton onClick={onClose} disabled={pending}>
            Cancel
          </WindowButton>
          <WindowButton ref={submitRef} variant={leaving ? "danger" : "primary"} onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : leaving ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
            {leaving ? "Make inactive" : "Make active"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink-muted">
        {leaving ? (
          <p>
            Their self-service login is switched off at once and payroll stops after the last working day. The record, payslips and history are kept, and
            you can make them active again later. Employees are never deleted.
          </p>
        ) : (
          <p>
            Their self-service login is switched back on and the recorded separation is cleared. They are included again from the next payroll run.
          </p>
        )}
        {failure && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1.5 text-xs text-danger">
            {failure}
          </p>
        )}
        {leaving && (
          <PropertyForm onSubmit={submit} enterNavigation={{ end: () => submitRef.current }} className="-mx-4 space-y-0">
            <FormGrid columns={2}>
              <GridField label="Last working day" required error={errors.terminationDate} size="date">
                <DateField name="terminationDate" value={lastDay} onChange={setLastDay} />
              </GridField>
              <GridField label="Notice given on" error={errors.informedDate} size="date">
                <DateField name="informedDate" value={notice} onChange={setNotice} />
              </GridField>
              <GridField label="Separation type" required error={errors.terminationType} size="md">
                <SelectField name="terminationType" options={SEPARATION_TYPES} value={type} onChange={setType} placeholder="Choose…" />
              </GridField>
              <GridField label="Retirement benefit" error={errors.terminationPlan} size="md">
                <SelectField name="terminationPlan" options={SEPARATION_PLANS} value={plan} onChange={setPlan} placeholder="Not set" allowEmpty />
              </GridField>
              <GridField label="Reason" required error={errors.terminationReason} span={2} size="full">
                <input name="terminationReason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
              </GridField>
            </FormGrid>
          </PropertyForm>
        )}
      </div>
    </Window>
  );
}
