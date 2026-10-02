"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, PartyPopper, X } from "lucide-react";
import { isTypingTarget } from "@/lib/frame/shortcuts";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

export interface WorklistProps<T> {
  title: string;
  items: T[];
  getId: (item: T) => string;
  /** One line in the queue list. */
  renderSummary: (item: T) => ReactNode;
  /** The full item, shown in the main pane. */
  renderDetail: (item: T) => ReactNode;
  onApprove: (item: T) => Promise<void> | void;
  /** Rejection requires a reason (it is recorded with the decision). */
  onReject: (item: T, reason: string) => Promise<void> | void;
  approveLabel?: string;
  rejectLabel?: string;
}

/**
 * Worklist (E3, SAP Fiori style): work through approvals one at a time.
 * Keys: J / K next and previous · A approve · R reject (asks for a reason) ·
 * Ctrl+Enter confirm the rejection · Esc cancel it.
 * Keys only act while focus is inside this worklist, so a stray "A" typed
 * elsewhere on the page (a grid, another queue) can never approve anything.
 * Decided items leave the queue; the next one opens automatically.
 */
export function Worklist<T>({
  title,
  items,
  getId,
  renderSummary,
  renderDetail,
  onApprove,
  onReject,
  approveLabel = "Approve",
  rejectLabel = "Reject",
}: WorklistProps<T>) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Keep the stored index in range as the queue shrinks (adjusted during render),
  // so a queue that empties and refills starts again at the first item.
  const maxIndex = Math.max(items.length - 1, 0);
  if (index > maxIndex) setIndex(maxIndex);
  const current = items[Math.min(index, items.length - 1)];
  const position = Math.min(index, items.length - 1);

  const decide = async (kind: "approve" | "reject") => {
    if (!current || busy) return;
    if (kind === "reject" && !rejecting) {
      setRejecting(true);
      return;
    }
    if (kind === "reject" && reason.trim().length < 3) {
      setError("Give a short reason for the rejection.");
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      if (kind === "approve") await onApprove(current);
      else await onReject(current, reason.trim());
      setRejecting(false);
      setReason("");
      // Keep the keys live for the next item (the clicked control may unmount).
      rootRef.current?.focus({ preventScroll: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not go through. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const cancelReject = () => {
    setRejecting(false);
    setError(null);
    rootRef.current?.focus({ preventScroll: true });
  };

  // Scoped to this worklist (React onKeyDown on the root), never window-wide.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (rejecting && e.target instanceof HTMLTextAreaElement) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void decide("reject");
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelReject();
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTypingTarget(e.target as HTMLElement)) return;
    const k = e.key.toLowerCase();
    if (k === "j") setIndex((i) => Math.min(i + 1, items.length - 1));
    else if (k === "k") setIndex((i) => Math.max(i - 1, 0));
    else if (k === "a") void decide("approve");
    else if (k === "r") void decide("reject");
    else return;
    e.preventDefault();
  };

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface">
        <EmptyState icon={<PartyPopper className="h-5 w-5" />} title="All caught up" description={`Nothing is waiting in ${title.toLowerCase()}.`} />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="region"
      aria-label={title}
      aria-keyshortcuts="J K A R"
      className="grid overflow-hidden rounded-lg border border-line bg-surface outline-none focus-within:border-focus focus-within:shadow-[0_0_0_1px_var(--focus)] md:grid-cols-[260px_minmax(0,1fr)]"
    >
      <div className="border-b border-line md:border-b-0 md:border-r">
        <div className="flex h-10 items-center justify-between border-b border-line px-3">
          <p className="text-xs font-semibold text-ink">{title}</p>
          <span className="text-2xs text-ink-faint tabular-nums">
            {position + 1} of {items.length}
          </span>
        </div>
        <ul className="max-h-48 overflow-y-auto md:max-h-[480px]" aria-label={`${title} queue`}>
          {items.map((item, i) => (
            <li key={getId(item)}>
              <button
                type="button"
                onClick={() => {
                  setIndex(i);
                  setRejecting(false);
                }}
                aria-current={i === position}
                className={cn(
                  "relative w-full border-b border-line px-3 py-2 text-left text-xs last:border-b-0 cursor-pointer",
                  i === position ? "bg-selection" : "hover:bg-surface-sunken"
                )}
              >
                {i === position && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brand" />}
                {renderSummary(item)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex min-h-72 flex-col">
        <div className="flex-1 overflow-y-auto p-4">{current && renderDetail(current)}</div>
        <div className="border-t border-line bg-surface-sunken px-4 py-2.5">
          {rejecting && (
            <label className="mb-2 block text-xs font-medium text-ink">
              Reason for rejection
              <textarea
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                className="mt-1 w-full rounded-md border border-line-strong bg-white px-2.5 py-1.5 text-sm text-ink"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="mb-2 text-xs text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setIndex((i) => Math.max(i - 1, 0))} disabled={position === 0} className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface hover:bg-surface-sunken disabled:opacity-40 cursor-pointer" aria-label="Previous (K)">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setIndex((i) => Math.min(i + 1, items.length - 1))} disabled={position >= items.length - 1} className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface hover:bg-surface-sunken disabled:opacity-40 cursor-pointer" aria-label="Next (J)">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <span className="hidden text-2xs text-ink-faint sm:inline">
              {rejecting ? (
                <>
                  <kbd>Ctrl</kbd>+<kbd>Enter</kbd> reject · <kbd>Esc</kbd> cancel
                </>
              ) : (
                <>
                  <kbd>J</kbd>/<kbd>K</kbd> move · <kbd>A</kbd> approve · <kbd>R</kbd> reject
                </>
              )}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {rejecting && (
                <button type="button" onClick={cancelReject} className="h-8 rounded-md px-3 text-xs font-medium text-ink-muted hover:bg-surface cursor-pointer">
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => void decide("reject")}
                disabled={busy !== null}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-danger/30 bg-surface px-3 text-xs font-medium text-danger hover:bg-danger-subtle disabled:opacity-50 cursor-pointer"
              >
                {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                {rejecting ? `Confirm ${rejectLabel.toLowerCase()}` : rejectLabel}
              </button>
              {!rejecting && (
                <button
                  type="button"
                  onClick={() => void decide("approve")}
                  disabled={busy !== null}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50 cursor-pointer"
                >
                  {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {approveLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
