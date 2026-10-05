// The user's date display format (BS / AD, numeric / long). Kept in a
// cookie as well as localStorage so the server renders the chosen format
// straight away (no BS → AD flash after loading). Not secret: a display
// preference only.

export type DateFormat = "bs-long" | "bs-numeric" | "ad-iso" | "ad-long";

export const DATE_FORMAT_KEY = "payroll.dateFormat";
export const DEFAULT_DATE_FORMAT: DateFormat = "bs-numeric";

export function parseDateFormat(s: string | null | undefined): DateFormat | null {
  return s === "bs-long" || s === "bs-numeric" || s === "ad-iso" || s === "ad-long" ? s : null;
}
