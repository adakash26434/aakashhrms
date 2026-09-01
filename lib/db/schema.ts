import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { pgTable, timestamp, uuid, varchar, text, integer, boolean, numeric, jsonb, pgEnum, unique, date, index } from 'drizzle-orm/pg-core';


// -----------------------------------------------------------------------------
// BRANCHES TABLE
// -----------------------------------------------------------------------------
export const branches = pgTable('branches', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(), // "active" | "inactive"
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

// -----------------------------------------------------------------------------
// DEPARTMENTS TABLE
// -----------------------------------------------------------------------------
export const departments = pgTable('departments', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  branchId: uuid('branch_id').references(() => branches.id).notNull(),
  headName: varchar('head_name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(), // "active" | "inactive"
  designationCount: integer('designation_count').default(0).notNull(),
  employeeCount: integer('employee_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  branchIdIdx: index('departments_branch_id_idx').on(table.branchId),
}));

// -----------------------------------------------------------------------------
// DESIGNATIONS TABLE
// -----------------------------------------------------------------------------
export const designations = pgTable('designations', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  employeeCount: integer('employee_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  departmentIdIdx: index('designations_department_id_idx').on(table.departmentId),
}));

// -----------------------------------------------------------------------------
// FISCAL YEARS TABLE
// -----------------------------------------------------------------------------
export const fiscalYears = pgTable('fiscal_years', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  label: varchar('label', { length: 50 }).notNull(), // e.g. "FY 2081/82"
  slug: varchar('slug', { length: 50 }).notNull().unique(), // e.g. "fy-2081-82"
  
  fromMonth: integer('from_month').notNull(), // 1 to 12 (typically 4 for Shrawan)
  toMonth: integer('to_month').notNull(),     // 1 to 12 (typically 3 for Asar)
  
  startDateAD: timestamp('start_date_ad').notNull(),
  endDateAD: timestamp('end_date_ad').notNull(),
  
  // Stored as strings for display as per your architecture doc (Golden Rule)
  startDateBS: varchar('start_date_bs', { length: 20 }).notNull(),
  endDateBS: varchar('end_date_bs', { length: 20 }).notNull(),
  
  status: varchar('status', { length: 20 }).default('Active').notNull(), // "Active" | "Locked"
  payslipsGenerated: boolean('payslips_generated').default(false).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});


// -----------------------------------------------------------------------------
// TAX RATE SLABS TABLE
// -----------------------------------------------------------------------------
export const taxRateSlabs = pgTable('tax_rate_slabs', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // "Normal Single" | "Married" | "Widow" | "Handicapped"
  
  // Monetary/Percentage fields stored as exact numeric types
  amountFrom: numeric('amount_from', { precision: 15, scale: 2 }).notNull(),
  amountTo: numeric('amount_to', { precision: 15, scale: 2 }), // null means "and above"
  ratePercent: numeric('rate_percent', { precision: 5, scale: 2 }).notNull(),
  fixedDeduction: numeric('fixed_deduction', { precision: 15, scale: 2 }).default('0').notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  fiscalYearIdIdx: index('tax_rate_slabs_fiscal_year_id_idx').on(table.fiscalYearId),
}));


// -----------------------------------------------------------------------------
// PAY HEADS TABLE
// -----------------------------------------------------------------------------
export const payHeads = pgTable('pay_heads', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  
  // "allowance" | "deduction"
  type: varchar('type', { length: 20 }).notNull(),
  
  effectOnTax: boolean('effect_on_tax').default(false).notNull(),
  
  // "BasicSalary" | "BasicPlusGrade" | "None"
  calcBasis: varchar('calc_basis', { length: 50 }).notNull(),
  // "BasicSalary" | "BasicPlusGrade" | "FixedAmount"
  calcParameter: varchar('calc_parameter', { length: 50 }).notNull(),
  calcPercent: numeric('calc_percent', { precision: 5, scale: 2 }).default('0').notNull(),
  
  // Arrays of UUIDs stored as JSONB
  applicableDepartmentIds: text('applicable_department_ids').array().notNull().default(sql`ARRAY[]::text[]`),
  applicableDesignationIds: text('applicable_designation_ids').array().notNull().default(sql`ARRAY[]::text[]`),

  // 9 Statutory Flags (from Excel)
  isFestivalAllowance: boolean('is_festival_allowance').default(false).notNull(),
  isAbsentDeduct: boolean('is_absent_deduct').default(false).notNull(),
  isOtHead: boolean('is_ot_head').default(false).notNull(),
  isLeaveHead: boolean('is_leave_head').default(false).notNull(),
  isTdsHead: boolean('is_tds_head').default(false).notNull(),
  isPfHead: boolean('is_pf_head').default(false).notNull(),
  isSsfHead: boolean('is_ssf_head').default(false).notNull(),
  isRemoteAllowance: boolean('is_remote_allowance').default(false).notNull(),
  isCitHead: boolean('is_cit_head').default(false).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});


// -----------------------------------------------------------------------------
// SYSTEM CONFIGURATION (Key-Value Store)
// -----------------------------------------------------------------------------
export const systemConfig = pgTable('system_config', {
  key: varchar('key', { length: 100 }).primaryKey(), // e.g., "insuranceDiscounts.womenDiscountPercent"
  value: text('value').notNull(),                    // e.g., "10"
  dataType: varchar('data_type', { length: 20 }).notNull(), // "number", "boolean", "string", "json"
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});


