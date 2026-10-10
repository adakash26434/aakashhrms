export type ScopeType = 'GLOBAL' | 'BRANCH' | 'DEPARTMENT' | 'SELF';

export type ActionType = 'VIEW' | 'ADD' | 'EDIT' | 'DELETE' | 'APPROVE' | 'EXPORT' | 'LOCK';

export type ModuleType =
  | 'SYSTEM_CONTROL'
  | 'FISCAL_YEAR'
  | 'TAX_RATES'
  | 'PAY_HEADS'
  | 'HOLIDAYS'
  | 'EMPLOYEES'
  | 'SALARY_MAPPING'
  | 'ATTENDANCE'
  | 'LEAVE_APPLICATIONS'
  | 'LEAVE_APPROVALS'
  | 'OT_RULES'
  | 'LEAVE_RULES'
  | 'LEAVE_TYPES'
  | 'PAYROLL_GENERATE'
  | 'PAYROLL_REVIEW'
  | 'LEAVE_SALARY'
  | 'LOANS'
  | 'REPORTS_SALARY_SHEET'
  | 'REPORTS_PAYSLIP'
  | 'REPORTS_ATTENDANCE'
  | 'REPORTS_TAX_IRD'
  | 'REPORTS_LEAVE'
  | 'REPORTS_LOAN'
  | 'USERS_ROLES'
  | 'AUDIT_LOG'
  | 'ORG_STRUCTURE'
  | 'SELF_SERVICE'
  | 'HR_LETTERS'
  | 'PERFORMANCE'
  | 'RECRUITMENT'
  | 'DISCIPLINE'
  | 'TRAINING'
  | 'ASSETS'
  | 'NOTICE_BOARD'
  | 'TRAVEL'
  | 'TARGETS'
  | 'REIMBURSEMENTS'
  | 'WELFARE_FUNDS';

