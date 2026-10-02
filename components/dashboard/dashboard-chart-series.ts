// Series names and colours shared by the dashboard charts and their legends.
// Kept apart from the chart files so legends render without loading Recharts.

import { CHART_COLORS } from "@/lib/constants/colors";
import type { BreakdownSegment } from "@/lib/types/dashboard";

export const COST_TREND_SERIES = [
  { key: "net", label: "Net pay", color: CHART_COLORS.primary },
  { key: "deductions", label: "Deductions", color: CHART_COLORS.primarySoft },
  { key: "employerExtra", label: "Employer PF", color: CHART_COLORS.navy },
] as const;

export const BREAKDOWN_COLORS: Record<BreakdownSegment["id"], string> = {
  net: CHART_COLORS.primary,
  tds: CHART_COLORS.warning,
  ssf: CHART_COLORS.mid,
  pf: CHART_COLORS.navy,
  cit: CHART_COLORS.soft,
  loan: CHART_COLORS.primarySoft,
  other: CHART_COLORS.estimated,
};

export const ATTENDANCE_SERIES = [
  { key: "present", label: "Present", color: CHART_COLORS.primary },
  { key: "leave", label: "On leave", color: CHART_COLORS.mid },
  { key: "absent", label: "Absent", color: CHART_COLORS.danger },
  { key: "off", label: "Holiday / off", color: CHART_COLORS.estimated },
  { key: "notRecorded", label: "Not recorded", color: "#E4E8E1" },
] as const;
