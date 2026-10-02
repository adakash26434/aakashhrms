// Money display (roadmap 3.6, E7): Nepali / Indian lakh grouping, tabular,
// negative values marked. One implementation for grids, totals and KPIs.

export type AmountPrefix = "NPR" | "Rs." | "₨" | "";

export interface AmountFormatOptions {
  decimals?: number;
  prefix?: AmountPrefix;
  /** KPI style: 4.52 L, 1.25 Cr (Nepali short scale). */
  compact?: boolean;
  /** Accounting style: (1,250.00) instead of -1,250.00. */
  parentheses?: boolean;
}

const formatters = new Map<number, Intl.NumberFormat>();
function grouping(decimals: number): Intl.NumberFormat {
  let f = formatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    formatters.set(decimals, f);
  }
  return f;
}

/** Parses "4,52,300.50", "NPR 1,200", "(1,250.00)" and numbers. Returns null when not a number. */
export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let text = value.trim();
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/^(NPR|Rs\.?|₨)\s*/i, "").replace(/,/g, "").trim();
  if (!/^[+-]?\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return negative ? -n : n;
}

export function formatAmount(value: unknown, options: AmountFormatOptions = {}): string {
  const { decimals = 2, prefix = "", compact = false, parentheses = false } = options;
  const n = parseAmount(value);
  if (n === null) return "—";
  const abs = Math.abs(n);
  let body: string;
  if (compact && abs >= 1_00_00_000) body = `${grouping(2).format(abs / 1_00_00_000)} Cr`;
  else if (compact && abs >= 1_00_000) body = `${grouping(2).format(abs / 1_00_000)} L`;
  else body = grouping(compact ? 0 : decimals).format(abs);
  const withPrefix = prefix ? `${prefix} ${body}` : body;
  if (n < 0) return parentheses ? `(${withPrefix})` : `-${withPrefix}`;
  return withPrefix;
}

export function isNegativeAmount(value: unknown): boolean {
  const n = parseAmount(value);
  return n !== null && n < 0;
}