// -----------------------------------------------------------------------------
// HOLIDAYS TABLE
// -----------------------------------------------------------------------------
export const holidays = pgTable('holidays', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), 
  
  // Bikram Sambat strings "YYYY-MM-DD"
  startDate: varchar('start_date', { length: 20 }).notNull(),
  endDate: varchar('end_date', { length: 20 }).notNull(),

  // NEW: Gregorian (AD) Date objects
  startDateAD: timestamp('start_date_ad').notNull(),
  endDateAD: timestamp('end_date_ad').notNull(),
  
  branchIds: text('branch_ids').array().notNull().default(sql`ARRAY[]::text[]`),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});


// -----------------------------------------------------------------------------
// ENUMS FOR PERMISSIONS & SCOPING
// -----------------------------------------------------------------------------
export const actionEnum = pgEnum('action', ['VIEW', 'ADD', 'EDIT', 'DELETE', 'APPROVE', 'EXPORT', 'LOCK']);

export const moduleEnum = pgEnum('module', [
  'SYSTEM_CONTROL', 'FISCAL_YEAR', 'TAX_RATES', 'PAY_HEADS', 'HOLIDAYS',
  'EMPLOYEES', 'SALARY_MAPPING', 'ATTENDANCE', 'LEAVE_APPLICATIONS',
  'LEAVE_APPROVALS', 'OT_RULES', 'LEAVE_RULES', 'LEAVE_TYPES', 'PAYROLL_GENERATE', 'PAYROLL_REVIEW',
  'LEAVE_SALARY', 'LOANS', 'REPORTS_SALARY_SHEET', 'REPORTS_PAYSLIP',
  'REPORTS_ATTENDANCE', 'REPORTS_TAX_IRD', 'REPORTS_LEAVE', 'REPORTS_LOAN', 'USERS_ROLES', 'AUDIT_LOG',
  'ORG_STRUCTURE', 'SELF_SERVICE'
]);

export const scopeTypeEnum = pgEnum('scope_type', ['GLOBAL', 'BRANCH', 'DEPARTMENT', 'SELF']);
export const payrollRunStatusEnum = pgEnum('payroll_run_status', ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'LOCKED']);
export const leaveSalaryRunStatusEnum = pgEnum('leave_salary_run_status', ['DRAFT', 'PAID']);

// -----------------------------------------------------------------------------
// 1. EMPLOYEE GROUPS (Organizational Grade - Not Permissions)
// -----------------------------------------------------------------------------
export const employeeGroups = pgTable('employee_groups', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(), // e.g., "Entry-Level Staff"
  rankOrder: integer('rank_order').notNull(), // For sorting dropdowns
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

// -----------------------------------------------------------------------------
// 2. SYSTEM ROLES (The Group a User Belongs To)
// -----------------------------------------------------------------------------
export const roles = pgTable('roles', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(), // e.g., "HR Manager"
  slug: varchar('slug', { length: 255 }).notNull().unique(), // e.g., "hr_manager"
  scopeType: scopeTypeEnum('scope_type').notNull(),
  isSystemRole: boolean('is_system_role').default(false).notNull(), // Protects core roles from deletion
  isProtected: boolean('is_protected').default(false).notNull(),   // Multi-tenant protection for office_admin & employee
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

// -----------------------------------------------------------------------------
// 3. PERMISSIONS (The Fixed Action x Module Matrix)
// -----------------------------------------------------------------------------
export const permissions = pgTable('permissions', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  action: actionEnum('action').notNull(),
  module: moduleEnum('module').notNull(),
  // We use a composite unique constraint so you can't have duplicate VIEW + TAX_RATES rows
}, (t) => ({
  unq: unique().on(t.action, t.module),
}));

// -----------------------------------------------------------------------------
// 4. ROLE PERMISSIONS (The Join Table tying Roles to Permissions)
// -----------------------------------------------------------------------------
export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: uuid('permission_id').references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
}, (t) => ({
  unq: unique().on(t.roleId, t.permissionId),
}));

// -----------------------------------------------------------------------------
// 5. USERS (Software Login Accounts)
// -----------------------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  // employeeId will be a FK once we build the employees table in Phase 2!
  name: varchar('name', { length: 255 }),
  employeeId: uuid('employee_id'), // Nullable because IT Admins might not be employees
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  lockedUntil: timestamp('locked_until'),
  mustChangePassword: boolean('must_change_password').default(false).notNull(),
  
  // Enterprise Feature: Delegation
  delegatedToUserId: uuid('delegated_to_user_id'), // Self-referencing FK not strictly enforced here to avoid circular logic
  delegatedUntil: timestamp('delegated_until'),

  // Enterprise Feature: Scoping
  assignedBranchIds: text('assigned_branch_ids').array().notNull().default(sql`ARRAY[]::text[]`),
  assignedDepartmentIds: text('assigned_department_ids').array().notNull().default(sql`ARRAY[]::text[]`),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

// -----------------------------------------------------------------------------
// 6. USER ROLES (Many-to-Many linking Users to Roles)
// -----------------------------------------------------------------------------
export const userRoles = pgTable('user_roles', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
}, (t) => ({
  unq: unique().on(t.userId, t.roleId),
}));

