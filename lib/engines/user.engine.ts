import type { ScopeType } from "@/lib/types/role";
import type { LoginForm, LoginFormErrors, LoginRow } from "@/lib/types/user";

// Logins (4.13): the login window's fields, checked the same way in the browser and on the
// server, a login's state in words, and the temporary passwords a new login or a reset gets.
// Pure (safe in the browser): the random source is passed in — the server passes node:crypto's.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LOGIN_NAME_MAX = 120;
export const LOGIN_EMAIL_MAX = 255;

/**
 * Validates email format.
 */
export function validateEmail(email: string): boolean {
  if (!email || !email.trim()) return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Password strength rules as per specification:
 * Minimum 10 characters, uppercase, lowercase, number, symbol
 */
export function validatePasswordStrength(password: string): boolean {
  if (!password || password.length < 10) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSymbol;
}

const UPPERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERS = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*";
export const TEMPORARY_PASSWORD_LENGTH = 14;

/**
 * A temporary password meeting the strength rules: one of each character class, the rest from
 * all of them, shuffled. S59: `random` is the operating system's cryptographic generator
 * (`crypto.randomInt` on the server); `Math.random()` is predictable from its earlier outputs.
 * Characters that read alike (0/O, 1/l/I) are left out because people type it from a screen.
 */
export function generateTemporaryPassword(random: (max: number) => number): string {
  const pick = (charset: string) => charset.charAt(random(charset.length));
  const chars = [pick(UPPERS), pick(LOWERS), pick(DIGITS), pick(SYMBOLS)];
  const all = UPPERS + LOWERS + DIGITS + SYMBOLS;
  while (chars.length < TEMPORARY_PASSWORD_LENGTH) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// ---------------------------------------------------------------------------
// The login window
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && UUID.test(x)))].slice(0, 200) : []);

/** The window's fields as sent, trimmed and typed (nothing else is read). */
export function normalizeLoginForm(raw: unknown): LoginForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max + 1) : "");
  const id = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : "");
  return {
    name: str(r.name, LOGIN_NAME_MAX),
    email: str(r.email, LOGIN_EMAIL_MAX).toLowerCase(),
    roleId: id(r.roleId),
    employeeId: id(r.employeeId) || null,
    branchIds: ids(r.branchIds),
    departmentIds: ids(r.departmentIds),
  };
}

/** Only the list the role's scope reads: a company-wide role keeps no branches, and so on. */
export function accessListsFor(scopeType: ScopeType | null | undefined, form: Pick<LoginForm, "branchIds" | "departmentIds">): Pick<LoginForm, "branchIds" | "departmentIds"> {
  return {
    branchIds: scopeType === "BRANCH" ? form.branchIds : [],
    departmentIds: scopeType === "DEPARTMENT" ? form.departmentIds : [],
  };
}

/**
 * Field errors, or null. `scopeType` is the chosen role's (null: no such role); the id sets are
 * the branches and departments that exist; `employee` says whether the chosen employee can be
 * linked (null: fine, otherwise the reason).
 */
export function validateLoginForm(
  form: LoginForm,
  ctx: { scopeType: ScopeType | null; branchIds: ReadonlySet<string>; departmentIds: ReadonlySet<string>; employee: string | null }
): LoginFormErrors | null {
  const errors: LoginFormErrors = {};
  if (!form.name) errors.name = "Enter the person's name.";
  else if (form.name.length > LOGIN_NAME_MAX) errors.name = `At most ${LOGIN_NAME_MAX} characters.`;
  if (!form.email) errors.email = "Enter the email address they sign in with.";
  else if (form.email.length > LOGIN_EMAIL_MAX || !validateEmail(form.email)) errors.email = "Enter a valid email address.";
  if (!form.roleId) errors.roleId = "Choose a role.";
  else if (!ctx.scopeType) errors.roleId = "That role no longer exists.";
  if (ctx.employee) errors.employeeId = ctx.employee;
  else if (ctx.scopeType === "SELF" && !form.employeeId) errors.employeeId = "A self-service login needs the employee it belongs to.";
  if (ctx.scopeType === "BRANCH") {
    if (!form.branchIds.length) errors.branchIds = "Choose the branches this login covers.";
    else if (form.branchIds.some((b) => !ctx.branchIds.has(b))) errors.branchIds = "One of the branches no longer exists.";
  }
  if (ctx.scopeType === "DEPARTMENT") {
    if (!form.departmentIds.length) errors.departmentIds = "Choose the departments this login covers.";
    else if (form.departmentIds.some((d) => !ctx.departmentIds.has(d))) errors.departmentIds = "One of the departments no longer exists.";
  }
  return Object.keys(errors).length ? errors : null;
}

/** An administrator's sign-in email belongs to the platform (support resets it there). */
export function emailChangeProblem(current: { email: string; isAdministrator: boolean }, nextEmail: string): string | null {
  return current.isAdministrator && current.email.trim().toLowerCase() !== nextEmail.trim().toLowerCase()
    ? "An administrator's sign-in email is changed by AakashHRMS support (the platform), not here."
    : null;
}

/** A login's state in words, sign-in included (the Users list and pane). */
export function loginState(l: Pick<LoginRow, "isActive" | "employee" | "lockedUntil" | "mustChangePassword">): { key: "active" | "inactive" | "pending" | "locked" | "left"; label: string } {
  if (!l.isActive) return { key: "inactive", label: "Inactive" };
  if (l.employee && l.employee.status !== "Active") return { key: "left", label: "Employee has left" };
  if (l.lockedUntil) return { key: "locked", label: "Locked for now" };
  if (l.mustChangePassword) return { key: "pending", label: "Waiting for first sign-in" };
  return { key: "active", label: "Active" };
}
