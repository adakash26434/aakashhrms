export type TrendDirection = "up" | "down" | "neutral";
export type SeverityLevel = "critical" | "warning" | "pending";
export type ComplianceStatus = "on-track" | "needs-review" | "draft";
export type WorkflowStepStatus = "complete" | "in-review" | "upcoming";
export type ActivityCategory = "all" | "payroll" | "leave" | "security";
export type PriorityLevel = "high" | "medium" | "low";

export interface DashboardHero {
  greeting: string;
  summary: string;
  payrollLockNote: string;
}

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  subtext: string;
  badge: string;
  badgeVariant: "success" | "warning" | "info" | "neutral";
  highlighted?: boolean;
  icon: "users" | "wallet" | "calendar" | "credit-card" | "shield" | "alert";
}

export interface WorkflowStep {
  id: string;
  label: string;
  status: WorkflowStepStatus;
  actor: string;
  timestamp: string;
}

export interface PayrollRunSummary {
  id: string;
  period: string;
  dateRange: string;
  statusLabel: string;
  statusVariant: "success" | "warning";
  awaitingLabel: string;
  employeesIncluded: number;
  employeesExcluded: number;
  exceptions: number;
  grossPayroll: number;
  totalDeductions: number;
  netPayable: number;
  deductions: { label: string; amount: number; color: string }[];
  workflowSteps: WorkflowStep[];
  payPeriodMonth?: number;
  payPeriodYear?: number;
  payPeriodStartDate?: string;
  payPeriodEndDate?: string;
}

export interface ValidationException {
  id: string;
  employeeName: string;
  employeeId: string;
  department: string;
  exception: string;
  severity: SeverityLevel;
}

export interface TrendDataPoint {
  month: string;
  gross: number;
  net: number;
  tds: number;
  isEstimated?: boolean;
  monthNum?: number;
  year?: number;
}

export interface DepartmentHeadcount {
  name: string;
  count: number;
  color: string;
}

export interface AttendanceDay {
  day: string;
  present: number;
  leave: number;
  absent: number;
}

export interface ComplianceItem {
  id: string;
  code: string;
  name: string;
  status: ComplianceStatus;
  readiness: number;
  detail: string;
  lastSubmitted?: string;
  nextDue?: string;
}

export interface ActivityItem {
  id: string;
  actor: string;
  role: string;
  description: string;
  highlight?: string;
  timestamp: string;
  category: Exclude<ActivityCategory, "all">;
  icon: "check" | "calendar" | "alert" | "lock" | "mail" | "wallet";
}

export interface UpcomingEvent {
  id: string;
  monthCode: string;
  day: string;
  title: string;
  owner: string;
  priority: PriorityLevel;
}

export interface ApprovalItem {
  id: string;
  name: string;
  initials: string;
  type: string;
  durationOrAmount: string;
  dateTag: string;
  hasPayrollImpact: boolean;
  category: "leave" | "attendance" | "loans";
}

export interface TodayWorkforceSummary {
  total: number;
  present: number;
  onLeave: number;
  absent: number;
  lateCount: number;
  presentPercent: string;
  leavePercent: string;
  absentPercent: string;
}

export interface DashboardData {
  hero: DashboardHero;
  metrics: KpiMetric[];
  pendingApprovals: {
    value: number;
    subtext: string;
    badge: string;
    items?: ApprovalItem[];
  };
  currentRun: PayrollRunSummary;
  validationExceptions: ValidationException[];
  trend: TrendDataPoint[];
  headcount: DepartmentHeadcount[];
  attendance: AttendanceDay[];
  todayWorkforce?: TodayWorkforceSummary;
  complianceScore: number;
  compliance: ComplianceItem[];
  activity: ActivityItem[];
  upcoming: UpcomingEvent[];
}