// -----------------------------------------------------------------------------
// 7. AUDIT LOGS (Dual Trail Logging)
// -----------------------------------------------------------------------------
// A: The Data Audit Log (Tracking changes to payroll data)
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  userId: uuid('user_id').references(() => users.id), // Nullable for system-generated events
  roleIdAtTime: uuid('role_id_at_time'), // Critical for forensic auditing
  action: actionEnum('action').notNull(),
  module: moduleEnum('module').notNull(),
  recordId: varchar('record_id', { length: 255 }), // Can be UUID or string code
  result: varchar('result', { length: 50 }).notNull(), // 'SUCCESS', 'DENIED_PERMISSION', 'DENIED_SCOPE'
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
}));

// B: The Permission Change Log (Tracking when Admins change security rules)
export const rolePermissionChangeLog = pgTable('role_permission_change_log', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  changedByUserId: uuid('changed_by_user_id').references(() => users.id).notNull(),
  roleId: uuid('role_id').references(() => roles.id).notNull(),
  permissionId: uuid('permission_id').references(() => permissions.id).notNull(),
  changeType: varchar('change_type', { length: 20 }).notNull(), // 'GRANTED' or 'REVOKED'
  affectedRoleName: varchar('affected_role_name', { length: 255 }).notNull(), // Snapshot
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  changedByUserIdIdx: index('role_permission_change_log_changed_by_user_id_idx').on(table.changedByUserId),
  roleIdIdx: index('role_permission_change_log_role_id_idx').on(table.roleId),
  permissionIdIdx: index('role_permission_change_log_permission_id_idx').on(table.permissionId),
}));


// -----------------------------------------------------------------------------
// EMPLOYEES TABLE (The Hub)
// -----------------------------------------------------------------------------
export const employees = pgTable('employees', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeCode: varchar('employee_code', { length: 50 }).notNull().unique(),
  attendanceCode: varchar('attendance_code', { length: 50 }).notNull().unique(),
  
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  gender: varchar('gender', { length: 20 }).notNull(), // "Male", "Female", "Other"
  dateOfBirth: date('date_of_birth').notNull(),
  
  taxStatus: varchar('tax_status', { length: 50 }).notNull(),
  isDisabled: boolean('is_disabled').default(false).notNull(),
  
  // Office Info
  category: varchar('category', { length: 50 }).notNull(), // "Permanent", "Contract", etc.
  shreni: varchar('shreni', { length: 100 }), // Level/Tier
  
  // Organizational Links
  departmentId: uuid('department_id').references(() => departments.id).notNull(),
  designationId: uuid('designation_id').references(() => designations.id).notNull(),
  branchId: uuid('branch_id').references(() => branches.id).notNull(),
  employeeGroupId: uuid('employee_group_id').references(() => employeeGroups.id, { onDelete: 'set null' }),
  supervisorId: uuid('supervisor_id'), // Self-referencing FK added in logic, left as plain uuid here
  
  // Dates
  joiningDate: date('joining_date').notNull(),
  confirmationDate: date('confirmation_date'),
  retirementDateProjected: date('retirement_date_projected'),

  salaryGrade: varchar('salary_grade', { length: 50 }),
  gradePercent: integer('grade_percent').default(0),
  gradeAmount: numeric('grade_amount', { precision: 15, scale: 2 }).default('0'),
  
  status: varchar('status', { length: 50 }).default('Active').notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  departmentIdIdx: index('employees_department_id_idx').on(table.departmentId),
  designationIdIdx: index('employees_designation_id_idx').on(table.designationId),
  branchIdIdx: index('employees_branch_id_idx').on(table.branchId),
  employeeGroupIdIdx: index('employees_employee_group_id_idx').on(table.employeeGroupId),
  statusIdx: index('employees_status_idx').on(table.status),
}));

// -----------------------------------------------------------------------------
// EMPLOYEE PERSONAL INFO
// -----------------------------------------------------------------------------
export const employeePersonal = pgTable('employee_personal', {
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).primaryKey(),
  citizenshipNo: varchar('citizenship_no', { length: 100 }).notNull(),
  issuingDistrict: varchar('issuing_district', { length: 100 }).notNull(),
  nidNo: varchar('nid_no', { length: 100 }),
  nidIssuingDistrict: varchar('nid_issuing_district', { length: 100 }),
  passportNo: varchar('passport_no', { length: 100 }),
  passportIssuingDistrict: varchar('passport_issuing_district', { length: 100 }),
  votersId: varchar('voters_id', { length: 100 }),
  voterIdIssuingDistrict: varchar('voter_id_issuing_district', { length: 100 }),
  panNumber: varchar('pan_number', { length: 50 }),
  phoneHome: varchar('phone_home', { length: 50 }),
  mobileNo: varchar('mobile_no', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  companyEmail: varchar('company_email', { length: 255 }),
  personalEmail: varchar('personal_email', { length: 255 }),
  permanentAddress: text('permanent_address').notNull(),
  temporaryAddress: text('temporary_address'),
});

