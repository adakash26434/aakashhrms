import {
  LayoutDashboard,
  Settings,
  CalendarDays,
  Users,
  Building2,
  DollarSign,
  Clock,
  CalendarCheck,
  FilePen,
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
  /** Multiple permission modules: user needs ANY of these to VIEW this nav item. */
  requiredModules?: string[];
}

export interface NavGroup {
  label: string;
  href?: string;
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
    label: "Workforce",
    items: [
      { label: "Employees", href: "/workforce/employees", icon: Users, requiredModule: "EMPLOYEES" },
      { label: "Organization", href: "/workforce/organization", icon: Building2, requiredModule: "ORG_STRUCTURE" },
      { label: "Salary structure", href: "/workforce/salary-mapping", icon: DollarSign, requiredModule: "SALARY_MAPPING" },
    ],
  },
  {
    label: "Time & Leave",
    items: [
      { label: "Attendance", href: "/timeAndLeave/attendance", icon: Clock, requiredModule: "ATTENDANCE" },
      {
        label: "Leaves",
        href: "/timeAndLeave/leaves",
        icon: CalendarCheck,
        requiredModules: ["LEAVE_APPLICATIONS", "LEAVE_APPROVALS"],
      },
      {
        label: "Policies",
        href: "/timeAndLeave/policies",
        icon: ScrollText,
        requiredModules: ["LEAVE_TYPES", "LEAVE_RULES", "OT_RULES"],
      },
    ],
  },
  {
    label: "Payroll & Finance",
    items: [
      {
        label: "Payroll",
        href: "/payroll",
        icon: FilePen,
        requiredModules: ["PAYROLL_GENERATE", "PAYROLL_REVIEW"],
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
    label: "Configuration",
    href: "/setup",
    items: [
      {
        label: "Company & Work Policy",
        href: "/setup/company-setup",
        icon: Building2,
        requiredModule: "ORG_STRUCTURE",
      },
      {
        label: "Payroll Rules",
        href: "/setup/payroll-rules",
        icon: Settings,
        requiredModules: ["FISCAL_YEAR", "TAX_RATES", "PAY_HEADS", "SYSTEM_CONTROL"],
      },
      {
        label: "Holiday Calendar",
        href: "/setup/holidays",
        icon: CalendarDays,
        requiredModule: "HOLIDAYS",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users & roles", href: "/admin/users", icon: UserCog, requiredModule: "USERS_ROLES" },
      { label: "Roles & permissions", href: "/admin/roles", icon: Shield, requiredModule: "USERS_ROLES" },
      { label: "Audit log", href: "/admin/audit-log", icon: ScrollText, requiredModule: "AUDIT_LOG" },
    ],
  },
];
