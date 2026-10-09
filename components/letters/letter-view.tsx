"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { LetterSheet } from "./letter-sheet";
import { Window, WindowButton } from "@/components/kit/window";
import { Notice } from "@/components/kit/notice";
import { inputClass } from "@/components/kit/property-form";
import { voidLetterAction } from "@/app/actions/letter.actions";
import type { LetterDetail, LetterheadData } from "@/lib/types/letter";

// The letter page (G2): the printable sheet plus Void for users with DELETE.
// Voiding needs a reason, keeps the chalani number unused forever, and is
// refused for the user's own letter on the server (S26).

export function LetterView({ letter, letterhead, canVoid }: { letter: LetterDetail; letterhead: LetterheadData; canVoid: boolean }) {
  const router = useRouter();
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await voidLetterAction(letter.id, reason);
      if (result.success) {
        setVoiding(false);
        router.refresh();
      } else {
        const fieldError = "validationErrors" in result && result.validationErrors ? Object.values(result.validationErrors)[0] : null;
        setError(fieldError ?? result.error);
      }
    });

  return (
    <>
      <LetterSheet
        letter={letter}
        letterhead={letterhead}
        actions={
          canVoid && letter.status === "issued" ? (
            <WindowButton variant="danger" onClick={() => setVoiding(true)}>
              <Ban className="h-3.5 w-3.5" /> Void
            </WindowButton>
          ) : null
        }
      />
      <Window
        open={voiding}
        onClose={() => setVoiding(false)}
        title={`Void letter ${letter.letterNumber}`}
        description="A voided letter stays in the register with its number; the text never changes. Issue a corrected letter afterwards."
        size="sm"
        footer={
          <>
            <WindowButton onClick={() => setVoiding(false)}>Cancel</WindowButton>
            <WindowButton variant="danger" onClick={submit} disabled={pending || reason.trim().length < 5}>
              {pending ? "Voiding…" : "Void letter"}
            </WindowButton>
          </>
        }
      >
        <div className="space-y-3">
          {error && <Notice tone="danger">{error}</Notice>}
          <label className="block text-sm text-ink">
            Reason
            <textarea className={`${inputClass} mt-1 h-auto min-h-20 max-w-none py-2`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Issued with the wrong effective date" />
          </label>
        </div>
      </Window>
    </>
  );
}