// -----------------------------------------------------------------------------
// EMPLOYEE FAMILY INFO
// -----------------------------------------------------------------------------
export const employeeFamily = pgTable('employee_family', {
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).primaryKey(),
  fatherName: varchar('father_name', { length: 255 }),
  motherName: varchar('mother_name', { length: 255 }),
  spouseName: varchar('spouse_name', { length: 255 }),
  grandfatherName: varchar('grandfather_name', { length: 255 }),
});

// -----------------------------------------------------------------------------
// EMPLOYEE BANK DETAILS
// -----------------------------------------------------------------------------
export const employeeBank = pgTable('employee_bank', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  bankName: varchar('bank_name', { length: 255 }).notNull(),
  branchName: varchar('branch_name', { length: 255 }).notNull(),
  accountNumber: varchar('account_number', { length: 100 }).notNull(),
  isPrimary: boolean('is_primary').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => ({
  employeeIdIdx: index('employee_bank_employee_id_idx').on(table.employeeId),
}));

// -----------------------------------------------------------------------------
// EMPLOYEE TERMINATION DETAILS
// -----------------------------------------------------------------------------
export const employeeTermination = pgTable('employee_termination', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  informedDate: date('informed_date'),
  terminationDate: date('termination_date'),
  type: varchar('type', { length: 100 }), // "Resignation", "Retirement", etc.
  reason: text('reason'),
  plan: varchar('plan', { length: 100 }), // "Pension", "Gratuity", etc.
  remarks: text('remarks'),
}, (table) => ({
  employeeIdIdx: index('employee_termination_employee_id_idx').on(table.employeeId),
}));

/**
 * EMPLOYEE SALARY MAP (The Base Record)
 * Links an employee to a fiscal year's salary structure: Basic Salary, Grade %, 
 * Grade Amount, Loan deduction placeholders, and computed Net Amount.
 */
export const employeeSalaryMap = pgTable('employee_salary_map', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  
  // Organizational & Temporal Links
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'restrict' }).notNull(),
  effectiveFrom: date('effective_from').notNull(), // Stored as YYYY-MM-DD
  
  // Core Base Components (Stored as NUMERIC(15, 2) in DB, mapped to Number in JS)
  basicSalary: numeric('basic_salary', { precision: 15, scale: 2 }).notNull(),
  gradePercent: numeric('grade_percent', { precision: 5, scale: 2 }).default('0').notNull(),
  gradeAmount: numeric('grade_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  
  // Loan Deduction Placeholders (Matching Excel Sheet columns & SalaryMapping type)
  loan1Deduction: numeric('loan1_deduction', { precision: 15, scale: 2 }).default('0').notNull(),
  loan2Deduction: numeric('loan2_deduction', { precision: 15, scale: 2 }).default('0').notNull(),
  
  // Cached Computed Net Amount (For rapid reporting & payroll grid generation)
  netAmount: numeric('net_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  
  // Audit & Status
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').default(true).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  employeeIdIdx: index('employee_salary_map_employee_id_idx').on(table.employeeId),
  fiscalYearIdIdx: index('employee_salary_map_fiscal_year_id_idx').on(table.fiscalYearId),
  createdByIdx: index('employee_salary_map_created_by_idx').on(table.createdBy),
}));

/**
 * 2. EMPLOYEE SALARY HEADS (One-to-Many Dynamic Assignments)
 * Stores individual allowances and deductions assigned to a salary mapping.
 * Links to `pay_heads` master to inherit statutory flags (PF, SSF, CIT, Taxability).
 */
export const employeeSalaryHeads = pgTable('employee_salary_heads', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  
  // Parent Salary Map FK (Cascades when the parent salary map is deleted)
  salaryMapId: uuid('salary_map_id').references(() => employeeSalaryMap.id, { onDelete: 'cascade' }).notNull(),
  
  // Pay Head FK (Restricted: prevents deleting a Pay Head if assigned to employee salaries)
  payHeadId: uuid('pay_head_id').references(() => payHeads.id, { onDelete: 'restrict' }).notNull(),
  
  // Assignment Amount in NPR
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  isChangeable: boolean('is_changeable').default(true).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  salaryMapIdIdx: index('employee_salary_heads_salary_map_id_idx').on(table.salaryMapId),
  payHeadIdIdx: index('employee_salary_heads_pay_head_id_idx').on(table.payHeadId),
}));



// =============================================================================
// PHASE 4: TIME & LEAVE / ATTENDANCE & OT ENGINE
// =============================================================================

/**
 * 1. LEAVE TYPES (Master Configuration)
 * Defines statutory (Nepal Labour Act 2074) and company-custom leave categories.
 * Statutory types: Home Leave, Sick Leave, Maternity, Paternity, Mourning, Substitute.
 */
