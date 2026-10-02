// Fixed status vocabulary (roadmap 3.6). Every screen maps its raw states
// (DRAFT, UNDER_REVIEW, Pending, …) onto these, so a status looks the same
// everywhere and is never conveyed by colour alone (each has a label + icon).

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger" | "brand";

export type StatusKey =
  | "draft"
  | "pending"
  | "review"
  | "approved"
  | "locked"
  | "paid"
  | "rejected"
  | "cancelled"
  | "active"
  | "inactive"
  | "onHold"
  | "error";

export interface StatusDef {
  label: string;
  tone: StatusTone;
  icon: "circle-dashed" | "clock" | "eye" | "check" | "lock" | "banknote" | "x" | "ban" | "dot" | "pause" | "alert";
}

export const STATUS_VOCABULARY: Record<StatusKey, StatusDef> = {
  draft: { label: "Draft", tone: "neutral", icon: "circle-dashed" },
  pending: { label: "Pending", tone: "warning", icon: "clock" },
  review: { label: "In review", tone: "info", icon: "eye" },
  approved: { label: "Approved", tone: "success", icon: "check" },
  locked: { label: "Locked", tone: "brand", icon: "lock" },
  paid: { label: "Paid", tone: "success", icon: "banknote" },
  rejected: { label: "Rejected", tone: "danger", icon: "x" },
  cancelled: { label: "Cancelled", tone: "neutral", icon: "ban" },
  active: { label: "Active", tone: "success", icon: "dot" },
  inactive: { label: "Inactive", tone: "neutral", icon: "dot" },
  onHold: { label: "On hold", tone: "warning", icon: "pause" },
  error: { label: "Error", tone: "danger", icon: "alert" },
};

const ALIASES: Record<string, StatusKey> = {
  draft: "draft",
  new: "draft",
  pending: "pending",
  submitted: "pending",
  awaiting: "pending",
  underreview: "review",
  inreview: "review",
  review: "review",
  calculated: "review",
  approved: "approved",
  verified: "approved",
  locked: "locked",
  closed: "locked",
  finalized: "locked",
  paid: "paid",
  disbursed: "paid",
  settled: "paid",
  rejected: "rejected",
  declined: "rejected",
  denied: "rejected",
  cancelled: "cancelled",
  canceled: "cancelled",
  withdrawn: "cancelled",
  active: "active",
  enabled: "active",
  running: "active",
  inactive: "inactive",
  disabled: "inactive",
  terminated: "inactive",
  resigned: "inactive",
  onhold: "onHold",
  hold: "onHold",
  suspended: "onHold",
  error: "error",
  failed: "error",
};

/** Maps any raw status string onto the vocabulary (null when unknown). */
export function resolveStatus(raw: string | null | undefined): StatusKey | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[\s_-]+/g, "");
  return ALIASES[key] ?? null;
}
