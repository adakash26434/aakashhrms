// Approvals (4.4 follow-up, Zoho Payroll style): a company policy per module
// (salary changes now; pay runs 4.8, loans 4.10 later), a flow copied onto
// each request when it is submitted, and a timeline of every step.

/** How requests of a module get approved (company setting). Custom rules come with 4.12. */
export type ApprovalType = "none" | "simple" | "multi_level";

export interface ApprovalPolicy {
  type: ApprovalType;
  /** Multi-level: the approvers in order (user ids), Level 1 first. */
  levels: string[];
}

/** Why a level was passed over when the request was submitted. */
export type SkipReason = "preparer" | "own_salary";

export interface FlowLevel {
  level: number;
  userId: string;
  skipped?: SkipReason | null;
}

/** The flow fixed on a request at submission (later setting changes do not touch it). */
export interface ApprovalFlow {
  /** simple: any approver; multi_level: the levels in order. */
  type: "simple" | "multi_level";
  levels: FlowLevel[];
  /** Multi-level fell back to simple because every level was skipped. */
  fellBack?: boolean;
}

/** How an approved request got approved (kept on the request for audit and review). */
export type ApprovalRoute = "simple" | "levels" | "final_approve" | "not_required" | "on_hire" | "policy";

export type ApprovalActionKind = "submitted" | "approved" | "final_approved" | "rejected" | "withdrawn" | "skipped" | "not_required";

/** One step in a request's timeline. */
export interface ApprovalTimelineEntry {
  id: string;
  level: number;
  action: ApprovalActionKind;
  actorId: string | null;
  actorName: string;
  onBehalfOfName: string | null;
  note: string | null;
  at: string;
}

/** A user who can approve (for the settings picker, routing and "on behalf of"). */
export interface ApproverInfo {
  userId: string;
  name: string;
  /** Linked employee record (null: not linked, so their own salary cannot be recognised). */
  employeeId: string | null;
  active: boolean;
  canApprove: boolean;
  /** Approvals delegated to this user until a date (ISO), while away. */
  delegatedTo: string | null;
  delegatedUntil: string | null;
}

/** What the current user may do with a pending request, or why not. */
export interface AvailableActions {
  /** Approve the current level (or, simple, the request); onBehalfOf when acting as a delegate. */
  approve: { level: number; onBehalfOf: string | null } | null;
  finalApprove: boolean;
  reject: boolean;
  withdraw: boolean;
  /** Plain reason when the user cannot approve. */
  reason: string | null;
  /** The request cannot move: its current approver can no longer approve. */
  stuck: string | null;
}
