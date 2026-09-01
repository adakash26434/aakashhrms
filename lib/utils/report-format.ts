/**
 * Display formatters for report presentation (UI display only)
 */

export function formatNPR(value: string | number, showPrefix: boolean = false): string {
  const num = typeof value === "number" ? value : parseFloat(value) || 0;
  const formatted = num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return showPrefix ? `NPR ${formatted}` : formatted;
}

export function formatHours(value: string | number): string {
  if (typeof value === "string" && value.includes(":")) return value;
  const num = typeof value === "number" ? value : parseFloat(value) || 0;
  const hrs = Math.floor(num);
  const mins = Math.round((num - hrs) * 60);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
