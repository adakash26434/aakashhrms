import {
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  Clock,
  CreditCard,
  DollarSign,
  FilePen,
  FileSpreadsheet,
  Home,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Network,
  Receipt,
  ScrollText,
  Settings2,
  Shield,
  Table,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

// Application navigation (redesign 2.1): modules on the rail, sections in the
// navigator. `requires` is UX only — every page and action re-checks access on
// the server (security plan, standing measure 1).

export type ModuleId = "home" | "workforce" | "time" | "payroll" | "reports" | "setup" | "admin";

export interface NavSection {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** One line for the command palette. */
  description?: string;
  /** Visible when the user can VIEW any of these permission modules. Omitted = everyone. */
  requires?: readonly string[];
  /** Extra path prefixes that also mark this section active. */
  matches?: readonly string[];
  /** Extra palette search terms. */
  keywords?: readonly string[];
  /** Counter shown in the navigator (resolved by the frame). */
  counter?: "pendingApprovals";
}

export interface NavModule {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
  /** Alt+<n> */
  hotkey: string;
  sections: readonly NavSection[];
}

export const NAV_MODULES: readonly NavModule[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    hotkey: "1",
    sections: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Payroll cost, statutory dues, attendance and pending work",
        keywords: ["home", "dashboard", "overview", "work queue", "approvals", "deadlines"],
      },
    ],
  },
  {
    id: "workforce",
    label: "Workforce",
    icon: Users,
    hotkey: "2",
    sections: [
      {
        id: "employees",
        label: "Employees",
        href: "/workforce/employees",
        icon: Users,
        description: "Employee register, profiles and onboarding",
        requires: ["EMPLOYEES"],
        keywords: ["staff", "people", "directory", "hire"],
      },
      {
        id: "organization",
        label: "Organization",
        href: "/workforce/organization",
        icon: Network,
        description: "Branches, departments and designations",
        requires: ["ORG_STRUCTURE"],
        matches: ["/workforce/departments"],
        keywords: ["branch", "department", "designation", "structure"],
      },
      {
        id: "salary-structure",
        label: "Salary structure",
        href: "/workforce/salary-mapping",
        icon: DollarSign,
        description: "Basic salary, grades, allowances and deductions per employee",
        requires: ["SALARY_MAPPING"],
        keywords: ["salary mapping", "pay", "allowance", "grade"],
      },
      {
        id: "recruitment",
        label: "Recruitment",
        href: "/workforce/recruitment",
        icon: Users,
        description: "दरबन्दी (approved positions), vacancies and applicants",
        requires: ["RECRUITMENT"],
        keywords: ["recruitment", "darbandi", "vacancy", "applicant", "hiring", "merit", "bharna"],
      },
      {
        id: "lifecycle",
        label: "Lifecycle events",
        href: "/workforce/lifecycle",
        icon: CalendarCheck,
        description: "Promotions, transfers and confirmations as dated records",
        requires: ["EMPLOYEES"],
        keywords: ["promotion", "badhuwa", "transfer", "saruwa", "confirmation", "sthayi", "event", "history"],
      },
      {
        id: "training",
        label: "Training",
        href: "/workforce/training",
        icon: CalendarDays,
        description: "Programmes, nominations, attendance, scores and service bonds",
        requires: ["TRAINING"],
        keywords: ["training", "talim", "programme", "course", "certificate", "bond", "workshop"],
      },
      {
        id: "discipline",
        label: "Discipline & grievance",
        href: "/workforce/discipline",
        icon: Shield,
        description: "Confidential disciplinary and grievance cases",
        requires: ["DISCIPLINE"],
        keywords: ["discipline", "disciplinary", "grievance", "gunaso", "warning", "show cause", "complaint", "anushasan"],
      },
      {
        id: "evaluation",
        label: "Performance",
        href: "/workforce/evaluation",
        icon: ListChecks,
        description: "का.स.मू. evaluation cycles, marks and grades",
        requires: ["PERFORMANCE"],
        keywords: ["evaluation", "kasamu", "performance", "appraisal", "marks", "grade", "mulyankan"],
      },
      {
        id: "exit",
        label: "Exit",
        href: "/workforce/exit",
        icon: Landmark,
        description: "Resignations and other exits: clearance, completion, experience letter",
        requires: ["EMPLOYEES"],
        keywords: ["exit", "resignation", "rajinama", "retirement", "clearance", "settlement", "offboarding"],
      },
      {
        id: "hr-letters",
        label: "HR letters",
        href: "/workforce/letters",
        icon: FilePen,
        description: "Appointment, promotion, transfer, experience and NOC letters",
        requires: ["HR_LETTERS"],
        keywords: ["letter", "chalani", "appointment", "niyukti", "promotion", "badhuwa", "transfer", "saruwa", "experience", "anubhav", "noc", "template"],
      },
    ],
  },
  {
    id: "time",
    label: "Time & Leave",
    icon: Clock,
    hotkey: "3",
    sections: [
      {
        id: "attendance",
        label: "Attendance",
        href: "/timeAndLeave/attendance",
        icon: Clock,
        description: "Daily punches, bulk entry and overtime",
        requires: ["ATTENDANCE"],
        keywords: ["punch", "present", "absent", "ot"],
      },
      {
        id: "devices",
        label: "Devices",
        href: "/timeAndLeave/devices",
        icon: Table,
        description: "Biometric terminals: ADMS push, PIN mapping, punch import",
        requires: ["ATTENDANCE"],
        keywords: ["device", "biometric", "zkteco", "fingerprint", "adms", "terminal", "punch import"],
      },
      {
        id: "leaves",
        label: "Leaves",
        href: "/timeAndLeave/leaves",
        icon: CalendarCheck,
        description: "Leave requests, approvals and balances",
        requires: ["LEAVE_APPLICATIONS", "LEAVE_APPROVALS"],
        matches: ["/timeAndLeave/applications", "/timeAndLeave/approvals"],
        keywords: ["leave request", "approve", "balance", "vacation"],
        counter: "pendingApprovals",
      },
      {
        id: "policies",
        label: "Policies",
        href: "/timeAndLeave/policies",
        icon: ScrollText,
        description: "Leave types and overtime rules",
        requires: ["LEAVE_TYPES", "OT_RULES"],
        matches: ["/timeAndLeave/leave-types", "/timeAndLeave/leave-rules", "/timeAndLeave/ot-rules"],
        keywords: ["leave type", "overtime rule", "policy"],
      },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    icon: FilePen,
    hotkey: "4",
    sections: [
      {
        id: "payroll-run",
        label: "Payroll run",
        href: "/payroll/generate",
        icon: FilePen,
        description: "Generate the monthly payroll batch",
        requires: ["PAYROLL_GENERATE"],
        keywords: ["generate", "calculate", "salary", "batch", "run"],
      },
      {
        id: "payroll-review",
        label: "Review & batches",
        href: "/payroll/review",
        icon: ListChecks,
        description: "Review, approve and lock payroll batches",
        requires: ["PAYROLL_REVIEW"],
        keywords: ["approve", "lock", "payslip", "batch"],
      },
      {
        id: "leave-salary",
        label: "Leave salary",
        href: "/payroll/leave-salary",
        icon: Wallet,
        description: "Leave encashment runs",
        requires: ["LEAVE_SALARY"],
        keywords: ["encashment"],
      },
      {
        id: "loans",
        label: "Loans & advances",
        href: "/loans",
        icon: CreditCard,
        description: "Loan register, disbursement and repayment",
        requires: ["LOANS"],
        keywords: ["advance", "emi", "repayment"],
      },
      {
        id: "funds",
        label: "Welfare funds",
        href: "/payroll/funds",
        icon: Wallet,
        description: "Staff welfare, medical and gratuity funds: contributions, balances, payouts",
        requires: ["WELFARE_FUNDS"],
        keywords: ["welfare", "kalyan kosh", "gratuity", "medical fund", "provision", "payout"],
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    hotkey: "5",
    sections: [
      {
        id: "salary-sheet",
        label: "Salary sheet",
        href: "/reports/salary-sheet",
        icon: Table,
        description: "Earnings, deductions and net pay for a locked run",
        requires: ["REPORTS_SALARY_SHEET"],
      },
      {
        id: "payslips",
        label: "Payslips",
        href: "/reports/payslip",
        icon: Receipt,
        description: "Individual payslips for printing",
        requires: ["REPORTS_PAYSLIP"],
        keywords: ["pay slip"],
      },
      {
        id: "attendance-report",
        label: "Attendance report",
        href: "/reports/attendance",
        icon: CalendarDays,
        description: "Monthly attendance register",
        requires: ["REPORTS_ATTENDANCE"],
      },
      {
        id: "tax-ird",
        label: "Tax / IRD",
        href: "/reports/tax-ird",
        icon: Landmark,
        description: "TDS schedule and IRD reporting",
        requires: ["REPORTS_TAX_IRD"],
        keywords: ["tds", "etds", "income tax"],
      },
      {
        id: "leave-report",
        label: "Leave report",
        href: "/reports/leave",
        icon: CalendarCheck,
        description: "Leave applications and balances",
        requires: ["REPORTS_LEAVE"],
      },
      {
        id: "loan-report",
        label: "Loan report",
        href: "/reports/loan",
        icon: FileSpreadsheet,
        description: "Loan summary and repayment schedule",
        requires: ["REPORTS_LOAN"],
      },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    icon: Settings2,
    hotkey: "6",
    sections: [
      {
        id: "company-setup",
        label: "Company setup",
        href: "/setup/company-setup",
        icon: Building2,
        description: "Company profile, schedules, fiscal year, tax and pay heads",
        requires: ["ORG_STRUCTURE"],
        matches: ["/setup/payroll-rules", "/setup/fiscal-year", "/setup/tax-rates", "/setup/pay-heads", "/setup/system-control"],
        keywords: ["fiscal year", "tax rate", "pay head", "work schedule", "shreni", "rules"],
      },
      {
        id: "holidays",
        label: "Holiday calendar",
        href: "/setup/holidays",
        icon: CalendarDays,
        description: "Public and company holidays",
        requires: ["HOLIDAYS"],
        keywords: ["holiday", "calendar", "dashain", "tihar"],
      },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    icon: Shield,
    hotkey: "7",
    sections: [
      {
        id: "users",
        label: "Users",
        href: "/admin/users",
        icon: UserCog,
        description: "User accounts and access",
        requires: ["USERS_ROLES"],
        keywords: ["account", "login", "invite"],
      },
      {
        id: "roles",
        label: "Roles & permissions",
        href: "/admin/roles",
        icon: Shield,
        description: "Role permission matrix",
        requires: ["USERS_ROLES"],
        keywords: ["rbac", "access", "permission"],
      },
      {
        id: "audit-log",
        label: "Audit log",
        href: "/admin/audit-log",
        icon: ScrollText,
        description: "Who changed what, and when",
        requires: ["AUDIT_LOG"],
        keywords: ["history", "trail"],
      },
      {
        id: "jobs",
        label: "Scheduled jobs",
        href: "/admin/jobs",
        icon: Clock,
        description: "Reminders and automation: status, run log, on/off",
        requires: ["SYSTEM_CONTROL"],
        keywords: ["cron", "reminder", "automation", "tick", "ssf", "tds", "birthday", "probation"],
      },
    ],
  },
];

export interface NavAccess {
  allowedModules: readonly string[];
  /** Impersonating super admins see everything. */
  fullAccess: boolean;
}

export function canSeeSection(section: NavSection, access: NavAccess): boolean {
  if (!section.requires || section.requires.length === 0) return true;
  if (access.fullAccess) return true;
  return section.requires.some((m) => access.allowedModules.includes(m));
}

/** Modules with only the sections the user may see; empty modules are dropped. */
export function visibleModules(access: NavAccess, modules: readonly NavModule[] = NAV_MODULES): NavModule[] {
  return modules
    .map((m) => ({ ...m, sections: m.sections.filter((s) => canSeeSection(s, access)) }))
    .filter((m) => m.sections.length > 0);
}

function pathMatches(pathname: string, prefix: string): boolean {
  const base = prefix.split("?")[0];
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Longest-prefix match of the current path to a module and section. */
export function findActiveLocation(
  pathname: string,
  modules: readonly NavModule[] = NAV_MODULES
): { module: NavModule; section: NavSection | null } | null {
  let best: { module: NavModule; section: NavSection; length: number } | null = null;
  for (const mod of modules) {
    for (const section of mod.sections) {
      for (const prefix of [section.href, ...(section.matches ?? [])]) {
        const base = prefix.split("?")[0];
        if (pathMatches(pathname, base) && (!best || base.length > best.length)) {
          best = { module: mod, section, length: base.length };
        }
      }
    }
  }
  // Module landing pages (/setup, /reports, …) select the module, no section.
  if (!best) {
    const landing: Record<string, ModuleId> = {
      "/setup": "setup",
      "/reports": "reports",
      "/payroll": "payroll",
      "/workforce": "workforce",
      "/timeAndLeave": "time",
      "/admin": "admin",
    };
    const id = landing[pathname];
    const mod = id ? modules.find((m) => m.id === id) : undefined;
    return mod ? { module: mod, section: null } : null;
  }
  return { module: best.module, section: best.section };
}
