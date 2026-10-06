"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoticeTone = "success" | "info" | "warning" | "danger";

const TONE: Record<NoticeTone, { box: string; icon: string; Icon: LucideIcon; role: "status" | "alert" }> = {
  success: { box: "border-success/30 bg-success-subtle", icon: "text-success", Icon: CheckCircle2, role: "status" },
  info: { box: "border-info/30 bg-info-subtle", icon: "text-info", Icon: Info, role: "status" },
  warning: { box: "border-warning/30 bg-warning-subtle", icon: "text-warning", Icon: AlertTriangle, role: "status" },
  danger: { box: "border-danger/30 bg-danger-subtle", icon: "text-danger", Icon: XCircle, role: "alert" },
};

/**
 * One notice for a page or tab (3.6 pattern): a done message, something to
 * know, something to do, or what went wrong. Tone is never the only signal:
 * there is always an icon and words. An optional title, an action on the
 * right (a button or link) and Dismiss.
 */
export function Notice({
  tone,
  title,
  children,
  action,
  onDismiss,
  className,
}: {
  tone: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div role={t.role} className={cn("flex flex-wrap items-start gap-x-2.5 gap-y-2 rounded-md border px-3 py-2 text-xs text-ink", t.box, className)}>
      <t.Icon aria-hidden className={cn("mt-px h-3.5 w-3.5 shrink-0", t.icon)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5 text-ink-muted")}>{children}</div>}
      </div>
      {(action || onDismiss) && (
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {onDismiss && (
            <button type="button" className="cursor-pointer text-2xs font-medium text-ink-muted hover:text-ink" onClick={onDismiss}>
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
