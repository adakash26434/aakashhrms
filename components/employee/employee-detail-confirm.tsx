"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Notice } from "@/components/kit/notice";
import { inputClass } from "@/components/kit/property-form";
import { Window, WindowButton } from "@/components/kit/window";
import { REASON_MAX, REASON_MIN, inSentence, type DetailLine } from "@/lib/engines/employee-detail.engine";
import type { DetailFormInfo } from "@/lib/types/employee-detail";
import { cn } from "@/lib/utils";
import { DetailLinesTable, ON_SAVE_TEXT } from "./employee-detail-bits";

/**
 * F13: before a save changes the bank account, PAN or tax status of an existing employee, show
 * what changes, say what happens next (a second person approves, or it applies now) and ask why.
 */
export function EmployeeDetailConfirm({
  summary,
  lines,
  onSave,
  saving,
  error,
  onCancel,
  onConfirm,
}: {
  summary: string;
  lines: readonly DetailLine[];
  onSave: DetailFormInfo["onSave"];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const short = reason.trim().length < REASON_MIN;
  const waits = onSave === "wait" || onSave === "wait_own";
  const submit = () => {
    setTouched(true);
    if (!short && !saving) onConfirm(reason.trim());
  };

  return (
    <Window
      open
      onClose={saving ? () => {} : onCancel}
      title={`Change ${inSentence(summary)}`}
      description="These details decide where pay goes and how it is taxed."
      size="md"
      footer={
        <>
          <WindowButton onClick={onCancel} disabled={saving}>
            Back to the form
          </WindowButton>
          <WindowButton variant="primary" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {waits ? "Save and send for approval" : "Save the change"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {error && <Notice tone="danger">{error}</Notice>}
        <DetailLinesTable lines={lines} />
        <p className={cn("text-xs", waits ? "text-ink" : "text-ink-muted")}>{ON_SAVE_TEXT[onSave]}</p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink">
            Reason <span className="text-danger">*</span> <span className="font-normal text-ink-faint">— the approver reads it</span>
          </span>
          <textarea
            data-autofocus
            className={cn(inputClass, "h-auto min-h-16 max-w-none py-2")}
            maxLength={REASON_MAX}
            value={reason}
            placeholder="e.g. Employee's letter of 2083/06/20: the old account is closed"
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
              }
            }}
            aria-invalid={touched && short}
          />
          {touched && short && <span className="mt-1 block text-2xs text-danger">Say why in at least {REASON_MIN} characters.</span>}
        </label>
      </div>
    </Window>
  );
}
