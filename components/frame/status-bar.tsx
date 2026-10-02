"use client";

import { useEffect, useState } from "react";
import { Building2, Lock, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import type { WorkspaceContext } from "@/lib/services/workspace-context.service";
import { adToBS, BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { cn } from "@/lib/utils";
import { useFrame } from "./frame-context";

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** Today in BS and AD, computed on the client only (avoids SSR/locale drift). */
function useToday(): { bs: string; ad: string } | null {
  const [today, setToday] = useState<{ bs: string; ad: string } | null>(null);
  useEffect(() => {
    const compute = () => {
      const now = new Date();
      const bs = adToBS(now);
      setToday({
        bs: `${bs.day} ${BS_MONTHS_EN[bs.month]} ${bs.year}`,
        ad: now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      });
    };
    compute();
    const timer = window.setInterval(compute, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return today;
}

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

/** Status bar (2.4): connection, company, fiscal year, today, role, version. */
export function StatusBar({ context }: { context?: WorkspaceContext }) {
  const online = useOnline();
  const today = useToday();
  const { lockCountdown } = useFrame();

  const sep = <span aria-hidden className="h-3 w-px bg-line-strong" />;

  return (
    <footer
      role="contentinfo"
      className="flex h-6.5 shrink-0 items-center gap-2.5 overflow-hidden border-t border-line bg-rail px-3 text-2xs text-ink-muted print:hidden"
    >
      <span className={cn("flex items-center gap-1", online ? "text-success" : "text-warning")} aria-live="polite">
        {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        {online ? "Connected" : "Offline"}
      </span>

      {context && (
        <>
          {sep}
          <span className="hidden min-w-0 items-center gap-1 truncate sm:flex">
            <Building2 className="h-3 w-3 shrink-0 text-ink-faint" />
            <span className="truncate">
              {context.company.name} <span className="text-ink-faint">({context.company.code})</span> · {context.company.branch}
            </span>
          </span>
          <span className="hidden md:contents">
            {sep}
            <span className="whitespace-nowrap">{context.activeFiscalYear.name}</span>
          </span>
        </>
      )}

      <span className="ml-auto flex items-center gap-2.5 whitespace-nowrap">
        {lockCountdown !== null && (
          <span className="flex items-center gap-1 rounded bg-warning-subtle px-1.5 font-medium text-warning" role="status">
            <Lock className="h-3 w-3" />
            Locking in {Math.floor(lockCountdown / 60)}:{String(lockCountdown % 60).padStart(2, "0")} — move the mouse to stay signed in
          </span>
        )}
        {context?.isImpersonating && (
          <span className="flex items-center gap-1 font-medium text-warning">
            <ShieldCheck className="h-3 w-3" /> Super-admin view
          </span>
        )}
        {today && (
          <span className="tabular-nums" title={today.ad}>
            {today.bs} BS<span className="hidden text-ink-faint lg:inline"> · {today.ad}</span>
          </span>
        )}
        {context?.user.role && (
          <span className="hidden lg:contents">
            {sep}
            <span>{context.user.role}</span>
          </span>
        )}
        {APP_VERSION && (
          <span className="hidden xl:contents">
            {sep}
            <span className="text-ink-faint">v{APP_VERSION}</span>
          </span>
        )}
      </span>
    </footer>
  );
}
