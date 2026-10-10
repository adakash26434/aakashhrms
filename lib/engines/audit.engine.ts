/**
 * Pure audit engine for security sanitization, diff computation, and record title formatting.
 * 4.13: the words the Audit log screen uses (actions, modules, results, addresses, periods) and
 * the before → after rows of one entry.
 */

import { moduleLabel } from "./role.engine";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Words (4.13)
// ---------------------------------------------------------------------------

const ACTION_WORD: Record<string, string> = {
  VIEW: "Viewed",
  ADD: "Added",
  EDIT: "Changed",
  DELETE: "Deleted",
  APPROVE: "Approved",
  EXPORT: "Exported",
  LOCK: "Locked",
};

export const auditActionLabel = (action: string): string => ACTION_WORD[action] ?? action;

export const auditModuleLabel = (module: string): string => moduleLabel(module);

/** A refused attempt (no permission, outside the scope, the person's own record …). */
export const isRefusal = (result: string | null | undefined): boolean => !!result && result.startsWith("DENIED");

export function auditResultLabel(result: string | null | undefined): string {
  if (!result || result === "SUCCESS") return "Done";
  if (result === "DENIED_PERMISSION") return "Refused: no permission";
  if (result === "DENIED_SCOPE") return "Refused: outside their branches or departments";
  if (result.startsWith("DENIED_SELF")) return "Refused: their own record";
  if (result.startsWith("DENIED")) return "Refused";
  if (result === "FAILURE") return "Failed";
  return result.charAt(0) + result.slice(1).toLowerCase().replace(/_/g, " ");
}

/**
 * The client address an entry recorded, or null when it has none (S59): entries made outside a
 * request (scheduled jobs, scripts) and every entry from before 4.13 have none — the screens say
 * "Not recorded" and never make one up.
 */
export function addressText(ip: string | null | undefined): string | null {
  const value = (ip ?? "").trim();
  return !value || value === "unknown" ? null : value;
}

export const AUDIT_PERIODS = [
  { value: "today", label: "Today", days: 1 },
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "365d", label: "Last 12 months", days: 365 },
  { value: "all", label: "All time", days: 0 },
] as const;

export type AuditPeriod = (typeof AUDIT_PERIODS)[number]["value"];

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000;

/** Where a period starts: Kathmandu midnight, `days - 1` days before today (null: all time). */
export function periodStart(period: AuditPeriod, now: Date = new Date()): Date | null {
  const def = AUDIT_PERIODS.find((p) => p.value === period);
  if (!def || !def.days) return null;
  const local = new Date(now.getTime() + NEPAL_OFFSET_MS);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - NEPAL_OFFSET_MS;
  return new Date(midnight - (def.days - 1) * 86_400_000);
}

export type AuditOutcome = "" | "done" | "refused";

export interface AuditFilter {
  period: AuditPeriod;
  module: string;
  action: string;
  outcome: AuditOutcome;
  userId: string;
  search: string;
}

export const DEFAULT_AUDIT_FILTER: AuditFilter = { period: "30d", module: "", action: "", outcome: "", userId: "", search: "" };

/** The filter as sent (from the URL or the screen): anything unknown falls back to "all". */
export function normalizeAuditFilter(raw: unknown, known: { modules: readonly string[]; userIds?: readonly string[] }): AuditFilter {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const period = str(r.period) as AuditPeriod;
  const moduleKey = str(r.module);
  const action = str(r.action);
  const outcome = str(r.outcome) as AuditOutcome;
  const userId = str(r.userId);
  return {
    period: AUDIT_PERIODS.some((p) => p.value === period) ? period : DEFAULT_AUDIT_FILTER.period,
    module: known.modules.includes(moduleKey) ? moduleKey : "",
    action: ACTION_WORD[action] ? action : "",
    outcome: outcome === "done" || outcome === "refused" ? outcome : "",
    userId: UUID_REGEX.test(userId) && (!known.userIds || known.userIds.includes(userId)) ? userId : "",
    search: str(r.search).slice(0, 100),
  };
}

/** "roleName" → "Role name", "grade_amount" → "Grade amount". */
export function fieldLabel(key: string): string {
  const words = key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One stored value in words. */
export function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map(valueText).join(", ") : "None";
  if (typeof value === "object") {
    const text = JSON.stringify(value);
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  }
  return String(value);
}

export interface AuditDiffRow {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
}

/**
 * The rows of one entry's change: every field that differs, before → after (only "after" for an
 * addition, only "before" for a deletion). Ids, secrets and timestamps are left out
 * (`sanitizeAuditValues`).
 */
export function diffRows(oldValues: Record<string, unknown> | null, newValues: Record<string, unknown> | null): AuditDiffRow[] {
  const { oldDiff, newDiff } = computeSanitizedDiff(oldValues, newValues);
  const keys = [...new Set([...Object.keys(oldDiff ?? {}), ...Object.keys(newDiff ?? {})])];
  return keys.map((key) => ({
    field: key,
    label: fieldLabel(key),
    before: oldDiff && key in oldDiff ? valueText(oldDiff[key]) : null,
    after: newDiff && key in newDiff ? valueText(newDiff[key]) : null,
  }));
}

/**
 * Evaluates whether a key-value pair contains internal metadata, security risks, or raw database IDs.
 */
