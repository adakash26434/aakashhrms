"use client";

import { useState } from "react";
import { Megaphone, Pin } from "lucide-react";
import { Panel } from "@/components/kit/panel";
import { DateCell } from "@/components/kit/date-cell";
import type { BoardNotice } from "@/lib/types/notice";
import { cn } from "@/lib/utils";

/** Notice board on Home (G14): pinned first; long notices fold until opened. */
export function DashboardNoticeBoard({ notices }: { notices: BoardNotice[] }) {
  const [openId, setOpenId] = useState<string | null>(notices[0]?.pinned ? notices[0].id : null);
  return (
    <Panel level={3} id="dashboard-notices" title="Notice board" icon={<Megaphone />} count={notices.length} className="mb-4">
      <ul className="divide-y divide-line">
        {notices.map((n) => {
          const open = openId === n.id;
          return (
            <li key={n.id} className="px-4 py-2.5">
              <button type="button" className="flex w-full items-start gap-2 text-left cursor-pointer" onClick={() => setOpenId(open ? null : n.id)} aria-expanded={open}>
                {n.pinned ? <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-label="Pinned" /> : <span className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span className="flex-1">
                  <span className="text-sm font-medium text-ink">{n.title}</span>
                  <span className="ml-2 text-2xs text-ink-faint">
                    <DateCell value={n.publishAd} />
                    {n.branch ? ` · ${n.branch}` : ""}
                  </span>
                  <span className={cn("mt-1 block whitespace-pre-wrap text-xs text-ink-muted", !open && "line-clamp-2")}>{n.body}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
