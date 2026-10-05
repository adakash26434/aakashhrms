"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Hourglass, Loader2, LogIn, LogOut, MapPin, Send, TriangleAlert } from "lucide-react";
import { clockAction, clockStatusAction } from "@/app/actions/checkin.actions";
import { useDateText } from "@/components/kit/date-cell";
import { hoursText, localClock } from "@/lib/engines/attendance-day.engine";
import type { ClockStatus } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

const SOURCE: Record<string, string> = { web: "Web", manual: "Entered by HR", device: "Device", import: "Imported", adjustment: "Adjustment" };

type Phase = { kind: "idle" } | { kind: "locating" } | { kind: "sending" } | { kind: "outside"; reason: string; location: Located | null } | { kind: "done"; text: string; tone: "success" | "warning" } | { kind: "error"; text: string };
type Located = { lat: number; lng: number; accuracy: number } | null;

/** The browser's location now (fresh, high accuracy, 10 s); null when refused or unavailable. */
function locate(): Promise<Located> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  });
}

/**
 * Clock card (4.5c): today for the signed-in employee, with Clock in /
 * Clock out. The server decides the time, in or out, and whether the place
 * counts; outside the allowed place the employee can send it for approval
 * with a reason. Location is read only at the moment of clocking. Used on
 * the self-service home and in the main app's top bar.
 */