function isSecurityRiskOrInternalKey(key: string, value: unknown): boolean {
  const lowerKey = key.toLowerCase();

  // 1. Password / Secret / Token / Security hash fields
  if (
    lowerKey.includes("password") ||
    lowerKey.includes("secret") ||
    lowerKey.includes("token") ||
    lowerKey.includes("hash") ||
    lowerKey.includes("salt") ||
    lowerKey.includes("private_key") ||
    lowerKey.includes("api_key") ||
    lowerKey === "key"
  ) {
    return true;
  }

  // 2. Any field ending with 'id', 'ids', '_id', '_ids' (e.g. employeeId, fiscalYearId, employeeIds, branchIds)
  if (
    lowerKey === "id" ||
    lowerKey.endsWith("id") ||
    lowerKey.endsWith("ids") ||
    lowerKey.endsWith("_id") ||
    lowerKey.endsWith("_ids")
  ) {
    return true;
  }

  // 3. User references or actor tracking fields (e.g. generatedBy, reviewedBy, approvedBy, createdBy, updatedBy)
  if (
    lowerKey.endsWith("by") ||
    lowerKey.endsWith("_by")
  ) {
    return true;
  }

  // 4. System timestamp fields (e.g. generatedAt, reviewedAt, lockedAt, createdAt, updatedAt, deletedAt, lastLoginAt)
  if (
    lowerKey.endsWith("_at") ||
    lowerKey.endsWith("createdat") ||
    lowerKey.endsWith("updatedat") ||
    lowerKey.endsWith("deletedat") ||
    lowerKey.endsWith("generatedat") ||
    lowerKey.endsWith("reviewedat") ||
    lowerKey.endsWith("approvedat") ||
    lowerKey.endsWith("lockedat") ||
    lowerKey.endsWith("loginat")
  ) {
    return true;
  }

  // 5. Value is a raw UUID string
  if (typeof value === "string" && UUID_REGEX.test(value)) {
    return true;
  }

  // 6. Value is an array containing UUID strings
  if (Array.isArray(value) && value.some((v) => typeof v === "string" && UUID_REGEX.test(v))) {
    return true;
  }

  return false;
}

/**
 * Sanitizes raw database objects by stripping internal/sensitive system keys and IDs.
 */
export function sanitizeAuditValues(
  obj: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!obj || typeof obj !== "object") return null;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!isSecurityRiskOrInternalKey(key, value) && value !== undefined) {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Computes a sanitized diff containing ONLY the business fields that changed between old & new states.
 */
export function computeSanitizedDiff(
  oldVals: Record<string, unknown> | null,
  newVals: Record<string, unknown> | null
): {
  oldDiff: Record<string, unknown> | null;
  newDiff: Record<string, unknown> | null;
} {
  const cleanOld = sanitizeAuditValues(oldVals) || {};
  const cleanNew = sanitizeAuditValues(newVals) || {};

  // If one of them is missing (e.g. ADD or DELETE action), return the sanitized object directly
  if (!oldVals) return { oldDiff: null, newDiff: Object.keys(cleanNew).length > 0 ? cleanNew : null };
  if (!newVals) return { oldDiff: Object.keys(cleanOld).length > 0 ? cleanOld : null, newDiff: null };

  const oldDiff: Record<string, unknown> = {};
  const newDiff: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(cleanOld), ...Object.keys(cleanNew)]);

  for (const key of allKeys) {
    const valOld = cleanOld[key];
    const valNew = cleanNew[key];

    if (JSON.stringify(valOld) !== JSON.stringify(valNew)) {
      if (valOld !== undefined) oldDiff[key] = valOld;
      if (valNew !== undefined) newDiff[key] = valNew;
    }
  }

  return {
    oldDiff: Object.keys(oldDiff).length > 0 ? oldDiff : null,
    newDiff: Object.keys(newDiff).length > 0 ? newDiff : null,
  };
}

/**
 * Formats a timestamp in Nepal Standard Time (Asia/Kathmandu - UTC+05:45).
 */
export function formatAuditTimestamp(date: Date | string | null | undefined): string {
  if (!date) return "—";

  let d: Date;

  if (date instanceof Date) {
    d = date;
  } else if (typeof date === "string") {
    let dateStr = date.trim();
    if (!dateStr.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(dateStr)) {
      dateStr = dateStr.replace(" ", "T") + "Z";
    }
    d = new Date(dateStr);
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) return "—";

  try {
    return d.toLocaleString("en-US", {
      timeZone: "Asia/Kathmandu",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    });
  }
}

/**
 * Formats a human-readable title for the RECORD column (e.g., "Normal Single — 0 to 500,000").
 */
export function formatRecordTitle(
  recordId: string | null,
  module: string,
  newValues?: Record<string, unknown> | null,
  oldValues?: Record<string, unknown> | null
): string {
  if (!recordId) return "—";

  const vals = (newValues || oldValues || {}) as Record<string, unknown>;

  // Check common human-readable fields
  if (vals.title) return String(vals.title);
  if (vals.name) return String(vals.name);
  if (vals.code && vals.name) return `${vals.code} — ${vals.name}`;
  if (vals.firstName && vals.lastName) return `${vals.firstName} ${vals.lastName}`;
  if (vals.runName) return String(vals.runName);
  if (vals.slabName) return String(vals.slabName);

  // If recordId is non-UUID text (e.g. "Normal Single — 0 to 500,000" or "Magh 2082 Payroll Run"), use it directly
  const isUuid = UUID_REGEX.test(recordId);
  if (!isUuid) return recordId;

  // Fallback for UUID record IDs: the module's name and the id's first characters.
  return `${moduleLabel(module)} #${recordId.substring(0, 8)}`;
}
