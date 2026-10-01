export const PAYROLL_COLORS = {
  cream: "#F6F8F5",
  light: "#E4E7E4",
  primary: "#1B6B54",
  primaryHover: "#155743",
  primaryLight: "#EBF4F0",
  navy: "#111827",
  border: "#E4E7E4",
  borderTable: "#D1D5DB",
} as const;

export const CHART_COLORS = {
  primary: PAYROLL_COLORS.primary,
  navy: PAYROLL_COLORS.navy,
  light: PAYROLL_COLORS.light,
  mid: "#6B93C4",
  soft: "#9BB4D4",
} as const;

export const DEPARTMENT_COLORS = [
  PAYROLL_COLORS.navy,
  PAYROLL_COLORS.primary,
  "#5A8BC4",
  "#7BA3D4",
  "#9BB4D4",
  PAYROLL_COLORS.light,
  "#A8B8CC",
] as const;

export const SEMANTIC_COLORS = {
  success: {
    bg: "#ECFDF5",
    text: "#047857",
    border: "#A7F3D0",
  },
  danger: {
    bg: "#FEF2F2",
    text: "#B91C1C",
    border: "#FECACA",
  },
  warning: {
    bg: "#FFFBEB",
    text: "#B45309",
    border: "#FDE68A",
  },
  info: {
    bg: "#EFF6FF",
    text: "#1B6B54",
    border: "#DDECE3",
  },
} as const;

export const FILTER_CHIP_CLASS =
  "bg-payroll-primary-light text-payroll-primary border border-payroll-primary-border text-xs font-semibold px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 transition-all";