export const leaveTypes = pgTable('leave_types', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  leaveType: varchar('leave_type', { length: 20 }).notNull(), // "Pay" | "Non-Pay" | "Partial-Pay"
  noOfDays: numeric('no_of_days', { precision: 5, scale: 1 }).notNull(),
  carryForward: boolean('carry_forward').default(false).notNull(),
  
  // Statutory & Accumulation Fields (Nepal Labour Act 2074)
  accumulationCap: numeric('accumulation_cap', { precision: 5, scale: 1 }),  // Max days that can accumulate (e.g. 90 for Home, 45 for Sick)
  maxPaidDays: numeric('max_paid_days', { precision: 5, scale: 1 }),         // For partial-pay leaves (e.g. 60 for Maternity)
  isStatutory: boolean('is_statutory').default(false).notNull(),              // True = Nepal Labour Act mandatory, cannot be deleted
  statutoryCode: varchar('statutory_code', { length: 50 }),                   // "HOME" | "SICK" | "MATERNITY" | "PATERNITY" | "MOURNING" | "SUBSTITUTE"
  genderApplicable: varchar('gender_applicable', { length: 20 }).default('All').notNull(), // "All" | "Male" | "Female"
  requiresDocument: boolean('requires_document').default(false).notNull(),    // True if medical/death cert required
  documentThresholdDays: integer('document_threshold_days'),                   // e.g. 3 for sick leave (cert after 3 consecutive days)
  isEncashable: boolean('is_encashable').default(false).notNull(),            // Whether excess can be encashed at FY-end
  encashmentBasis: varchar('encashment_basis', { length: 50 }),               // "BasicSalary" (Nepal Labour Act: basic remuneration)
  proRataForNewJoinees: boolean('pro_rata_for_new_joinees').default(true).notNull(), // Pro-rata allotment for mid-year joining
  
  applicableDepartments: text('applicable_departments').array().notNull().default(sql`ARRAY[]::text[]`),
  applicableDesignations: text('applicable_designations').array().notNull().default(sql`ARRAY[]::text[]`),
  isPlatformLocked: boolean('is_platform_locked').default(false).notNull(), // Lock statutory rules published by Super Admin
  platformCode: varchar('platform_code', { length: 100 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

/**
 * 2. EMPLOYEE LEAVE BALANCES (Ledger)
 * Tracks allotted, taken, carried forward, and remaining leave per employee per FY.
 */
export const employeeLeaveBalances = pgTable('employee_leave_balances', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id, { onDelete: 'restrict' }).notNull(),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'restrict' }).notNull(),
  allotted: numeric('allotted', { precision: 5, scale: 1 }).default('0').notNull(),
  taken: numeric('taken', { precision: 5, scale: 1 }).default('0').notNull(),
  carriedForward: numeric('carried_forward', { precision: 5, scale: 1 }).default('0').notNull(),
  balance: numeric('balance', { precision: 5, scale: 1 }).default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  unq: unique().on(t.employeeId, t.leaveTypeId, t.fiscalYearId),
  leaveTypeIdIdx: index('employee_leave_balances_leave_type_id_idx').on(t.leaveTypeId),
  fiscalYearIdIdx: index('employee_leave_balances_fiscal_year_id_idx').on(t.fiscalYearId),
}));

/**
 * 3. LEAVE APPLICATIONS (Workflow & Audit)
 * Stores leave requests, supervisor reviews, and approval timestamps.
 */
export const leaveApplications = pgTable('leave_applications', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id, { onDelete: 'restrict' }).notNull(),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'restrict' }).notNull(),
  appliedDate: date('applied_date').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to').notNull(),
  duration: varchar('duration', { length: 20 }).notNull(), // "Full Day" | "Half Day"
  noOfDays: numeric('no_of_days', { precision: 5, scale: 1 }).notNull(),
  reason: text('reason').notNull(),
  remarks: text('remarks'),
  status: varchar('status', { length: 20 }).default('Pending').notNull(), // "Pending" | "Approved" | "Rejected" | "Cancelled"
  reviewedById: uuid('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  reviewRemarks: text('review_remarks'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  employeeIdIdx: index('leave_applications_employee_id_idx').on(table.employeeId),
  leaveTypeIdIdx: index('leave_applications_leave_type_id_idx').on(table.leaveTypeId),
  fiscalYearIdIdx: index('leave_applications_fiscal_year_id_idx').on(table.fiscalYearId),
  reviewedByIdIdx: index('leave_applications_reviewed_by_id_idx').on(table.reviewedById),
  statusIdx: index('leave_applications_status_idx').on(table.status),
  effectiveRangeIdx: index('leave_applications_effective_range_idx').on(table.effectiveFrom, table.effectiveTo),
}));

/**
 * 4. OVERTIME (OT) RULES (Master Configuration)
 * Defines hourly or fixed calculation rates for office days vs off days.
 */