export function ClockCard({ initial, compact, onChanged }: { initial?: ClockStatus | null; compact?: boolean; onChanged?: (s: ClockStatus) => void }) {
  const router = useRouter();
  const dateText = useDateText();
  const [status, setStatus] = useState<ClockStatus | null>(initial ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [reason, setReason] = useState("");

  const apply = useCallback(
    (res: Awaited<ReturnType<typeof clockStatusAction>>) => {
      if (!res.success) {
        setLoadError(res.error);
        return;
      }
      setLoadError(null);
      setStatus(res.data);
      onChanged?.(res.data);
    },
    [onChanged]
  );
  const load = useCallback(async () => apply(await clockStatusAction()), [apply]);

  // First load when the server did not render today (e.g. the top-bar popover).
  useEffect(() => {
    if (initial) return;
    let alive = true;
    clockStatusAction().then((res) => {
      if (alive) apply(res);
    });
    return () => {
      alive = false;
    };
  }, [initial, apply]);

  const busy = phase.kind === "locating" || phase.kind === "sending";

  const send = async (remote: boolean, location: Located) => {
    setPhase({ kind: "sending" });
    const res = await clockAction({ location, remote, reason: remote ? reason : undefined });
    if (!res.success) {
      setPhase({ kind: "error", text: res.validationErrors?.reason ?? res.error });
      return;
    }
    const r = res.data;
    if (r.outcome === "remote_needed") {
      setPhase({ kind: "outside", reason: r.message, location });
      return;
    }
    setReason("");
    setPhase({ kind: "done", text: r.message, tone: r.outcome === "punch" ? "success" : "warning" });
    await load();
    router.refresh();
  };

  const clock = async () => {
    if (!status) return;
    let location: Located = null;
    if (status.wantsLocation) {
      setPhase({ kind: "locating" });
      location = await locate();
    }
    await send(false, location);
  };

  if (loadError) {
    return (
      <div className={cn("rounded-lg border border-line bg-surface p-4 text-xs text-ink-muted", compact && "border-0 p-0")}>
        <p className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /> {loadError}
        </p>
      </div>
    );
  }
  if (!status) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-line bg-surface p-4 text-xs text-ink-muted", compact && "border-0 p-0")}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading today…
      </div>
    );
  }

  const isIn = status.next === "out";
  const lastPunch = status.punches[status.punches.length - 1];
  const statusText = status.lastOut && !isIn ? `Out at ${localClock(status.lastOut)}` : isIn && lastPunch ? `In since ${localClock(status.firstIn ?? lastPunch.at)}` : status.waiting.some((w) => w.status === "pending") ? "Waiting for approval" : "Not in yet";
  const pending = status.waiting.filter((w) => w.status === "pending");

  return (
    <section aria-label="Clock in" className={cn("rounded-lg border border-line bg-surface text-xs", compact ? "border-0" : "p-4")}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-2xs text-ink-muted">{dateText(status.today, "long")}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span className={cn("h-2 w-2 rounded-full", isIn ? "bg-success" : pending.length ? "bg-warning" : "bg-ink-faint")} aria-hidden />
            {statusText}
          </p>
        </div>
        {status.shift && (
          <span className="rounded bg-surface-sunken px-2 py-1 text-2xs text-ink-muted" title={status.shift.name}>
            <span className="font-semibold text-ink">{status.shift.code}</span> {status.shift.off ? "day off" : `${status.shift.start}–${status.shift.end}`}
          </span>
        )}
      </header>

      <dl className="mt-3 grid grid-cols-3 divide-x divide-line border-y border-line py-2">
        {[
          ["In", localClock(status.firstIn) || "—"],
          ["Out", status.lastOut && !isIn ? localClock(status.lastOut) : "—"],
          ["Worked", status.workMinutes ? hoursText(status.workMinutes) : "—"],
        ].map(([k, v]) => (
          <div key={k} className="px-3 first:pl-0">
            <dt className="text-3xs uppercase tracking-wide text-ink-muted">{k}</dt>
            <dd className="text-base font-semibold tabular-nums text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {!status.available ? (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-surface-sunken px-3 py-2 text-ink-muted">
          <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {status.unavailableReason}
        </p>
      ) : phase.kind === "outside" ? (
        <div className="mt-3 space-y-2 rounded-md border border-warning/40 bg-warning-subtle px-3 py-2.5">
          <p className="flex items-start gap-2 text-ink">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span>
              {phase.reason} You can send this clock-{status.next} for approval: it counts once your supervisor approves it.
            </span>
          </p>
          <input
            autoFocus
            aria-label="Reason for clocking in outside the office"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason, e.g. Client visit at Lalitpur"
            className="h-8 w-full rounded-md border border-line-input bg-surface px-2.5 text-xs text-ink outline-none focus:border-brand"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => send(true, phase.location)} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-white hover:bg-brand-hover disabled:pointer-events-none disabled:opacity-50">
              <Send className="h-3.5 w-3.5" /> Send for approval
            </button>
            <button type="button" disabled={busy} onClick={() => setPhase({ kind: "idle" })} className="inline-flex h-8 cursor-pointer items-center rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clock}
            disabled={busy}
            className={cn(
              "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60",
              isIn ? "border border-line bg-surface text-ink hover:bg-surface-sunken" : "bg-brand text-white hover:bg-brand-hover"
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isIn ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {phase.kind === "locating" ? "Finding your location…" : phase.kind === "sending" ? "Saving…" : isIn ? "Clock out" : "Clock in"}
          </button>
          {status.wantsLocation && phase.kind === "idle" && (
            <span className="inline-flex items-center gap-1 text-2xs text-ink-muted">
              <MapPin className="h-3 w-3" /> Your location is checked
            </span>
          )}
        </div>
      )}

      {phase.kind === "done" && (
        <p role="status" className={cn("mt-2 flex items-start gap-1.5", phase.tone === "success" ? "text-success" : "text-warning")}>
          {phase.tone === "success" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Hourglass className="mt-0.5 h-3.5 w-3.5 shrink-0" />} {phase.text}
        </p>
      )}
      {phase.kind === "error" && (
        <p role="alert" className="mt-2 text-danger">
          {phase.text}
        </p>
      )}

      {(status.punches.length > 0 || status.waiting.length > 0) && (
        <ul className="mt-3 space-y-1 border-t border-line pt-2" aria-label="Today's entries">
          {[
            ...status.punches.map((p) => ({ at: p.at, text: `${p.kind === "out" ? "Out" : p.kind === "in" ? "In" : "Punch"} · ${SOURCE[p.source] ?? p.source}`, tone: "" })),
            ...status.waiting.map((w) => ({
              at: w.at,
              text: `${w.kind === "remote_in" ? "In" : "Out"} outside the office · ${w.status === "pending" ? "waiting for approval" : w.status === "rejected" ? "not approved" : w.status}`,
              tone: w.status === "pending" ? "text-warning" : w.status === "rejected" ? "text-danger" : "",
            })),
          ]
            .sort((a, b) => a.at.localeCompare(b.at))
            .map((e) => (
              <li key={`${e.at}-${e.text}`} className="flex gap-2">
                <span className="w-11 shrink-0 tabular-nums font-medium text-ink">{localClock(e.at)}</span>
                <span className={cn("text-ink-muted", e.tone)}>{e.text}</span>
              </li>
            ))}
        </ul>
      )}

      {status.wantsLocation && (
        <p className="mt-3 text-3xs leading-relaxed text-ink-faint">
          Your location is read only when you press the button, kept with that entry, and seen only by HR and your approver (Privacy Act 2075). It is never tracked otherwise.
        </p>
      )}
    </section>
  );
}
