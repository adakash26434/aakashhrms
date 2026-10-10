// Roles and the permission matrix (4.13): what a role can hold, in words. Pure: no database
// access, safe in the browser and in tests (tests/role.engine.test.ts).
//
// A permission is an action on a module, kept as the key "ACTION:MODULE". The matrix offers
// only the actions each module lists in MODULE_CATEGORIES (View on every module; Lock only where
// something is locked); anything else a browser sends is dropped.

import { EMPLOYEE_SELF_SERVICE_GRANTS, ROLE_PERMISSION_PRESETS } from "@/lib/constants/role-presets";
import { MODULE_CATEGORIES, type ActionType, type ModuleType, type ScopeType } from "@/lib/types/role";

export const ACTIONS: readonly ActionType[] = ["VIEW", "ADD", "EDIT", "DELETE", "APPROVE", "EXPORT", "LOCK"];

export const ACTION_LABEL: Record<ActionType, string> = {
  VIEW: "View",
  ADD: "Add",
  EDIT: "Edit",
  DELETE: "Delete",
  APPROVE: "Approve",
  EXPORT: "Export",
  LOCK: "Lock",
};

export const SCOPES: readonly ScopeType[] = ["GLOBAL", "BRANCH", "DEPARTMENT", "SELF"];

/** What a role's scope covers, short (lists and chips). */
export const SCOPE_LABEL: Record<ScopeType, string> = {
  GLOBAL: "Company-wide",
  BRANCH: "Chosen branches",
  DEPARTMENT: "Chosen departments",
  SELF: "Own records",
};

/** What a role's scope covers, in a sentence (the role window). */
export const SCOPE_HINT: Record<ScopeType, string> = {
  GLOBAL: "Every branch and department.",
  BRANCH: "Only the branches chosen on each login with this role.",
  DEPARTMENT: "Only the departments chosen on each login with this role.",
  SELF: "Only the person's own records (self-service).",
};

export const grantKey = (action: string, module: string): string => `${action}:${module}`;

export function splitGrant(key: string): { action: ActionType; module: ModuleType } {
  const i = key.indexOf(":");
  return { action: key.slice(0, i) as ActionType, module: key.slice(i + 1) as ModuleType };
}

const MODULES = MODULE_CATEGORIES.flatMap((c) => c.modules);
const MODULE_ORDER = new Map<string, number>(MODULES.map((m, i) => [m.key, i]));
const ACTION_ORDER = new Map<string, number>(ACTIONS.map((a, i) => [a, i]));

/** Module names as the matrix shows them (retired modules keep a readable name for history). */
export const MODULE_LABEL: Readonly<Record<string, string>> = {
  ...Object.fromEntries(MODULES.map((m) => [m.key, m.label])),
  LEAVE_RULES: "Leave rules (retired)",
};

export function moduleLabel(module: string): string {
  if (MODULE_LABEL[module]) return MODULE_LABEL[module];
  const text = module.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Every permission the matrix offers. */
export const GRANTABLE: ReadonlySet<string> = new Set(MODULES.flatMap((m) => m.allowedActions.map((a) => grantKey(a, m.key))));

/** "Payroll Review & Slip Overrides → Approve". */
export function grantLabel(key: string): string {
  const { action, module } = splitGrant(key);
  return `${moduleLabel(module)} → ${ACTION_LABEL[action] ?? action}`;
}

/** Matrix order: modules as the matrix lists them, actions View → Lock. */
export function sortGrants(keys: Iterable<string>): string[] {
  return [...new Set(keys)].sort((a, b) => {
    const x = splitGrant(a);
    const y = splitGrant(b);
    const m = (MODULE_ORDER.get(x.module) ?? 999) - (MODULE_ORDER.get(y.module) ?? 999);
    return m || (ACTION_ORDER.get(x.action) ?? 9) - (ACTION_ORDER.get(y.action) ?? 9) || a.localeCompare(b);
  });
}

/**
 * A role's permissions as sent: only what the matrix offers, View added wherever another action
 * on the module is (an action on a module nobody can open means nothing), in matrix order.
 */
export function normalizeGrants(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const value of raw.slice(0, 1000)) {
    const key = typeof value === "string" ? value : "";
    if (GRANTABLE.has(key)) out.add(key);
  }
  for (const key of [...out]) {
    const view = grantKey("VIEW", splitGrant(key).module);
    if (GRANTABLE.has(view)) out.add(view);
  }
  return sortGrants(out);
}

