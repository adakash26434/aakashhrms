import type { DetailApproval, DetailLine, DetailStatus } from "@/lib/engines/employee-detail.engine";
import type { CheckerMode } from "@/lib/engines/payroll-control.engine";
import type { ApprovalTimelineEntry } from "@/lib/types/approval";

// Sensitive employee details (4.8 / F13): changes to bank, PAN and tax status as screens see them.

export interface DetailChangeView {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  status: DetailStatus;
  /** "Bank account and PAN". */
  summary: string;
  /** Changed fields, before → after (account numbers and PAN masked unless the viewer may see them). */
  lines: DetailLine[];
  reason: string;
  preparedBy: string;
  preparedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** How an approved change got approved: simple (a second person), final_approve (an administrator), not_required (approvals off). */
  route: string | null;
  timeline: ApprovalTimelineEntry[];
  /** What the viewer may do now, and why not. */
  can: { approve: boolean; reject: boolean; withdraw: boolean; reason: string | null };
  /** It waits for the viewer (the bell, the register's count). */
  waitingForMe: boolean;
}

export interface DetailChangesPage {
  rows: DetailChangeView[];
  /** Account numbers and PAN in full (Employees → Edit or Approve). */
  reveal: boolean;
  approval: DetailApproval;
  checker: CheckerMode;
}

/** The employee form (F13): a change already waiting, and what saving a change to these details does. */
export interface DetailFormInfo {
  pending: Pick<DetailChangeView, "id" | "summary" | "lines" | "preparedBy" | "preparedAt" | "reason"> | null;
  /** wait: a second person approves · wait_own: the user's own record · apply_admin / apply_off: it applies with the save. */
  onSave: "wait" | "wait_own" | "apply_admin" | "apply_off";
}

/** What a save did with changes to these details (the form's closing notice). */
export interface DetailSaveResult {
  id: string;
  /** Field names changed (never values). */
  fields: string[];
  summary: string;
  status: "pending" | "approved";
  route: "not_required" | "final_approve" | null;
  /** Draft payslips that took the new bank details. */
  draftSlips: number;
}

export interface DetailDecisionResult {
  id: string;
  employeeId: string;
  employeeName: string;
  status: DetailStatus;
  fields: string[];
  summary: string;
  draftSlips: number;
  /** Runs past draft that still pay the old account ("Kartik 2083 · under review"). */
  runsInReview: string[];
}