export const otRules = pgTable('ot_rules', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  ruleType: varchar('rule_type', { length: 20 }).notNull(), // "Hourly" | "Fixed"
  ruleName: varchar('rule_name', { length: 255 }).notNull().unique(),
  rateOfficeDay: numeric('rate_office_day', { precision: 10, scale: 2 }).default('0').notNull(),
  rateOffDay: numeric('rate_off_day', { precision: 10, scale: 2 }).default('0').notNull(),
  isPlatformLocked: boolean('is_platform_locked').default(false).notNull(),
  platformCode: varchar('platform_code', { length: 100 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

/**
 * 5. LEAVE RULES (Master Configuration — Nepal Labour Act 2074)
 * Defines accrual methods, encashment rates, and statutory vs company leave policies.
 * Each rule links to a leaveType to define how that type's days are earned and encashed.
 */
export const leaveRules = pgTable('leave_rules', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id, { onDelete: 'restrict' }).notNull(),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'restrict' }), // Null = global/all FYs
  ruleName: varchar('rule_name', { length: 255 }).notNull(),
  ruleCategory: varchar('rule_category', { length: 30 }).notNull(),           // "STATUTORY" | "COMPANY"
  accrualMethod: varchar('accrual_method', { length: 30 }).notNull(),         // "FIXED_ANNUAL" | "DAYS_WORKED" | "MONTHLY_ACCRUAL"
  accrualValue: numeric('accrual_value', { precision: 10, scale: 2 }).notNull(), // e.g. 18 (FIXED_ANNUAL), 20 (1 per 20 days for DAYS_WORKED)
  encashmentRate: varchar('encashment_rate', { length: 30 }).default('BASIC_DAILY'), // "BASIC_DAILY" | "FIXED_AMOUNT"
  encashmentFixedAmount: numeric('encashment_fixed_amount', { precision: 15, scale: 2 }).default('0'),
  minServiceDaysForEligibility: integer('min_service_days_for_eligibility').default(0), // Min days worked to earn leave
  isPlatformLocked: boolean('is_platform_locked').default(false).notNull(),
  platformCode: varchar('platform_code', { length: 100 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  leaveTypeIdIdx: index('leave_rules_leave_type_id_idx').on(table.leaveTypeId),
  fiscalYearIdIdx: index('leave_rules_fiscal_year_id_idx').on(table.fiscalYearId),
}));

/**
 * 6. DAILY ATTENDANCE RECORDS (Punches & Manual Overrides)
 * Tracks daily presence, punch times, grace window violations, and overtime hours.
 */
export const attendanceRecords = pgTable('attendance_records', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'restrict' }).notNull(),
  attendanceDate: date('attendance_date').notNull(), // Stored as YYYY-MM-DD
  status: varchar('status', { length: 30 }).notNull(), // "Present" | "Absent" | "Half Day" | "On Leave" | "LWOP" | "Holiday" | "Weekly Off"
  inTime: varchar('in_time', { length: 20 }), // e.g. "10:05 AM"
  outTime: varchar('out_time', { length: 20 }), // e.g. "05:15 PM"
  workHours: numeric('work_hours', { precision: 5, scale: 2 }).default('0').notNull(),
  otHoursOfficeDay: numeric('ot_hours_office_day', { precision: 5, scale: 2 }).default('0').notNull(),
  otHoursOffDay: numeric('ot_hours_off_day', { precision: 5, scale: 2 }).default('0').notNull(),
  isLate: boolean('is_late').default(false).notNull(), // True if inTime exceeds office start + grace window
  isManualEntry: boolean('is_manual_entry').default(false).notNull(), // True if HR manual punch override
  remarks: text('remarks'),
  isLocked: boolean('is_locked').default(false).notNull(), // Locked when monthly calculation runs
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  employeeIdIdx: index('attendance_records_employee_id_idx').on(table.employeeId),
  fiscalYearIdIdx: index('attendance_records_fiscal_year_id_idx').on(table.fiscalYearId),
  attendanceDateIdx: index('attendance_records_attendance_date_idx').on(table.attendanceDate),
  empDateIdx: index('attendance_records_emp_date_idx').on(table.employeeId, table.attendanceDate),
  statusIdx: index('attendance_records_status_idx').on(table.status),
}));

/**
 * MONTHLY LEAVE & OT CALCULATION LOCKS (The Pre-Payroll Bridge)
 * Summarizes monthly attendance/leave/OT per employee and locks the period for Phase 6 payroll.
 */
export const leaveOtCalculations = pgTable('leave_ot_calculations', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'restrict' }).notNull(),
  bsMonth: integer('bs_month').notNull(), // 1 to 12 (Baisakh to Chaitra)
  totalWorkingDays: numeric('total_working_days', { precision: 5, scale: 1 }).default('0').notNull(),
  presentDays: numeric('present_days', { precision: 5, scale: 1 }).default('0').notNull(),
  absentDays: numeric('absent_days', { precision: 5, scale: 1 }).default('0').notNull(),
  payLeaveDays: numeric('pay_leave_days', { precision: 5, scale: 1 }).default('0').notNull(),
  nonPayLeaveDays: numeric('non_pay_leave_days', { precision: 5, scale: 1 }).default('0').notNull(),
  totalOtHoursOffice: numeric('total_ot_hours_office', { precision: 6, scale: 2 }).default('0').notNull(),
  totalOtHoursOff: numeric('total_ot_hours_off', { precision: 6, scale: 2 }).default('0').notNull(),
  
  // Computed Financial Results ready for Payslip consumption
  otEarnedAmount: numeric('ot_earned_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  leaveDeductionAmount: numeric('leave_deduction_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  
  otWarnings: text('ot_warnings'),

  // Lock Control
  isLocked: boolean('is_locked').default(false).notNull(),
  lockedById: uuid('locked_by_id').references(() => users.id, { onDelete: 'set null' }),
  lockedAt: timestamp('locked_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  unq: unique().on(t.employeeId, t.fiscalYearId, t.bsMonth),
  fyMonthIdx: index('leave_ot_calculations_fy_month_idx').on(t.fiscalYearId, t.bsMonth),
}));

// =============================================================================
// PHASE 5: STAFF LOANS MODULE
// =============================================================================