/** What a change adds and removes. */
export function grantDiff(before: readonly string[], after: readonly string[]): { added: string[]; removed: string[] } {
  const was = new Set(before);
  const now = new Set(after);
  return { added: sortGrants(after.filter((k) => !was.has(k))), removed: sortGrants(before.filter((k) => !now.has(k))) };
}

/** "18 permissions in 7 modules". */
export function grantSummary(keys: readonly string[]): string {
  if (!keys.length) return "No permissions";
  const modules = new Set(keys.map((k) => splitGrant(k).module)).size;
  return `${keys.length} permission${keys.length === 1 ? "" : "s"} in ${modules} module${modules === 1 ? "" : "s"}`;
}

/**
 * The self-service basics: what the Employee role holds. On a role with the "own records" scope
 * they reach only the holder's own payslips, leave and loans.
 */
export const SELF_SERVICE_BASICS: ReadonlySet<string> = new Set([
  ...EMPLOYEE_SELF_SERVICE_GRANTS.map((g) => grantKey(g.action, g.module)),
  grantKey("VIEW", "SELF_SERVICE"),
  grantKey("ADD", "SELF_SERVICE"),
  grantKey("EDIT", "SELF_SERVICE"),
]);

/** A "Start from" choice for a new role: its permissions, or null when the preset is unknown. */
export function presetGrants(id: string): string[] | null {
  if (id === "read_only") return sortGrants([...GRANTABLE].filter((k) => k.startsWith("VIEW:")));
  const preset = ROLE_PERMISSION_PRESETS.find((p) => p.id === id);
  return preset ? normalizeGrants(preset.grants.map((g) => grantKey(g.action, g.module))) : null;
}

export const ROLE_PRESETS: readonly { id: string; label: string; description: string }[] = ROLE_PERMISSION_PRESETS.map((p) => ({
  id: p.id,
  label: p.label,
  description: p.id === "read_only" ? "View every module, change nothing" : p.description,
}));

// ---------------------------------------------------------------------------
// The role window
// ---------------------------------------------------------------------------

export interface RoleForm {
  name: string;
  description: string;
  scopeType: ScopeType;
}

export type RoleFormErrors = Partial<Record<keyof RoleForm, string>>;

export const ROLE_NAME_MAX = 80;
export const ROLE_DESCRIPTION_MAX = 300;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max + 1) : "");

export function normalizeRoleForm(raw: unknown): RoleForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const scope = String(r.scopeType ?? "") as ScopeType;
  return {
    name: text(r.name, ROLE_NAME_MAX),
    description: text(r.description, ROLE_DESCRIPTION_MAX),
    scopeType: SCOPES.includes(scope) ? scope : ("" as ScopeType),
  };
}

/** Field errors, or null. `otherNames`: every other role's name (names are unique, any case). */
export function validateRoleForm(form: RoleForm, otherNames: readonly string[]): RoleFormErrors | null {
  const errors: RoleFormErrors = {};
  if (!form.name) errors.name = "Give the role a name.";
  else if (form.name.length > ROLE_NAME_MAX) errors.name = `At most ${ROLE_NAME_MAX} characters.`;
  else if (otherNames.some((n) => n.trim().toLowerCase() === form.name.toLowerCase())) errors.name = "Another role already has this name.";
  if (form.description.length > ROLE_DESCRIPTION_MAX) errors.description = `At most ${ROLE_DESCRIPTION_MAX} characters.`;
  if (!SCOPES.includes(form.scopeType)) errors.scopeType = "Choose what the role covers.";
  return Object.keys(errors).length ? errors : null;
}

/** A slug for a new role's name, unique among `taken`. */
export function roleSlugFor(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "role";
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}_${i}`)) return `${base}_${i}`;
}

/** The roles list's "kind": the administrator role, one that came with the system, or the company's own. */
export function roleKind(role: { slug: string; isSystemRole: boolean; isProtected: boolean }): "administrator" | "built-in" | "custom" {
  if (isAdminRole(role.slug)) return "administrator";
  return role.isSystemRole || role.isProtected ? "built-in" : "custom";
}

/**
 * The company administrator roles: they hold every permission (the bypass in `verifyPermission`),
 * company-wide. `office_admin` is the one a new company gets; `system_admin` comes from the seed.
 */
export const ADMIN_ROLE_SLUGS: readonly string[] = ["system_admin", "office_admin"];

export const isAdminRole = (slug: string | null | undefined): boolean => !!slug && ADMIN_ROLE_SLUGS.includes(slug);
