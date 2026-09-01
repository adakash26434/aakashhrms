/**
 * Pure audit engine for security sanitization, diff computation, and record title formatting.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // Fallback for UUID record IDs
  return `${module} #${recordId.substring(0, 8)}`;
}