/**
 * 1. LOAN TYPES (Configuration)
 * Defines parameters for different loan types like Advance, Personal, etc.
 */
export const loanTypes = pgTable('loan_types', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(), // e.g., "Personal Loan"
  maxAmount: numeric('max_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  maxInstallments: integer('max_installments').default(0).notNull(),
  interestRate: numeric('interest_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

/**
 * 2. LOANS (Disbursements)
 * Tracks the loan amount given to an employee and fixed deduction parameters.
 */
export const loans = pgTable('loans', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'restrict' }).notNull(),
  loanTypeId: uuid('loan_type_id').references(() => loanTypes.id, { onDelete: 'restrict' }).notNull(),
  givenDate: date('given_date').notNull(), // YYYY-MM-DD
  
  // Financials
  loanAmount: numeric('loan_amount', { precision: 15, scale: 2 }).notNull(),
  installmentAmount: numeric('installment_amount', { precision: 15, scale: 2 }).notNull(),
  noOfInstallments: integer('no_of_installments').notNull(),
  
  totalReturned: numeric('total_returned', { precision: 15, scale: 2 }).default('0').notNull(),
  remainingAmount: numeric('remaining_amount', { precision: 15, scale: 2 }).notNull(),
  
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(), // "ACTIVE" | "CLOSED"
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  employeeIdIdx: index('loans_employee_id_idx').on(table.employeeId),
  loanTypeIdIdx: index('loans_loan_type_id_idx').on(table.loanTypeId),
}));

/**
 * 3. LOAN REPAYMENTS (Ledger)
 * Stores every repayment record (both payroll deductions and manual cash deposits).
 */
export const loanRepayments = pgTable('loan_repayments', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  loanId: uuid('loan_id').references(() => loans.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'restrict' }).notNull(),
  repaymentDate: date('repayment_date').notNull(), // YYYY-MM-DD
  amountPaid: numeric('amount_paid', { precision: 15, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(), // "CASH" | "SALARY_DEDUCTION"
  
  // Future-proof for Phase 6
  payrollSlipId: uuid('payroll_slip_id').references(() => payrollSlips.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  loanIdIdx: index('loan_repayments_loan_id_idx').on(table.loanId),
  employeeIdIdx: index('loan_repayments_employee_id_idx').on(table.employeeId),
  payrollSlipIdIdx: index('loan_repayments_payroll_slip_id_idx').on(table.payrollSlipId),
  createdByIdx: index('loan_repayments_created_by_idx').on(table.createdBy),
}));

// =============================================================================
// PHASE 6: PAYROLL MODULE
// =============================================================================

export const payrollRuns = pgTable('payroll_runs', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'restrict' }).notNull(),
  payPeriodMonth: integer('pay_period_month').notNull(), // 1 to 12 (BS month number)
  payPeriodYear: integer('pay_period_year').notNull(),   // e.g. 2082 (BS year)
  payPeriodStartDate: date('pay_period_start_date').notNull(), // AD date first day of month
  payPeriodEndDate: date('pay_period_end_date').notNull(),     // AD date last day of month
  branchIds: text('branch_ids').array().notNull().default(sql`ARRAY[]::text[]`),
  departmentIds: text('department_ids').array().default(sql`ARRAY[]::text[]`), // Nullable = all
  designationIds: text('designation_ids').array().notNull().default(sql`ARRAY[]::text[]`),
  employeeCategories: text('employee_categories').array().notNull().default(sql`ARRAY[]::text[]`),
  employeeIds: text('employee_ids').array().notNull().default(sql`ARRAY[]::text[]`),
  occasionalAllowanceHeadIds: text('occasional_allowance_head_ids').array().notNull().default(sql`ARRAY[]::text[]`),
  payslipMonth: integer('payslip_month'),
  payslipDate: varchar('payslip_date', { length: 20 }),
  status: payrollRunStatusEnum('status').default('DRAFT').notNull(),
  
  totalGross: numeric('total_gross', { precision: 15, scale: 2 }).default('0').notNull(),
  totalDeductions: numeric('total_deductions', { precision: 15, scale: 2 }).default('0').notNull(),
  totalNetPayable: numeric('total_net_payable', { precision: 15, scale: 2 }).default('0').notNull(),
  totalTds: numeric('total_tds', { precision: 15, scale: 2 }).default('0').notNull(),
  totalPf: numeric('total_pf', { precision: 15, scale: 2 }).default('0').notNull(),
  totalSsf: numeric('total_ssf', { precision: 15, scale: 2 }).default('0').notNull(),
  employeeCount: integer('employee_count').default(0).notNull(),
  
  generatedBy: uuid('generated_by').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at'),
  lockedAt: timestamp('locked_at'),
  notes: text('notes'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  fiscalYearIdIdx: index('payroll_runs_fiscal_year_id_idx').on(table.fiscalYearId),
  generatedByIdx: index('payroll_runs_generated_by_idx').on(table.generatedBy),
  reviewedByIdx: index('payroll_runs_reviewed_by_idx').on(table.reviewedBy),
  approvedByIdx: index('payroll_runs_approved_by_idx').on(table.approvedBy),
}));

