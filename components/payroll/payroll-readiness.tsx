"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { PreflightFinding } from "@/lib/engines/payroll-control.engine";

// Payroll controls (4.8 / F1): what the server found when the run was checked.
// Blockers stop the run; warnings are shown and the run can go ahead.

export function PayrollReadiness({ findings }: { findings: PreflightFinding[] | null }) {
  if (!findings) return null;
  if (!findings.length) {
    return (
      <div role="status" className="flex items-center gap-2 rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-xs text-ink">
        <CheckCircle2 aria-hidden className="h-3.5 w-3.5 text-success" /> Readiness: nothing to fix for this month and scope.
      </div>
    );
  }
  return (
    <div role="status" className="space-y-2 rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink">
      <p className="font-semibold">Readiness</p>
      <ul className="space-y-2">
        {findings.map((f) => {
          const blocker = f.severity === 'blocker';
          const Icon = blocker ? XCircle : AlertTriangle;
          return (
            <li key={f.code} className="flex items-start gap-2">
              <Icon aria-hidden className={`mt-px h-3.5 w-3.5 shrink-0 ${blocker ? "text-danger" : "text-warning"}`} />
              <div>
                <p>
                  <span className="font-semibold">{blocker ? "Blocker: " : "Warning: "}</span>
                  {f.title}
                </p>
                {f.people.length > 0 && (
                  <p className="text-ink-muted">
                    {f.people.slice(0, 8).join(", ")}
                    {f.people.length > 8 ? ` and ${f.people.length - 8} more` : ""}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
