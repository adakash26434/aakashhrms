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
  | 'SELF_SERVICE';

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
        label: 'Salary Mapping',
        description: 'Individual basic salary, grade amount, and mapped pay heads per employee',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'],
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
        label: 'Attendance & Punch Records',
        description: 'Daily punch records, shifts, work hours, and monthly attendance sync',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'LOCK', 'EXPORT'],
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
        description: 'Statutory leave types (Home, Sick, Maternity) and yearly allowances',
        allowedActions: ['VIEW', 'ADD', 'EDIT', 'DELETE'],
      },
      {
        key: 'LEAVE_RULES',
        label: 'Leave Rules',
        description: 'Encashment caps, accumulation limits, and carry-forward rules',
        allowedActions: ['VIEW', 'ADD', 'EDIT'],
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
        label: 'TDS & IRD Annex-10 Report',
        description: 'Nepal Inland Revenue Department (IRD) annual and monthly tax statement',
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
