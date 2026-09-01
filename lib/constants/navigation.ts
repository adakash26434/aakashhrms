import {
  LayoutDashboard,
  Settings,
  CalendarDays,
  Percent,
  FileText,
  Users,
  Building2,
  DollarSign,
  Clock,
  CalendarCheck,
  CheckSquare,
  Timer,
  FilePen,
  ShieldCheck,
  Wallet,
  CreditCard,
  Table,
  Receipt,
  BarChart3,
  UserCog,
  ScrollText,
  Shield,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  /** The permission module required to VIEW this nav item. Undefined = always visible. */
  requiredModule?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Configuration",
    items: [
      { label: "System control", href: "/setup/system-control", icon: Settings, requiredModule: "SYSTEM_CONTROL" },
      { label: "Fiscal year", href: "/setup/fiscal-year", icon: CalendarDays, requiredModule: "FISCAL_YEAR" },
      { label: "Tax rates", href: "/setup/tax-rates", icon: Percent, requiredModule: "TAX_RATES" },
      { label: "Pay heads", href: "/setup/pay-heads", icon: FileText, requiredModule: "PAY_HEADS" },
      { label: "Holidays", href: "/setup/holidays", icon: CalendarDays, requiredModule: "HOLIDAYS" },
    ],
  },
  {
    label: "Workforce",
    items: [
      { label: "Employees", href: "/workforce/employees", icon: Users, requiredModule: "EMPLOYEES" },
      { label: "Departments", href: "/workforce/departments", icon: Building2, requiredModule: "ORG_STRUCTURE" },
      { label: "Salary mapping", href: "/workforce/salary-mapping", icon: DollarSign, requiredModule: "SALARY_MAPPING" },
    ],
  },
  {
    label: "Time & Leave",
    items: [
      { label: "Attendance", href: "/timeAndLeave/attendance", icon: Clock, requiredModule: "ATTENDANCE" },
      { label: "Leave types", href: "/timeAndLeave/leave-types", icon: CalendarDays, requiredModule: "LEAVE_TYPES" },
      { label: "Leave rules", href: "/timeAndLeave/leave-rules", icon: ScrollText, requiredModule: "LEAVE_RULES" },
      {
        label: "Leave applications",
        href: "/timeAndLeave/applications",
        icon: CalendarCheck,
        requiredModule: "LEAVE_APPLICATIONS",
      },
      {
        label: "Leave approvals",
        href: "/timeAndLeave/approvals",
        icon: CheckSquare,
        requiredModule: "LEAVE_APPROVALS",
      },
      { label: "OT rules", 
        href: "/timeAndLeave/ot-rules", 
        icon: Timer,
        requiredModule: "OT_RULES",
      },
    ],
  },
  {
    label: "Payroll",
    items: [
      { label: "Generate payslip", href: "/payroll/generate", icon: FilePen, requiredModule: "PAYROLL_GENERATE" },
      {
        label: "Review & approve",
        href: "/payroll/review",
        icon: ShieldCheck,
        requiredModule: "PAYROLL_REVIEW",
      },
      { label: "Leave salary", href: "/payroll/leave-salary", icon: Wallet, requiredModule: "LEAVE_SALARY" },
      { label: "Loan management", href: "/loans", icon: CreditCard, requiredModule: "LOANS" },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Salary sheet", href: "/reports/salary-sheet", icon: Table, requiredModule: "REPORTS_SALARY_SHEET" },
      { label: "Payslip report", href: "/reports/payslip", icon: Receipt, requiredModule: "REPORTS_PAYSLIP" },
      {
        label: "Attendance report",
        href: "/reports/attendance",
        icon: CalendarDays,
        requiredModule: "REPORTS_ATTENDANCE",
      },
      { label: "Tax / IRD report", href: "/reports/tax-ird", icon: BarChart3, requiredModule: "REPORTS_TAX_IRD" },
      { label: "Leave report", href: "/reports/leave", icon: CalendarCheck, requiredModule: "REPORTS_LEAVE" },
      { label: "Loan report", href: "/reports/loan", icon: CreditCard, requiredModule: "REPORTS_LOAN" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Users & roles", href: "/admin/users", icon: UserCog, requiredModule: "USERS_ROLES" },
      { label: "Roles & permissions", href: "/admin/roles", icon: Shield, requiredModule: "USERS_ROLES" },
      { label: "Audit log", href: "/admin/audit-log", icon: ScrollText, requiredModule: "AUDIT_LOG" },
    ],
  },
];

