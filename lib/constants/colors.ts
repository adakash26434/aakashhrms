// Hex values for places that cannot read CSS variables (Recharts SVG
// attributes, server-built data). Keep in sync with the tokens in
// app/globals.css (docs/redesign/02-design-system.md §3). In className
// strings use the Tailwind tokens (bg-brand, text-ink-muted, ...) instead.

export const PAYROLL_COLORS = {
  cream: "#F7F9F6",
  light: "#DDE4DA",
  primary: "#1E7F12",
  primaryHover: "#186A0F",
  primaryLight: "#EEF7EB",
  navy: "#1A2118",
  border: "#DDE4DA",
  borderTable: "#C6D0C2",
} as const;

/** Axis, grid and tooltip styling shared by every Recharts chart. */
export const CHART_THEME = {
  grid: "#EEF2EC",
  axisTick: "#677262",
  tooltipBorder: "#DDE4DA",
  tooltipBg: "#FFFFFF",
  fontSize: 11,
} as const;

/** Data series. Forest green leads; the rest are muted so the brand stays primary. */
export const CHART_COLORS = {
  primary: PAYROLL_COLORS.primary,
  primarySoft: "#96CD86",
  navy: PAYROLL_COLORS.navy,
  light: PAYROLL_COLORS.light,
  estimated: "#AEB8A9",
  mid: "#4F7CB8",
  soft: "#9BB4D4",
  warning: "#D99A2B",
  danger: "#C2413B",
} as const;

export const DEPARTMENT_COLORS = [
  PAYROLL_COLORS.primary,
  "#4F7CB8",
  "#96CD86",
  "#D99A2B",
  "#3D4638",
  "#9BB4D4",
  "#C6D0C2",
] as const;

export const SEMANTIC_COLORS = {
  success: {
    bg: "#E8F5EE",
    text: "#1E7A4C",
    border: "#B9DFC9",
  },
  danger: {
    bg: "#FDECEC",
    text: "#B91C1C",
    border: "#F5C2C2",
  },
  warning: {
    bg: "#FFF5E0",
    text: "#A86300",
    border: "#F2D59A",
  },
  info: {
    bg: "#EAF1FB",
    text: "#1F5FA8",
    border: "#C3D6EF",
  },
} as const;

export const FILTER_CHIP_CLASS =
  "bg-payroll-primary-light text-payroll-primary border border-payroll-primary-border text-xs font-semibold px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 transition-all";

/** Recharts <Tooltip contentStyle>. */
export const CHART_TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 6,
  border: `1px solid ${CHART_THEME.tooltipBorder}`,
  backgroundColor: CHART_THEME.tooltipBg,
  boxShadow: "0 4px 10px -2px rgba(26, 33, 24, 0.08)",
} as const;

/** Recharts axis tick props. */
export const CHART_AXIS_TICK = { fontSize: CHART_THEME.fontSize, fill: CHART_THEME.axisTick } as const;