export const payrollSlips = pgTable('payroll_slips', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  payrollRunId: uuid('payroll_run_id').references(() => payrollRuns.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'restrict' }).notNull(),
  employeeCode: varchar('employee_code', { length: 50 }).notNull(),
  employeeName: varchar('employee_name', { length: 255 }).notNull(),
  departmentName: varchar('department_name', { length: 255 }).notNull(),
  designationName: varchar('designation_name', { length: 255 }).notNull(),
  basicSalary: numeric('basic_salary', { precision: 15, scale: 2 }).notNull(),
  gradeAmount: numeric('grade_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  grossEarnings: numeric('gross_earnings', { precision: 15, scale: 2 }).default('0').notNull(),
  totalDeductions: numeric('total_deductions', { precision: 15, scale: 2 }).default('0').notNull(),
  netPayable: numeric('net_payable', { precision: 15, scale: 2 }).default('0').notNull(),
  taxableIncome: numeric('taxable_income', { precision: 15, scale: 2 }).default('0').notNull(),
  tdsThisMonth: numeric('tds_this_month', { precision: 15, scale: 2 }).default('0').notNull(),
  pfEmployee: numeric('pf_employee', { precision: 15, scale: 2 }).default('0').notNull(),
  pfEmployer: numeric('pf_employer', { precision: 15, scale: 2 }).default('0').notNull(),
  ssfEmployee: numeric('ssf_employee', { precision: 15, scale: 2 }).default('0').notNull(),
  ssfEmployer: numeric('ssf_employer', { precision: 15, scale: 2 }).default('0').notNull(),
  citDeduction: numeric('cit_deduction', { precision: 15, scale: 2 }).default('0').notNull(),
  loanDeduction: numeric('loan_deduction', { precision: 15, scale: 2 }).default('0').notNull(),
  absentDeduction: numeric('absent_deduction', { precision: 15, scale: 2 }).default('0').notNull(),
  otAmount: numeric('ot_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  bankAccountNumber: varchar('bank_account_number', { length: 100 }).notNull(),
  bankName: varchar('bank_name', { length: 255 }).notNull(),
  payslipMonth: integer('payslip_month'),
  payslipDate: varchar('payslip_date', { length: 20 }),
  status: varchar('status', { length: 20 }).default('DRAFT').notNull(), // "DRAFT" | "LOCKED"
  isYearEndReconciliation: boolean('is_year_end_reconciliation').default(false).notNull(),
  warnings: text('warnings'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  payrollRunIdIdx: index('payroll_slips_payroll_run_id_idx').on(table.payrollRunId),
  employeeIdIdx: index('payroll_slips_employee_id_idx').on(table.employeeId),
}));

export const payrollSlipHeads = pgTable('payroll_slip_heads', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  payrollSlipId: uuid('payroll_slip_id').references(() => payrollSlips.id, { onDelete: 'cascade' }).notNull(),
  payHeadId: uuid('pay_head_id').references(() => payHeads.id, { onDelete: 'restrict' }).notNull(),
  payHeadName: varchar('pay_head_name', { length: 255 }).notNull(),
  headType: varchar('head_type', { length: 20 }).notNull(), // "allowance" | "deduction"
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  calculatedAmount: numeric('calculated_amount', { precision: 15, scale: 2 }).notNull(),
  isManualOverride: boolean('is_manual_override').default(false).notNull(),
  overrideReason: text('override_reason'),
}, (table) => ({
  payrollSlipIdIdx: index('payroll_slip_heads_payroll_slip_id_idx').on(table.payrollSlipId),
  payHeadIdIdx: index('payroll_slip_heads_pay_head_id_idx').on(table.payHeadId),
}));

export const leaveSalaryRuns = pgTable('leave_salary_runs', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  payrollRunId: uuid('payroll_run_id').references(() => payrollRuns.id, { onDelete: 'set null' }),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'restrict' }).notNull(),
  leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id, { onDelete: 'restrict' }).notNull(),
  leaveDays: numeric('leave_days', { precision: 5, scale: 2 }).notNull(),
  perDayRate: numeric('per_day_rate', { precision: 15, scale: 2 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull(),
  tdsAmount: numeric('tds_amount', { precision: 15, scale: 2 }).default('0'),
  encashmentType: varchar('encashment_type', { length: 20 }).default('VOLUNTARY').notNull(), // "ANNUAL_EXCESS" | "TERMINATION" | "VOLUNTARY"
  paymentPeriod: varchar('payment_period', { length: 20 }).notNull(), // e.g. "2082-01"
  paymentMethod: varchar('payment_method', { length: 50 }).default('BANK_TRANSFER').notNull(), // "BANK_TRANSFER" | "CASH" | "CHEQUE"
  status: leaveSalaryRunStatusEnum('status').default('DRAFT').notNull(), // "DRAFT" | "PAID"
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  unq: unique().on(t.employeeId, t.leaveTypeId, t.paymentPeriod),
  payrollRunIdIdx: index('leave_salary_runs_payroll_run_id_idx').on(t.payrollRunId),
  employeeIdIdx: index('leave_salary_runs_employee_id_idx').on(t.employeeId),
  leaveTypeIdIdx: index('leave_salary_runs_leave_type_id_idx').on(t.leaveTypeId),
  createdByIdx: index('leave_salary_runs_created_by_idx').on(t.createdBy),
}));
