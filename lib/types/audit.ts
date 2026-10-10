import type { AuditDiffRow, AuditFilter } from "@/lib/engines/audit.engine";

// Admin → Audit log (4.13): who did what, as which role, when and from where.

export type AuditResult = "SUCCESS" | "DENIED_PERMISSION" | "DENIED_SCOPE" | "DENIED_SELF";
export type ActionType = "VIEW" | "ADD" | "EDIT" | "DELETE" | "APPROVE" | "EXPORT" | "LOCK";

/** One entry as the list shows it. */
export interface AuditRow {
  id: string;
  /** ISO time. */
  at: string;
  userId: string | null;
  /** The person's name or email; "System" for entries with no user (scheduled jobs). */
  who: string;
  email: string | null;
  /** The role they held when they acted (null: not recorded). */
  role: string | null;
  action: string;
  actionLabel: string;
  module: string;
  moduleLabel: string;
  record: string;
  result: string;
  resultLabel: string;
  refused: boolean;
  /** The client address, or null: "Not recorded" (never made up, S59). */
  address: string | null;
}

/** One entry with what changed (the detail pane). */
export interface AuditEntryDetail extends AuditRow {
  recordId: string | null;
  changes: AuditDiffRow[];
}

export interface AuditPage {
  filter: AuditFilter;
  rows: AuditRow[];
  /** How many entries match the filter in all (rows holds the newest of them). */
  total: number;
  refused: number;
  periods: { value: string; label: string }[];
  modules: { value: string; label: string }[];
  users: { id: string; label: string }[];
  can: { export: boolean };
}