export interface Role {
  id: string;
  name: string;
  slug: string;
  scopeType: ScopeType;
  isSystemRole: boolean;
  isProtected: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleWithUserCount extends Role {
  userCount: number;
  permissionCount: number;
}

export interface Permission {
  id: string;
  action: ActionType;
  module: ModuleType;
}

export interface RolePermissionMatrix {
  role: Role;
  permissions: Permission[];
}

export interface CreateRoleInput {
  name: string;
  scopeType: ScopeType;
  description?: string;
  initialPermissionIds?: string[];
}

export interface UpdateRoleInput {
  name: string;
  scopeType: ScopeType;
  description?: string;
}

export interface CloneRoleInput {
  sourceRoleId: string;
  newRoleName: string;
  scopeType: ScopeType;
  description?: string;
}

export interface ModuleCategory {
  id: string;
  name: string;
  description: string;
  modules: {
    key: ModuleType;
    label: string;
    description: string;
    allowedActions: ActionType[];
  }[];
}

export const MODULE_CATEGORIES: ModuleCategory[] = [
  {
    id: 'setup',
    name: 'System Setup & Configuration',
    description: 'System-wide parameters, calendar fiscal years, statutory tax slabs, and pay heads.',
    modules: [
      {
        key: 'SYSTEM_CONTROL',
        label: 'System Control',
        description: 'Core system controls, company metadata, and operational parameters',
        allowedActions: ['VIEW', 'EDIT'],
      },
      {
        key: 'FISCAL_YEAR',
        label: 'Fiscal Year',
        description: 'Bikram Sambat fiscal year definitions, active status, and period bounds',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'LOCK'],
      },
      {
        key: 'TAX_RATES',
        label: 'Tax Rates & Slabs',
        description: 'Income tax slabs (Married/Single) and statutory deduction thresholds',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE'],
      },
      {
        key: 'PAY_HEADS',
        label: 'Pay Heads',
        description: 'Earnings, statutory deductions, SSF/CIT/PF and festival allowances',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE'],
      },
      {
        key: 'HOLIDAYS',
        label: 'Holidays',
        description: 'National, public, and branch-specific holiday calendar',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'],
      },
    ],
  },
  {
    id: 'workforce',
    name: 'Workforce Management',
    description: 'Employees, organizational hierarchy, bank details, and salary mapping.',
    modules: [
      {
        key: 'EMPLOYEES',
        label: 'Employee Directory',
        description: 'Employee master profiles, contact, joining details, and KYC documents',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'],
      },
      {
        key: 'ORG_STRUCTURE',
        label: 'Organizational Structure',
        description: 'Company branches, departments, and job designations',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE'],
      },
      {
        key: 'SALARY_MAPPING',
        label: 'Salary Structure',
        description: 'Salary revisions (basic, grade, pay heads), bulk changes and templates. Approve lets a user approve salary changes prepared by others',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'APPROVE', 'EXPORT'],
      },
      {
        key: 'HR_LETTERS',
        label: 'HR Letters',
        description: 'Formal letters to employees (appointment, confirmation, promotion, transfer, experience, NOC): Add issues a letter, Edit changes templates, Delete voids an issued letter',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE'],
      },
      {
        key: 'RECRUITMENT',
        label: 'Recruitment & Darbandi',
        description: 'Approved positions (दरबन्दी), vacancies and applicants with exam/interview marks: Add opens positions, vacancies and applicants, Edit moves stages and marks',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE'],
      },
      {
        key: 'TRAVEL',
        label: 'Travel & TA-DA',
        description: 'Travel / field-visit claims and the TA-DA rate card: Add records a claim, Edit changes drafts and the card, Approve decides, Lock marks it settled (paid)',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'APPROVE', 'LOCK'],
      },
      {
        key: 'REIMBURSEMENTS',
        label: 'Reimbursements',
        description: 'Medical, mobile, fuel and similar claims with a bill, and their types: Add records a claim, Edit changes drafts and the types, Approve decides, Lock marks a claim paid by hand (the pay run pays approved ones)',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'APPROVE', 'LOCK'],
      },
      {
        key: 'TARGETS',
        label: 'Targets & achievements',
        description: 'Monthly and yearly employee targets and the reported achievements: Add sets targets, Edit changes targets nobody has reported on, Approve closes or returns what supervisors forwarded',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'APPROVE'],
      },
      {
        key: 'ASSETS',
        label: 'Assets',
        description: 'Company assets and who holds them (laptops, phones, keys, ID cards): Add registers and issues, Edit returns and retires',
        allowedActions: ['VIEW', 'ADD', 'EDIT'],
      },
      {
        key: 'NOTICE_BOARD',
        label: 'Notice board',
        description: 'Company and branch notices on the Home screen: Add posts, Edit changes, Delete withdraws',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE'],
      },
      {
        key: 'TRAINING',
        label: 'Training',
        description: 'Training programmes, nominations, attendance, scores and service bonds: Add creates programmes and nominates, Edit changes them and marks participants',
        allowedActions: ['VIEW', 'ADD', 'EDIT'],
      },
      {
        key: 'DISCIPLINE',
        label: 'Discipline & Grievance',
        description: 'Disciplinary and grievance cases (confidential): Add opens a case, Edit investigates, adds notes and closes, Approve records the decision',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'APPROVE'],
      },
      {
        key: 'PERFORMANCE',
        label: 'Performance Evaluation',
        description: 'का.स.मू.-style evaluation cycles and marks: Add opens cycles and starts evaluations, Edit scores an assigned stage and changes the form, Approve finalizes, Lock closes a cycle',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'APPROVE', 'LOCK'],
      },
    ],
  },
  {
    id: 'time_leave',
    name: 'Time, Attendance & Leave',
    description: 'Daily attendance logs, leave balances, requests, approvals, and overtime policies.',
    modules: [
      {
        key: 'ATTENDANCE',
        label: 'Attendance',
        description: 'Punches, the monthly register, adjustments (approve), month close (lock) and shifts',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'APPROVE', 'LOCK', 'EXPORT'],
      },
      {
        key: 'LEAVE_APPLICATIONS',
        label: 'Leave Requests',
        description: 'Submitting and viewing employee leave requests and balance deductions',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE'],
      },
      {
        key: 'LEAVE_APPROVALS',
        label: 'Leave Approvals',
        description: 'Manager approval/rejection workflows for pending leave applications',
        allowedActions: ['VIEW', 'APPROVE'],
      },
      {
        key: 'LEAVE_TYPES',
        label: 'Leave Types',
        description: 'Leave types and policies: how each type is given, counted and paid out. Edit changes company types and proposes changes to statutory leave (never below the Labour Act); Approve lets a user approve changes proposed by others (company-wide roles only)',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'APPROVE'],
      },
      {
        key: 'OT_RULES',
        label: 'Overtime Rules',
        description: 'Overtime calculation rates for office days, off-days, and holidays',
        allowedActions: ['VIEW', 'ADD', 'EDIT'],
      },
    ],
  },
  {
    id: 'payroll',
    name: 'Payroll Operations',
    description: 'Monthly payroll runs, salary slip calculations, leave encashment, and loans.',
    modules: [
      {
        key: 'PAYROLL_GENERATE',
        label: 'Payroll Generation',
        description: 'Execute monthly salary calculations, statutory deductions, and net payouts',
        allowedActions: ['VIEW', 'ADD', 'LOCK'],
      },
      {
        key: 'PAYROLL_REVIEW',
        label: 'Payroll Review & Slip Overrides',
        description: 'Audit monthly payroll slips, adjust dynamic heads, and approve runs',
        allowedActions: ['VIEW', 'EDIT', 'APPROVE', 'LOCK', 'EXPORT'],
      },
      {
        key: 'LEAVE_SALARY',
        label: 'Leave Salary Encashment',
        description: 'Process voluntary/statutory leave encashment and bank disbursement',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'APPROVE', 'EXPORT'],
      },
      {
        key: 'LOANS',
        label: 'Loans & Advances',
        description: 'Manage staff loan disbursements, monthly EMI deductions, and repayments',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'APPROVE', 'EXPORT'],
      },
      {
        key: 'WELFARE_FUNDS',
        label: 'Welfare Funds',
        description: 'Staff welfare / medical / gratuity funds: monthly contributions, balances and payouts (append-only ledger). Add posts openings and payouts, Edit manages fund types',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'EXPORT'],
      },
    ],
  },
  {
    id: 'reports',
    name: 'Reports & Statutory Compliance',
    description: 'Government compliance exports, IRD tax reporting, salary sheets, and ledgers.',
    modules: [
      {
        key: 'REPORTS_SALARY_SHEET',
        label: 'Salary Sheet Report',
        description: 'Comprehensive monthly salary master sheet with all earnings and deductions',
        allowedActions: ['VIEW', 'EXPORT'],
      },
      {
        key: 'REPORTS_PAYSLIP',
        label: 'Payslip Print & Distribution',
        description: 'Individual employee payslip PDF generation and bulk print view',
        allowedActions: ['VIEW', 'EXPORT'],
      },
      {
        key: 'REPORTS_ATTENDANCE',
        label: 'Attendance & OT Report',
        description: 'Statutory 30-day attendance register, punch detail, and OT summary',
        allowedActions: ['VIEW', 'EXPORT'],
      },
      {
        key: 'REPORTS_TAX_IRD',
        label: 'Statutory returns (TDS, SSF, PF, CIT)',
        description: 'eTDS, SSF, Provident Fund and CIT deposit files and annual tax certificates',
        allowedActions: ['VIEW', 'EXPORT'],
      },
      {
        key: 'REPORTS_LEAVE',
        label: 'Leave Ledger Report',
        description: 'Annual leave allotment, taken, balance, and encashable balances ledger',
        allowedActions: ['VIEW', 'EXPORT'],
      },
      {
        key: 'REPORTS_LOAN',
        label: 'Loan & Repayment Ledger',
        description: 'Active loan balances, EMI deductions, and cash repayment history',
        allowedActions: ['VIEW', 'EXPORT'],
      },
    ],
  },
  {
    id: 'admin',
    name: 'Administration & Security',
    description: 'User logins, dynamic role permissions, and immutable audit logs.',
    modules: [
      {
        key: 'USERS_ROLES',
        label: 'Roles & User Access',
        description: 'Custom role builder, granular action-module matrix, and user role assignment',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE'],
      },
      {
        key: 'AUDIT_LOG',
        label: 'Audit Trail & Forensic Logs',
        description: 'Immutable timeline of data changes and security permission grant/revocation history',
        allowedActions: ['VIEW', 'EXPORT'],
      },
    ],
  },
  {
    id: 'self_service',
    name: 'Employee Self-Service',
    description: 'Personal profile, payslip access, leave requests, and attendance summary.',
    modules: [
      {
        key: 'SELF_SERVICE',
        label: 'Self-Service Access',
        description: 'Employee personal dashboard, payslip view, leave applications, and attendance',
        allowedActions: ['VIEW', 'ADD', 'EDIT'],
      },
    ],
  },
];
