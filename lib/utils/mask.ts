// Display masking for sensitive identifiers (security plan S18). The full
// value is only ever shown inside the edit form, which needs EDIT permission.

/** "0123456789014821" → "••••4821". Short or empty values stay recognisable but hidden. */
export function maskAccountNumber(value: string | null | undefined): string {
  const clean = (value ?? "").replace(/\s+/g, "");
  if (!clean) return "";
  if (clean.length <= 4) return "••••";
  return `••••${clean.slice(-4)}`;
}

