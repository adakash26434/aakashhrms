"use client";

import { useState } from "react";
import { Megaphone, Pin } from "lucide-react";
import type { BoardNotice } from "@/lib/types/notice";
import { cn } from "@/lib/utils";

/** The employee's notice board (G12/G14): pinned first; a notice unfolds when tapped. */
export function EssNoticeBoard({ notices, title, empty, compact = false }: { notices: BoardNotice[]; title: string; empty: string; compact?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(notices[0]?.pinned ? notices[0].id : null);
  return (
    <section aria-label={title} className="min-w-0 border-b border-payroll-border pb-6 sm:rounded-xl sm:border sm:border-payroll-border sm:bg-white sm:p-6 sm:shadow-payroll-xs">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-payroll-primary" />
        <h2 className="text-base font-semibold text-payroll-navy">{title}</h2>
      </div>
      {notices.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-payroll-border/70">
          {(compact ? notices.slice(0, 5) : notices).map((n) => {
            const open = openId === n.id || !compact;
            return (
              <li key={n.id} className="py-2.5">
                <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => setOpenId(open && compact ? null : n.id)} aria-expanded={open}>
                  {n.pinned ? <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-payroll-primary" aria-label="Pinned" /> : <span className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-payroll-navy">{n.title}</span>
                    <span className="ml-2 text-2xs text-zinc-500">
                      {n.publishAd}
                      {n.branch ? ` · ${n.branch}` : ""}
                    </span>
                    <span className={cn("mt-1 block whitespace-pre-wrap text-xs leading-relaxed text-zinc-600", !open && "line-clamp-2")}>{n.body}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
