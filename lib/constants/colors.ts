export const PAYROLL_COLORS = {
  cream: "#f6faf6",
  light: "#d7e8d0",
  primary: "#2e7d32",
  navy: "#1b3a1f",
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
    text: "#2e7d32",
    border: "#d7e8d0",
  },
} as const;

export const FILTER_CHIP_CLASS =
  "bg-[#d7e8d0]/60 text-[#1b3a1f] border border-[#d7e8d0] text-xs font-semibold px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 transition-all";

