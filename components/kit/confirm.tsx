"use client";

import { useRef, useState, type ReactNode } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Window, WindowButton } from "./window";

export interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "default" | "danger";
  /**
   * Typed confirmation for destructive or irreversible actions (security plan,
   * standing measure 6): the user must type this word, e.g. "UNLOCK".
   */
  requireText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/** One confirm dialog for every module (3.6), replacing the per-module copies. */
export function Confirm(props: ConfirmProps) {
  // Remount per opening so the typed text and pending state reset.
  return props.open ? <ConfirmWindow {...props} /> : null;
}

function ConfirmWindow({ title, message, confirmLabel = "Confirm", tone = "default", requireText, onConfirm, onCancel }: ConfirmProps) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = !requireText || typed.trim() === requireText;

  const run = async () => {
    if (!matches || pending) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      // Keep the dialog open and say why. Callers throw with the user-facing text
      // from toActionError (S9); Next.js redacts raw server errors in production.
      setError(e instanceof Error && e.message ? e.message : "That did not go through. Try again.");
      // The disabled button dropped focus; put it back in the dialog.
      requestAnimationFrame(() => inputRef.current?.focus());
    } finally {
      setPending(false);
    }
  };

  return (
    <Window
      open
      onClose={pending ? () => {} : onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <WindowButton onClick={onCancel} disabled={pending}>
            Cancel
          </WindowButton>
          <WindowButton variant={tone === "danger" ? "danger" : "primary"} onClick={run} disabled={!matches || pending} data-autofocus={!requireText ? "" : undefined}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </WindowButton>
        </>
      }
    >
      <div className="flex gap-3">
        {tone === "danger" && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-subtle text-danger">
            <TriangleAlert className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1 text-sm text-ink-muted">{message}</div>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1.5 text-xs text-danger">
          {error}
        </p>
      )}
      {requireText && (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <label className="block text-xs font-medium text-ink">
            Type <span className="rounded bg-surface-sunken px-1 font-code text-ink">{requireText}</span> to confirm
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1.5 h-8 w-full rounded-md border border-line-strong bg-white px-2.5 text-sm text-ink"
              aria-invalid={typed.length > 0 && !matches}
            />
          </label>
        </form>
      )}
    </Window>
  );
}
