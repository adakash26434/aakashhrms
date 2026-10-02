/**
 * Validates a post-unlock / post-login return path. Only same-origin absolute
 * paths are allowed ("/payroll/review"), never "//host", "/\host" or URLs,
 * so the parameter can't be used as an open redirect.
 */
export function safeReturnTo(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Control characters and any backslash (browsers treat "\" like "/").
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  if (value === "/locked" || value.startsWith("/locked?") || value.startsWith("/login")) return fallback;
  return value;
}
