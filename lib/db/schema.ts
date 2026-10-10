import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { customType, pgTable, timestamp, uuid, varchar, text, integer, boolean, numeric, jsonb, pgEnum, unique, date, index, primaryKey } from 'drizzle-orm/pg-core';


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
  isHeadOffice: boolean('is_head_office').default(false).notNull(),
  remoteCategory: varchar('remote_category', { length: 20 }).default('NONE').notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(), // "active" | "inactive"
  // 4.5b: the shift for this branch's people unless they have their own (null = company default).
  defaultShiftId: uuid('default_shift_id'),
  // 4.5c web clock-in: rule (off | anywhere | network | location | network_or_location | network_and_location),
  // office networks (addresses / ranges), office point and radius.
  checkinRule: varchar('checkin_rule', { length: 24 }).default('off').notNull(),
  checkinNetworks: text('checkin_networks').array().notNull().default(sql`ARRAY[]::text[]`),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  checkinRadiusM: integer('checkin_radius_m').default(150).notNull(),
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
  // 4.3: departments are company-wide. branch_id is no longer used (kept for old rows);
  // branch_ids limits a department to some branches (empty = all branches).
  branchId: uuid('branch_id').references(() => branches.id),
  branchIds: text('branch_ids').array().notNull().default(sql`ARRAY[]::text[]`),
  // Head picked from employees; head_name is the older typed name, kept as a fallback.
  headEmployeeId: uuid('head_employee_id'),
  headName: varchar('head_name', { length: 255 }),
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
// SHRENI / GRADE LEVELS TABLE
// -----------------------------------------------------------------------------
export const shreniLevels = pgTable('shreni_levels', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(), // e.g. "S1", "L6", "OFF-1"
  name: varchar('name', { length: 255 }).notNull(),         // e.g. "Officer Level 6" or "तह ६"
  levelNumber: integer('level_number').notNull(),           // 1 to 15+
  labelNepali: varchar('label_nepali', { length: 255 }).notNull(), // e.g. "तह ६ (अधिकृत तह)"
  description: text('description'),
  minSalary: numeric('min_salary', { precision: 15, scale: 2 }).default('0').notNull(),
  maxSalary: numeric('max_salary', { precision: 15, scale: 2 }).default('0').notNull(),
  rankOrder: integer('rank_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  levelNumberIdx: index('shreni_levels_level_number_idx').on(table.levelNumber),
  isActiveIdx: index('shreni_levels_is_active_idx').on(table.isActive),
}));

// -----------------------------------------------------------------------------
// EMPLOYMENT TYPES / CATEGORIES TABLE
// -----------------------------------------------------------------------------
export const employmentTypes = pgTable('employment_types', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(), // e.g. "PERMANENT", "CONTRACT"
  name: varchar('name', { length: 100 }).notNull(),        // "Permanent", "Contract", "Probation"
  nameNepali: varchar('name_nepali', { length: 100 }),     // "नियमित / स्थायी", "समयावधि / करार"
  isPfEligible: boolean('is_pf_eligible').default(true).notNull(),
  isSsfEligible: boolean('is_ssf_eligible').default(true).notNull(),
  isFestivalEligible: boolean('is_festival_eligible').default(true).notNull(),
  isLeaveEligible: boolean('is_leave_eligible').default(true).notNull(),
  isOtEligible: boolean('is_ot_eligible').default(true).notNull(),
  noticePeriodDays: integer('notice_period_days').default(30).notNull(),
  probationMonths: integer('probation_months').default(6).notNull(),
  rankOrder: integer('rank_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  isActiveIdx: index('employment_types_is_active_idx').on(table.isActive),
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
  category: varchar('category', { length: 50 }).notNull(), // "Normal Single" | "Married" | "Handicapped"
  
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
  isSsfEmployerHead: boolean('is_ssf_employer_head').default(false).notNull(),
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
  'ORG_STRUCTURE', 'SELF_SERVICE', 'HR_LETTERS', 'PERFORMANCE', 'RECRUITMENT', 'WELFARE_FUNDS', 'DISCIPLINE', 'TRAINING', 'ASSETS', 'NOTICE_BOARD', 'TRAVEL', 'TARGETS'
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
  /** @deprecated S2: never written (always NULL). Kept so older deploys can roll back; drop in Phase 8. */
  tempPassword: text('temp_password'),
  
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
  
  fullName: varchar('full_name', { length: 255 }).notNull(),
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
  isSupervisor: boolean('is_supervisor').default(false).notNull(),
  
  // Dates
  joiningDate: date('joining_date').notNull(),
  confirmationDate: date('confirmation_date'),

  basicSalary: numeric('basic_salary', { precision: 15, scale: 2 }).default('0'),
  gradePercent: integer('grade_percent').default(0),
  gradeCount: integer('grade_count').default(0).notNull(),
  gradeAmount: numeric('grade_amount', { precision: 15, scale: 2 }).default('0'),
  // The grade amount was typed by hand (Salary mapping → Edit); policy re-syncs leave it alone.
  gradeManual: boolean('grade_manual').default(false).notNull(),
  
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
  // F9 (migration 0067): retirement-fund numbers for the SSF / PF / CIT deposit files.
  ssfNumber: varchar('ssf_number', { length: 30 }),
  pfNumber: varchar('pf_number', { length: 30 }),
  citNumber: varchar('cit_number', { length: 30 }),
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
// EMPLOYEE IDENTITY DOCUMENTS (4.2b): one row per document type, with its scans.
// employee_personal's citizenship / NID / passport / voter columns are a mirror
// of these rows for older readers (dropped in Phase 8).
// -----------------------------------------------------------------------------
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

export const employeeDocuments = pgTable('employee_documents', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  docType: varchar('doc_type', { length: 20 }).notNull(), // citizenship | nid | passport | driving_licence | voter_id
  docNumber: varchar('doc_number', { length: 100 }).notNull(),
  issuedDistrict: varchar('issued_district', { length: 100 }).notNull(),
  issuedDate: date('issued_date'), // null only for documents copied from before 4.2b
  issuingOffice: varchar('issuing_office', { length: 150 }).default('').notNull(), // '' only for documents copied from before 4.2b
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  employeeIdIdx: index('employee_documents_employee_id_idx').on(table.employeeId),
  oneOfEachType: unique('employee_documents_employee_type_key').on(table.employeeId, table.docType),
}));

/**
 * A document's scan (one per document, front and back in one file; side is always 'scan').
 * `document_id` null = uploaded in a form that has not been saved yet (kept 24 hours).
 */
export const employeeDocumentFiles = pgTable('employee_document_files', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  documentId: uuid('document_id').references(() => employeeDocuments.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }),
  side: varchar('side', { length: 10 }).notNull(), // 'scan' (one file per document)
  /** 4.2c: set when a dossier row (qualification / work_history / attachment) owns the file; null + document_id null = not saved yet. */
  attachedTo: varchar('attached_to', { length: 20 }),
  fileName: varchar('file_name', { length: 150 }).notNull(),
  mimeType: varchar('mime_type', { length: 50 }).notNull(), // from the file's content, never the browser
  sizeBytes: integer('size_bytes').notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  content: bytea('content').notNull(),
  uploadedBy: uuid('uploaded_by').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
}, (table) => ({
  documentIdIdx: index('employee_document_files_document_id_idx').on(table.documentId),
  uploadedByIdx: index('employee_document_files_uploaded_by_idx').on(table.uploadedBy, table.uploadedAt),
  oneFilePerSide: unique('employee_document_files_document_side_key').on(table.documentId, table.side),
}));

/**
 * An employee's photo (4.2b): a 512 x 512 JPG cropped in the browser, kept in the company's
 * database. `employee_id` null = uploaded in a form that has not been saved yet (kept 24 hours).
 */
export const employeePhotos = pgTable('employee_photos', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).unique('employee_photos_employee_key'),
  mimeType: varchar('mime_type', { length: 50 }).notNull(), // from the file's content
  sizeBytes: integer('size_bytes').notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  content: bytea('content').notNull(),
  uploadedBy: uuid('uploaded_by').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
}, (table) => ({
  uploadedByIdx: index('employee_photos_uploaded_by_idx').on(table.uploadedBy, table.uploadedAt),
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
  gradeCount: integer('grade_count').default(0).notNull(),
  gradeAmount: numeric('grade_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  gradeManual: boolean('grade_manual').default(false).notNull(),
  
  // Loan Deduction Placeholders (Matching Excel Sheet columns & SalaryMapping type)
  loan1Deduction: numeric('loan1_deduction', { precision: 15, scale: 2 }).default('0').notNull(),
  loan2Deduction: numeric('loan2_deduction', { precision: 15, scale: 2 }).default('0').notNull(),
  
  // Cached Computed Net Amount (For rapid reporting & payroll grid generation)
  netAmount: numeric('net_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  
  // Audit & Status
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  // 4.4: each row is a salary revision. is_active marks the current one (the latest approved);
  // payroll picks the approved revision in force for the month by effective_from.
  isActive: boolean('is_active').default(true).notNull(),
  status: varchar('status', { length: 20 }).default('approved').notNull(), // approved | pending | rejected | withdrawn
  batchId: uuid('batch_id'),
  reason: text('reason'),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  employeeIdIdx: index('employee_salary_map_employee_id_idx').on(table.employeeId),
  batchIdIdx: index('employee_salary_map_batch_id_idx').on(table.batchId),
  fiscalYearIdIdx: index('employee_salary_map_fiscal_year_id_idx').on(table.fiscalYearId),
  createdByIdx: index('employee_salary_map_created_by_idx').on(table.createdBy),
}));

/**
 * Salary change batches (4.4): one per single revision, bulk edit or import.
 * With approval on, its revisions stay pending until someone other than the
 * preparer approves them.
 */
export const salaryChangeBatches = pgTable('salary_change_batches', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  kind: varchar('kind', { length: 20 }).notNull(), // single | bulk | import | hire | policy
  effectiveFrom: date('effective_from').notNull(),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending | approved | rejected | withdrawn
  employeeCount: integer('employee_count').default(0).notNull(),
  monthlyChange: numeric('monthly_change', { precision: 15, scale: 2 }).default('0').notNull(),
  preparedBy: uuid('prepared_by'),
  decidedBy: uuid('decided_by'),
  decidedAt: timestamp('decided_at'),
  decisionNote: text('decision_note'),
  // How it was approved: simple | levels | final_approve | not_required | on_hire | policy (null while pending)
  approvalRoute: varchar('approval_route', { length: 20 }),
  // The flow fixed at submission: none | simple | multi_level, its levels and the level waiting now
  approvalType: varchar('approval_type', { length: 20 }),
  approvalLevels: jsonb('approval_levels').$type<{ level: number; userId: string; skipped?: 'preparer' | 'own_salary' | null }[]>().default([]).notNull(),
  currentLevel: integer('current_level').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('salary_change_batches_status_idx').on(table.status),
}));

/** Approval timeline (4.4 follow-up): every step of a request (salary changes now; pay runs and loans later). */
export const approvalActions = pgTable('approval_actions', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  module: varchar('module', { length: 40 }).notNull(), // e.g. SALARY_MAPPING
  requestId: uuid('request_id').notNull(),
  level: integer('level').default(0).notNull(),
  actorId: uuid('actor_id'),
  onBehalfOf: uuid('on_behalf_of'),
  action: varchar('action', { length: 20 }).notNull(), // submitted | approved | final_approved | rejected | withdrawn | skipped | not_required
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  requestIdx: index('approval_actions_request_idx').on(table.module, table.requestId),
}));

/** Salary templates (4.4): a standard structure (basic + pay heads) for levels or designations. */
export const salaryTemplates = pgTable('salary_templates', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  levelCodes: text('level_codes').array().notNull().default(sql`ARRAY[]::text[]`),
  designationIds: text('designation_ids').array().notNull().default(sql`ARRAY[]::text[]`),
  basicMode: varchar('basic_mode', { length: 20 }).default('amount').notNull(), // amount | level_start
  basicAmount: numeric('basic_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  scheme: varchar('scheme', { length: 10 }).default('keep').notNull(), // keep | ssf | pf | none
  heads: jsonb('heads').$type<{ payHeadId: string; amount: number }[]>().notNull().default(sql`'[]'::jsonb`),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

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
  // 4.6: how the type counts and pays (null = the defaults for its statutory code).
  kind: varchar('kind', { length: 10 }), // balance | event | none
  dayBasis: varchar('day_basis', { length: 10 }), // working | calendar
  paidDaysPerEvent: numeric('paid_days_per_event', { precision: 5, scale: 1 }),
  maxDaysPerRequest: numeric('max_days_per_request', { precision: 5, scale: 1 }),
  allowHalfDay: boolean('allow_half_day').default(true).notNull(),
  isRight: boolean('is_right').default(false).notNull(), // Labour Act §51
  accrualEveryDays: integer('accrual_every_days'),
  expiryDays: integer('expiry_days'),
  // 4.6e company leave types: notice, eligibility, monthly crediting, limits, payout rate.
  noticeDays: integer('notice_days'),
  eligibleAfterDays: integer('eligible_after_days'),
  creditMode: varchar('credit_mode', { length: 10 }).default('yearly').notNull(), // yearly | monthly
  maxDaysPerYear: numeric('max_days_per_year', { precision: 5, scale: 1 }),
  maxDaysInService: numeric('max_days_in_service', { precision: 6, scale: 1 }),
  payoutFixedAmount: numeric('payout_fixed_amount', { precision: 15, scale: 2 }),
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
  // 4.6: the counted days and pay split, who raised it, the approval flow and records.
  half: varchar('half', { length: 6 }), // first | second
  daysDetail: jsonb('days_detail').$type<{ date: string; part: number; pay: 'full' | 'none' | 'half' }[]>(),
  paidDays: numeric('paid_days', { precision: 6, scale: 2 }),
  unpaidDays: numeric('unpaid_days', { precision: 6, scale: 2 }),
  source: varchar('source', { length: 20 }).default('hr').notNull(), // hr | self_service
  preparedBy: uuid('prepared_by'),
  approvalType: varchar('approval_type', { length: 20 }),
  approvalLevels: jsonb('approval_levels').$type<{ level: number; userId: string; skipped?: 'preparer' | 'own_salary' | null }[]>().default([]).notNull(),
  currentLevel: integer('current_level').default(0).notNull(),
  approvalRoute: varchar('approval_route', { length: 20 }),
  cancelReason: text('cancel_reason'),
  certificateNote: text('certificate_note'),
  ssfClaim: boolean('ssf_claim').default(false).notNull(),
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

/** 4.6: every change to a leave balance (signed days); never edited or deleted. Balance = the sum. */
export const leaveLedger = pgTable('leave_ledger', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id, { onDelete: 'restrict' }).notNull(),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'restrict' }).notNull(),
  entryDate: date('entry_date').notNull(),
  kind: varchar('kind', { length: 20 }).notNull(),
  days: numeric('days', { precision: 6, scale: 2 }).notNull(),
  applicationId: uuid('application_id'),
  note: text('note'),
  expiresOn: date('expires_on'),
  // 4.6b: what the line is for, so it is never posted twice (accrual:BS-2083-6, substitute:2026-10-10, opening:<year>, expiry:<grant>).
  ref: varchar('ref', { length: 80 }),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  empTypeYearIdx: index('leave_ledger_emp_type_year_idx').on(t.employeeId, t.leaveTypeId, t.fiscalYearId),
  applicationIdx: index('leave_ledger_application_idx').on(t.applicationId),
  refIdx: index('leave_ledger_emp_ref_idx').on(t.employeeId, t.ref),
}));

/**
 * Leave years opened (4.6b, Labour Act §49 / §50): once per fiscal year,
 * carrying balances over from the year before. The year that was current
 * when 4.6 arrived is marked opened by the migration.
 */
export const leaveYearOpenings = pgTable('leave_year_openings', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'restrict' }).notNull().unique(),
  fromFiscalYearId: uuid('from_fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'restrict' }),
  people: integer('people').default(0).notNull(),
  note: text('note'),
  openedBy: uuid('opened_by'),
  openedAt: timestamp('opened_at').defaultNow().notNull(),
});

/**
 * Leave policy changes (4.6c): every change to a leave type's settings as a version.
 * Statutory types: proposed by one person, approved by another, never below the
 * Labour Act (or an active platform exception). `after` holds only the settings that
 * change; settings for the next leave year wait until `effective_from`. System changes
 * (raised back to the law) are approved and applied at once.
 */
export const leaveTypeChanges = pgTable('leave_type_changes', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id, { onDelete: 'restrict' }).notNull(),
  before: jsonb('before').$type<Record<string, unknown>>().notNull(),
  after: jsonb('after').$type<Record<string, unknown>>().notNull(),
  reason: text('reason').notNull(),
  applies: varchar('applies', { length: 20 }).default('approval').notNull(), // approval | next_year | top_up
  effectiveFrom: date('effective_from'),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending | approved | rejected | withdrawn
  source: varchar('source', { length: 20 }).default('company').notNull(), // company | system
  exceptionId: uuid('exception_id'),
  preparedBy: uuid('prepared_by'),
  preparedAt: timestamp('prepared_at').defaultNow().notNull(),
  decidedBy: uuid('decided_by'),
  decidedAt: timestamp('decided_at'),
  decisionNote: text('decision_note'),
  approvalRoute: varchar('approval_route', { length: 20 }),
  approvalType: varchar('approval_type', { length: 20 }),
  approvalLevels: jsonb('approval_levels').$type<{ level: number; userId: string; skipped?: 'preparer' | 'own_salary' | null }[]>().default([]).notNull(),
  currentLevel: integer('current_level').default(0).notNull(),
  appliedAt: timestamp('applied_at'),
}, (table) => ({
  typeIdx: index('leave_type_changes_type_idx').on(table.leaveTypeId, table.status),
}));

/**
 * Platform exceptions (4.6d), copied from the platform read-only: an active one lowers
 * the Labour Act minimum of one setting of one statutory type, within its dates (e.g.
 * a regulator's directive). Only platform routes write this table.
 */
export const leavePolicyExceptions = pgTable('leave_policy_exceptions', {
  id: uuid('id').primaryKey(),
  statutoryCode: varchar('statutory_code', { length: 50 }).notNull(),
  setting: varchar('setting', { length: 40 }).notNull(),
  value: numeric('value', { precision: 7, scale: 1 }),
  legalBasis: text('legal_basis').notNull(),
  reference: text('reference'),
  validFrom: date('valid_from').notNull(),
  validUntil: date('valid_until'),
  revokedAt: timestamp('revoked_at'),
  revokeReason: text('revoke_reason'),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
});

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
  // 4.5: the day's result (written when the month is closed) and any HR override (an input).
  dayType: varchar('day_type', { length: 20 }),
  payable: numeric('payable', { precision: 3, scale: 2 }).default('0').notNull(),
  unpaid: numeric('unpaid', { precision: 3, scale: 2 }).default('0').notNull(),
  firstIn: timestamp('first_in', { withTimezone: true }),
  lastOut: timestamp('last_out', { withTimezone: true }),
  workMinutes: integer('work_minutes').default(0).notNull(),
  lateMinutes: integer('late_minutes').default(0).notNull(),
  earlyMinutes: integer('early_minutes').default(0).notNull(),
  otWorkMinutes: integer('ot_work_minutes').default(0).notNull(),
  otOffMinutes: integer('ot_off_minutes').default(0).notNull(),
  rule: text('rule'),
  overrideType: varchar('override_type', { length: 20 }),
  overrideReason: text('override_reason'),
  overrideBy: uuid('override_by'),
  overrideAt: timestamp('override_at'),
  // Days typed in before 4.5 were turned into overrides once (see migration 0039).
  migrated: boolean('migrated').default(true).notNull(),
  // 4.5b: the shift that applied (stored when the month is closed).
  shiftId: uuid('shift_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  empDateUnique: unique('attendance_records_emp_date_uq').on(table.employeeId, table.attendanceDate),
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

  // 4.5: the attendance month (BS or AD) and the day counts payroll uses.
  calendar: varchar('calendar', { length: 2 }).default('BS').notNull(),
  periodYear: integer('period_year'),
  periodMonth: integer('period_month'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  calendarDays: integer('calendar_days').default(0).notNull(),
  payableDays: numeric('payable_days', { precision: 5, scale: 2 }).default('0').notNull(),
  unpaidDays: numeric('unpaid_days', { precision: 5, scale: 2 }).default('0').notNull(),
  notEmployedDays: numeric('not_employed_days', { precision: 5, scale: 2 }).default('0').notNull(),
  summary: jsonb('summary'),

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

/** 4.5: raw punches (web, device, import, adjustment, manual). Never deleted: voided with a reason. */
export const attendancePunches = pgTable('attendance_punches', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  punchedAt: timestamp('punched_at', { withTimezone: true }).notNull(),
  kind: varchar('kind', { length: 10 }).default('auto').notNull(), // in | out | auto
  source: varchar('source', { length: 20 }).notNull(), // manual | web | device | import | adjustment
  deviceId: varchar('device_id', { length: 100 }),
  ip: varchar('ip', { length: 64 }),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  accuracyM: integer('accuracy_m'),
  note: text('note'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  voidedAt: timestamp('voided_at'),
  voidedBy: uuid('voided_by'),
  voidReason: text('void_reason'),
}, (t) => ({
  empTimeIdx: index('attendance_punches_emp_time_idx').on(t.employeeId, t.punchedAt),
  uniquePunch: unique('attendance_punches_unique_idx').on(t.employeeId, t.punchedAt, t.source),
}));

/** 4.5: attendance adjustment (regularization) requests, approved through the approval engine. */
export const attendanceAdjustments = pgTable('attendance_adjustments', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  attendanceDate: date('attendance_date').notNull(),
  kind: varchar('kind', { length: 20 }).notNull(),
  requestedIn: timestamp('requested_in', { withTimezone: true }),
  requestedOut: timestamp('requested_out', { withTimezone: true }),
  reason: text('reason').notNull(),
  source: varchar('source', { length: 20 }).default('hr').notNull(), // hr | self_service
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  preparedBy: uuid('prepared_by'),
  approvalType: varchar('approval_type', { length: 20 }),
  approvalLevels: jsonb('approval_levels').$type<{ level: number; userId: string; skipped?: 'preparer' | 'own_salary' | null }[]>().default([]).notNull(),
  currentLevel: integer('current_level').default(0).notNull(),
  approvalRoute: varchar('approval_route', { length: 20 }),
  decidedBy: uuid('decided_by'),
  decidedAt: timestamp('decided_at'),
  decisionNote: text('decision_note'),
  // 4.5c remote check-in (outside the allowed place): where it was made.
  ip: varchar('ip', { length: 64 }),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  accuracyM: integer('accuracy_m'),
  distanceM: integer('distance_m'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  empDateIdx: index('attendance_adjustments_emp_date_idx').on(t.employeeId, t.attendanceDate),
  statusIdx: index('attendance_adjustments_status_idx').on(t.status),
}));

/** 4.5: an attendance month per branch (BS now, AD with 4.8): open, or closed for payroll. */
export const attendancePeriods = pgTable('attendance_periods', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  calendar: varchar('calendar', { length: 2 }).default('BS').notNull(),
  periodYear: integer('period_year').notNull(),
  periodMonth: integer('period_month').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  days: integer('days').notNull(),
  branchId: uuid('branch_id').notNull(),
  status: varchar('status', { length: 10 }).default('open').notNull(), // open | closed
  closedBy: uuid('closed_by'),
  closedAt: timestamp('closed_at'),
  reopenedBy: uuid('reopened_by'),
  reopenedAt: timestamp('reopened_at'),
  reopenReason: text('reopen_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniquePeriod: unique('attendance_periods_unique_idx').on(t.calendar, t.periodYear, t.periodMonth, t.branchId),
}));

/** 4.5c: people allowed to clock in from anywhere (field staff, a client visit until a date), without approval. */
export const attendanceCheckinExceptions = pgTable('attendance_checkin_exceptions', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  fromDate: date('from_date').notNull(),
  toDate: date('to_date'),
  reason: text('reason').notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  empIdx: index('attendance_checkin_exceptions_emp_idx').on(t.employeeId),
}));

/** 4.5b: a shift defined by the company: hours, a week (off days, own hours per weekday) and seasons. */
export const shifts = pgTable('shifts', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  code: varchar('code', { length: 10 }).notNull(),
  name: varchar('name', { length: 60 }).notNull(),
  color: varchar('color', { length: 12 }).default('green').notNull(),
  kind: varchar('kind', { length: 10 }).default('fixed').notNull(), // fixed | flexible
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  breakMinutes: integer('break_minutes').default(30).notNull(),
  graceMinutes: integer('grace_minutes').default(15).notNull(),
  fullDayMinutes: integer('full_day_minutes').default(420).notNull(),
  halfDayMinutes: integer('half_day_minutes').default(240).notNull(),
  otMinimumMinutes: integer('ot_minimum_minutes').default(30).notNull(),
  week: jsonb('week').$type<{ working: boolean; start?: string | null; end?: string | null }[]>().default([]).notNull(),
  seasons: jsonb('seasons').$type<{ name: string; fromMonth: number; fromDay: number; toMonth: number; toDay: number; start: string; end: string }[]>().default([]).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  active: boolean('active').default(true).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  codeIdx: unique('shifts_code_idx').on(t.code),
}));

/** 4.5b: an employee's shift from a date (to_date null = ongoing); periods never overlap. */
export const shiftAssignments = pgTable('shift_assignments', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id, { onDelete: 'restrict' }).notNull(),
  fromDate: date('from_date').notNull(),
  toDate: date('to_date'),
  note: text('note'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  empIdx: index('shift_assignments_emp_idx').on(t.employeeId, t.fromDate),
}));

/** 4.5b: one roster day: a shift for that day (rotation, swap) or OFF. */
export const shiftRoster = pgTable('shift_roster', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  rosterDate: date('roster_date').notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id, { onDelete: 'restrict' }),
  isOff: boolean('is_off').default(false).notNull(),
  note: text('note'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  empDateIdx: unique('shift_roster_emp_date_idx').on(t.employeeId, t.rosterDate),
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
  // F3: employees see the payslips of a run only after it is locked and published.
  publishedAt: timestamp('published_at'),
  publishedBy: uuid('published_by'),
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
  /** F5: the tax computation sheet behind this slip's TDS (months 1–11). */
  taxSheet: jsonb('tax_sheet'),
  // F3: a held payslip stays hidden from the employee even after its run is published.
  heldAt: timestamp('held_at'),
  heldBy: uuid('held_by'),
  holdReason: text('hold_reason'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  payrollRunIdIdx: index('payroll_slips_payroll_run_id_idx').on(table.payrollRunId),
  employeeIdIdx: index('payroll_slips_employee_id_idx').on(table.employeeId),
}));

/**
 * F1: acknowledgements of variance flags on a run. A flag (key =
 * `<employee id>:<code>`) that needs a look blocks approval until someone
 * acknowledges it with a note; the flags themselves are computed on read.
 */
export const payrollVarianceAcks = pgTable('payroll_variance_acks', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  payrollRunId: uuid('payroll_run_id').references(() => payrollRuns.id, { onDelete: 'cascade' }).notNull(),
  flagKey: varchar('flag_key', { length: 100 }).notNull(),
  employeeId: uuid('employee_id').notNull(),
  note: text('note').default('').notNull(),
  ackedBy: uuid('acked_by').notNull(),
  ackedAt: timestamp('acked_at').defaultNow().notNull(),
}, (table) => ({
  oncePerFlag: unique('payroll_variance_acks_key').on(table.payrollRunId, table.flagKey),
}));

/**
 * Arrears (4.8 / F7): back pay paid through `payrollRunId` for an earlier approved or locked month
 * (`sourceRunId`). The sum per (employee, source run) is what has already been paid for that month,
 * so the next calculation only pays what is still missing.
 */
export const payrollArrears = pgTable('payroll_arrears', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  sourceRunId: uuid('source_run_id').references(() => payrollRuns.id, { onDelete: 'cascade' }).notNull(),
  payrollRunId: uuid('payroll_run_id').references(() => payrollRuns.id, { onDelete: 'cascade' }).notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  oncePerRun: unique('payroll_arrears_key').on(table.employeeId, table.sourceRunId, table.payrollRunId),
  sourceIdx: index('payroll_arrears_source_idx').on(table.sourceRunId, table.employeeId),
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

// -----------------------------------------------------------------------------
// HR LETTERS (G2, letters part — docs/redesign/06-hrms-gap-analysis.md)
// Formal letters issued to employees: appointment, confirmation, promotion
// (बढुवा), transfer (सरुवा), experience / job-left (अनुभव), NOC. Each letter is
// rendered from a template at issue time and FROZEN (the stored body never
// changes afterwards); mistakes are voided, never edited or deleted, and the
// chalani (dispatch) number is never reused.
// -----------------------------------------------------------------------------

/**
 * Letter templates: bilingual bodies with {{merge_field}} placeholders.
 * System templates (seeded per tenant) can be edited but not deleted.
 */
export const letterTemplates = pgTable('letter_templates', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(), // appointment | confirmation | promotion | transfer | experience | noc | custom codes
  name: varchar('name', { length: 100 }).notNull(),
  nameNp: varchar('name_np', { length: 100 }).default('').notNull(),
  subjectEn: varchar('subject_en', { length: 200 }).notNull(),
  subjectNp: varchar('subject_np', { length: 200 }).default('').notNull(),
  bodyEn: text('body_en').notNull(),
  bodyNp: text('body_np').default('').notNull(),
  isSystem: boolean('is_system').default(false).notNull(), // seeded defaults: editable, never deletable
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

/**
 * Chalani (dispatch) number sequence, one row per fiscal year. Allocation is a
 * single UPDATE ... RETURNING inside the issue transaction, so two letters can
 * never share a number (PG10-safe; no sequences to keep in step per tenant).
 */
export const letterSequences = pgTable('letter_sequences', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'restrict' }).notNull().unique('letter_sequences_fiscal_year_key'),
  lastSeq: integer('last_seq').default(0).notNull(),
});

/**
 * An issued letter: the rendered subject and body are stored as issued (the
 * template may change later; the letter must not). `mergeData` keeps the field
 * values used, for the register's detail pane and audits.
 */
export const hrLetters = pgTable('hr_letters', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  templateId: uuid('template_id').references(() => letterTemplates.id, { onDelete: 'set null' }),
  kind: varchar('kind', { length: 30 }).notNull(), // template code at issue time
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'restrict' }).notNull(),
  seq: integer('seq').notNull(), // chalani sequence within the fiscal year
  letterNumber: varchar('letter_number', { length: 50 }).notNull(), // display form, e.g. "12/2082-83"
  language: varchar('language', { length: 2 }).notNull(), // 'en' | 'np'
  subject: varchar('subject', { length: 200 }).notNull(),
  body: text('body').notNull(), // rendered at issue; frozen
  mergeData: jsonb('merge_data').$type<Record<string, string>>().default({}).notNull(),
  status: varchar('status', { length: 10 }).default('issued').notNull(), // 'issued' | 'voided'
  issuedDateBs: varchar('issued_date_bs', { length: 20 }).notNull(),
  issuedDateAd: date('issued_date_ad').notNull(),
  issuedBy: uuid('issued_by').notNull(),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  voidedBy: uuid('voided_by'),
  voidedAt: timestamp('voided_at'),
  voidReason: text('void_reason'),
}, (t) => ({
  employeeIdIdx: index('hr_letters_employee_id_idx').on(t.employeeId),
  fiscalYearSeqKey: unique('hr_letters_fiscal_year_seq_key').on(t.fiscalYearId, t.seq),
  issuedAtIdx: index('hr_letters_issued_at_idx').on(t.issuedAt),
}));

/**
 * EMPLOYEE LIFECYCLE EVENTS (G2, events part — docs/redesign/06-hrms-gap-analysis.md)
 * Promotion (बढुवा), transfer (सरुवा) and confirmation (स्थायी) recorded as dated
 * events with before/after snapshots, instead of silent in-place edits. An event
 * due today or earlier is applied to the employee row in the same transaction;
 * a future-dated one stays 'scheduled' and is applied on read once due. A
 * mistaken scheduled event is cancelled; an applied one is corrected by a new
 * event (history is never rewritten).
 */
export const employeeEvents = pgTable('employee_events', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  kind: varchar('kind', { length: 20 }).notNull(), // 'promotion' | 'transfer' | 'confirmation'
  effectiveDateAd: date('effective_date_ad').notNull(),
  effectiveDateBs: varchar('effective_date_bs', { length: 20 }).notNull(),
  fromValues: jsonb('from_values').$type<Record<string, string>>().default({}).notNull(), // ids and display names before
  toValues: jsonb('to_values').$type<Record<string, string>>().default({}).notNull(),     // ids and display names after
  reason: text('reason'),
  status: varchar('status', { length: 10 }).default('applied').notNull(), // 'scheduled' | 'applied' | 'cancelled'
  letterId: uuid('letter_id').references(() => hrLetters.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  appliedAt: timestamp('applied_at'),
  cancelledBy: uuid('cancelled_by'),
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: text('cancel_reason'),
}, (t) => ({
  employeeIdIdx: index('employee_events_employee_id_idx').on(t.employeeId),
  dueIdx: index('employee_events_due_idx').on(t.status, t.effectiveDateAd),
}));

// -----------------------------------------------------------------------------
// PERFORMANCE EVALUATION (G1 — docs/redesign/06-hrms-gap-analysis.md)
// का.स.मू.-style marks-based evaluation: a cycle per period, one evaluation per
// employee with the form FROZEN at start (template changes never touch
// in-flight evaluations), stage-by-stage scores (supervisor → reviewer →
// committee, weights from the template), a weighted total and a grade band.
// Finalized marks feed promotion scoring and probation confirmation (G2).
// -----------------------------------------------------------------------------

/**
 * The company's evaluation form: sections → criteria with max marks, stage
 * weights and grade bands, all as JSON checked by evaluation.engine.ts. One
 * row per code; 'default' is seeded on first read and never deleted.
 */
export const evaluationTemplates = pgTable('evaluation_templates', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  nameNp: varchar('name_np', { length: 100 }).default('').notNull(),
  /** { weights: {stage: pct}, bands: [{min, label, labelNp}], sections: [{id, name, nameNp, criteria: [{id, name, nameNp, max}]}] } */
  form: jsonb('form').$type<Record<string, unknown>>().notNull(),
  isSystem: boolean('is_system').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const evaluationCycles = pgTable('evaluation_cycles', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'restrict' }).notNull(),
  label: varchar('label', { length: 100 }).notNull(), // e.g. "FY 2082/83 — annual"
  period: varchar('period', { length: 20 }).default('annual').notNull(), // 'annual' | 'half-yearly'
  status: varchar('status', { length: 10 }).default('open').notNull(), // 'open' | 'closed'
  openedBy: uuid('opened_by').notNull(),
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  closedBy: uuid('closed_by'),
  closedAt: timestamp('closed_at'),
}, (t) => ({
  oneLabelPerYear: unique('evaluation_cycles_year_label_key').on(t.fiscalYearId, t.label),
}));

export const evaluations = pgTable('evaluations', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  cycleId: uuid('cycle_id').references(() => evaluationCycles.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  /** The template form frozen when the evaluation starts. */
  form: jsonb('form').$type<Record<string, unknown>>().notNull(),
  /** Stage → rater user id, fixed at start ({ supervisor, reviewer, committee }). */
  raters: jsonb('raters').$type<Record<string, string>>().default({}).notNull(),
  /** The stage waiting for marks, or 'final'. */
  stage: varchar('stage', { length: 20 }).notNull(),
  status: varchar('status', { length: 12 }).default('in_progress').notNull(), // 'in_progress' | 'final'
  /** { stages: {stage: pct}, total: pct, band: label } once final. */
  totals: jsonb('totals').$type<Record<string, unknown>>().default({}).notNull(),
  startedBy: uuid('started_by').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  finalizedBy: uuid('finalized_by'),
  finalizedAt: timestamp('finalized_at'),
}, (t) => ({
  onePerCycle: unique('evaluations_cycle_employee_key').on(t.cycleId, t.employeeId),
  employeeIdIdx: index('evaluations_employee_id_idx').on(t.employeeId),
  stageIdx: index('evaluations_stage_idx').on(t.status, t.stage),
}));

export const evaluationScores = pgTable('evaluation_scores', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  evaluationId: uuid('evaluation_id').references(() => evaluations.id, { onDelete: 'cascade' }).notNull(),
  stage: varchar('stage', { length: 20 }).notNull(),
  criterionId: varchar('criterion_id', { length: 40 }).notNull(),
  marks: numeric('marks', { precision: 5, scale: 2 }).notNull(),
  note: text('note'),
  ratedBy: uuid('rated_by').notNull(),
  ratedAt: timestamp('rated_at').defaultNow().notNull(),
}, (t) => ({
  oneMarkPerCell: unique('evaluation_scores_cell_key').on(t.evaluationId, t.stage, t.criterionId),
  evaluationIdIdx: index('evaluation_scores_evaluation_id_idx').on(t.evaluationId),
}));

// -----------------------------------------------------------------------------
// SCHEDULED JOBS (G6 — docs/redesign/06-hrms-gap-analysis.md)
// Automation that fits cPanel/Passenger: no daemon — a cron curl hits
// /api/jobs/tick (bearer secret), which runs every DUE job for every active
// company. Jobs are code-defined (lib/engines/scheduler.engine.ts); these
// tables keep per-tenant state and a run log. Every job is idempotent per
// Nepal day (the claim is the state row's last_run_day update).
// -----------------------------------------------------------------------------

export const scheduledJobs = pgTable('scheduled_jobs', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  code: varchar('code', { length: 40 }).notNull().unique(),
  enabled: boolean('enabled').default(true).notNull(),
  /** The Nepal day (YYYY-MM-DD AD) this job last ran — the once-per-day claim. */
  lastRunDay: varchar('last_run_day', { length: 10 }),
  lastRunAt: timestamp('last_run_at'),
  lastStatus: varchar('last_status', { length: 10 }), // 'ok' | 'error' | 'skipped'
  lastDetail: text('last_detail'),
});

export const jobRuns = pgTable('job_runs', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  jobCode: varchar('job_code', { length: 40 }).notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
  status: varchar('status', { length: 10 }).default('running').notNull(), // 'running' | 'ok' | 'error'
  detail: text('detail'),
  itemsProcessed: integer('items_processed').default(0).notNull(),
}, (t) => ({
  jobCodeIdx: index('job_runs_job_code_idx').on(t.jobCode, t.startedAt),
}));

// -----------------------------------------------------------------------------
// ATTENDANCE DEVICES (G3 — docs/redesign/06-hrms-gap-analysis.md; the 4.5
// "Devices later" step). ZKTeco-class terminals push punches themselves
// (ADMS / iclock: the device POSTs ATTLOG lines to /api/devices/iclock/cdata
// with its serial number). A device is trusted by its registered serial
// number + enabled flag; punches from unknown device user ids (PINs) wait in
// device_unmatched_punches until HR maps the PIN to an employee. Matched
// punches land in attendance_punches (source 'device'), which the 4.5 day
// engine already reads — devices change no attendance rules.
// -----------------------------------------------------------------------------

export const attendanceDevices = pgTable('attendance_devices', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'restrict' }).notNull(),
  serialNo: varchar('serial_no', { length: 60 }).notNull().unique(),
  enabled: boolean('enabled').default(true).notNull(),
  /** Minutes the device clock is ahead of UTC (Nepal: 345). ATTLOG carries local time. */
  tzOffsetMinutes: integer('tz_offset_minutes').default(345).notNull(),
  lastSeenAt: timestamp('last_seen_at'),
  lastPunchAt: timestamp('last_punch_at', { withTimezone: true }),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

/** The device's user id (PIN) for an employee, per device. */
export const deviceUsers = pgTable('device_users', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  deviceId: uuid('device_id').references(() => attendanceDevices.id, { onDelete: 'cascade' }).notNull(),
  deviceUserId: varchar('device_user_id', { length: 30 }).notNull(), // the PIN on the terminal
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  onePinPerDevice: unique('device_users_device_pin_key').on(t.deviceId, t.deviceUserId),
  employeeIdIdx: index('device_users_employee_id_idx').on(t.employeeId),
}));

/** Punches whose PIN has no mapping yet; claimed into attendance_punches when HR maps the PIN. */
export const deviceUnmatchedPunches = pgTable('device_unmatched_punches', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  deviceId: uuid('device_id').references(() => attendanceDevices.id, { onDelete: 'cascade' }).notNull(),
  deviceUserId: varchar('device_user_id', { length: 30 }).notNull(),
  punchedAt: timestamp('punched_at', { withTimezone: true }).notNull(),
  raw: varchar('raw', { length: 200 }).default('').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
}, (t) => ({
  uniqueUnmatched: unique('device_unmatched_punches_key').on(t.deviceId, t.deviceUserId, t.punchedAt),
  deviceIdx: index('device_unmatched_punches_device_idx').on(t.deviceId, t.receivedAt),
}));

// -----------------------------------------------------------------------------
// EXIT WORKFLOW (G5 — docs/redesign/06-hrms-gap-analysis.md)
// Resignation (राजीनामा), retirement, termination, contract end or death as a
// case: notice and last working day, a clearance checklist per unit
// (accounts, IT/admin, branch, HR), then Complete — which, in one
// transaction, marks the employee Inactive, writes the employee_termination
// mirror for older readers, and closes the case. The settlement maths stays
// with payroll (F8); an exit case is the workflow and the record around it.
// -----------------------------------------------------------------------------

export const exitCases = pgTable('exit_cases', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  kind: varchar('kind', { length: 20 }).notNull(), // resignation | retirement | termination | contract_end | death
  noticeDate: date('notice_date'), // when the resignation / decision was received
  lastWorkingDayAd: date('last_working_day_ad').notNull(),
  lastWorkingDayBs: varchar('last_working_day_bs', { length: 20 }).notNull(),
  reason: text('reason'),
  status: varchar('status', { length: 10 }).default('open').notNull(), // open | closed | cancelled
  letterId: uuid('letter_id').references(() => hrLetters.id, { onDelete: 'set null' }), // the experience letter
  openedBy: uuid('opened_by').notNull(),
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  closedBy: uuid('closed_by'),
  closedAt: timestamp('closed_at'),
  cancelledBy: uuid('cancelled_by'),
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: text('cancel_reason'),
}, (t) => ({
  employeeIdIdx: index('exit_cases_employee_id_idx').on(t.employeeId),
  statusIdx: index('exit_cases_status_idx').on(t.status),
}));

/**
 * Full & final settlement (4.8 / F8): one per exit case. `lines` are frozen when it is prepared
 * (see lib/engines/settlement.engine.ts); draft → approved → paid, never edited afterwards.
 */
export const exitSettlements = pgTable('exit_settlements', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  exitCaseId: uuid('exit_case_id').references(() => exitCases.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 10 }).default('draft').notNull(), // draft | approved | paid
  lines: jsonb('lines').notNull(),
  earnings: numeric('earnings', { precision: 15, scale: 2 }).notNull(),
  deductions: numeric('deductions', { precision: 15, scale: 2 }).notNull(),
  net: numeric('net', { precision: 15, scale: 2 }).notNull(),
  taxSheet: jsonb('tax_sheet'),
  policy: jsonb('policy').notNull(),
  preparedBy: uuid('prepared_by').notNull(),
  preparedAt: timestamp('prepared_at').defaultNow().notNull(),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),
  paidBy: uuid('paid_by'),
  paidAt: timestamp('paid_at'),
  paymentRef: varchar('payment_ref', { length: 100 }),
}, (t) => ({
  caseKey: unique('exit_settlements_case_key').on(t.exitCaseId),
  employeeIdx: index('exit_settlements_employee_idx').on(t.employeeId),
}));

/** One row per clearance unit per case, seeded when the case opens. */
export const exitClearances = pgTable('exit_clearances', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  exitCaseId: uuid('exit_case_id').references(() => exitCases.id, { onDelete: 'cascade' }).notNull(),
  unit: varchar('unit', { length: 20 }).notNull(), // accounts | it_admin | branch | hr
  status: varchar('status', { length: 10 }).default('pending').notNull(), // pending | cleared | blocked
  note: text('note'),
  decidedBy: uuid('decided_by'),
  decidedAt: timestamp('decided_at'),
}, (t) => ({
  oneUnitPerCase: unique('exit_clearances_case_unit_key').on(t.exitCaseId, t.unit),
}));

// -----------------------------------------------------------------------------
// RECRUITMENT & DARBANDI (G4 — docs/redesign/06-hrms-gap-analysis.md)
// दरबन्दी: the board-approved post count per designation and branch; hiring,
// promotion and transfer consume or free them (shown as occupancy — the
// enforcement wiring into those flows is a follow-up). A vacancy is opened
// against a designation and branch; applicants move applied → shortlisted →
// exam → interview → selected (or rejected anywhere), with exam and
// interview marks making the merit order. Hiring itself stays with the
// employee form; a selected applicant is marked hired and linked once the
// employee exists.
// -----------------------------------------------------------------------------

export const approvedPositions = pgTable('approved_positions', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  designationId: uuid('designation_id').references(() => designations.id, { onDelete: 'restrict' }).notNull(),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'restrict' }).notNull(),
  positions: integer('positions').notNull(), // the approved count
  decisionRef: varchar('decision_ref', { length: 100 }).default('').notNull(), // board / AGM minute
  note: text('note'),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  onePerPost: unique('approved_positions_key').on(t.designationId, t.branchId),
}));

export const vacancies = pgTable('vacancies', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  designationId: uuid('designation_id').references(() => designations.id, { onDelete: 'restrict' }).notNull(),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'restrict' }).notNull(),
  openings: integer('openings').default(1).notNull(),
  deadlineAd: date('deadline_ad'),
  note: text('note'),
  status: varchar('status', { length: 10 }).default('open').notNull(), // open | closed | cancelled
  openedBy: uuid('opened_by').notNull(),
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  closedBy: uuid('closed_by'),
  closedAt: timestamp('closed_at'),
}, (t) => ({
  statusIdx: index('vacancies_status_idx').on(t.status),
}));

export const applicants = pgTable('applicants', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  vacancyId: uuid('vacancy_id').references(() => vacancies.id, { onDelete: 'cascade' }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).default('').notNull(),
  email: varchar('email', { length: 255 }).default('').notNull(),
  address: varchar('address', { length: 255 }).default('').notNull(),
  educationNote: text('education_note'),
  stage: varchar('stage', { length: 15 }).default('applied').notNull(), // applied | shortlisted | exam | interview | selected | rejected | hired
  examMarks: numeric('exam_marks', { precision: 5, scale: 2 }),
  interviewMarks: numeric('interview_marks', { precision: 5, scale: 2 }),
  note: text('note'),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'set null' }), // once hired
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  vacancyIdx: index('applicants_vacancy_idx').on(t.vacancyId, t.stage),
}));

// -----------------------------------------------------------------------------
// WELFARE / MEDICAL / GRATUITY FUNDS (G9 — docs/redesign/06-hrms-gap-analysis.md)
// Sahakari staff funds that accrue per month and pay out at events. The
// ledger follows leave_ledger's discipline: APPEND-ONLY — never update or
// delete a line; a mistake is corrected by an adjustment line; `ref` says
// what a line is for (contrib:<fund>:<bsYear>-<bsMonth>, opening:<fund>,
// payout:<id>, adjust:<id>) and is checked before posting so nothing posts
// twice. A balance is the sum of a member's lines.
// -----------------------------------------------------------------------------

export const fundTypes = pgTable('fund_types', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  nameNp: varchar('name_np', { length: 100 }).default('').notNull(),
  /** 'fixed' = amounts per month; 'percent_basic' = percent of the employee's basic salary. */
  contributionMode: varchar('contribution_mode', { length: 15 }).default('fixed').notNull(),
  employeeValue: numeric('employee_value', { precision: 15, scale: 2 }).default('0').notNull(),
  employerValue: numeric('employer_value', { precision: 15, scale: 2 }).default('0').notNull(),
  note: text('note'),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const fundLedger = pgTable('fund_ledger', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  fundTypeId: uuid('fund_type_id').references(() => fundTypes.id, { onDelete: 'restrict' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'restrict' }).notNull(),
  kind: varchar('kind', { length: 12 }).notNull(), // contribution | opening | payout | adjustment
  /** Signed, in NPR: contributions positive, payouts negative. */
  employeeAmount: numeric('employee_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  employerAmount: numeric('employer_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  /** What this line is for; unique per employee+fund so nothing posts twice. */
  ref: varchar('ref', { length: 80 }).notNull(),
  note: text('note'),
  postedBy: uuid('posted_by'),
  postedAt: timestamp('posted_at').defaultNow().notNull(),
}, (t) => ({
  onePerRef: unique('fund_ledger_ref_key').on(t.fundTypeId, t.employeeId, t.ref),
  employeeIdx: index('fund_ledger_employee_idx').on(t.employeeId, t.fundTypeId),
}));

// -----------------------------------------------------------------------------
// DISCIPLINARY & GRIEVANCE CASES (G8 — docs/redesign/06-hrms-gap-analysis.md)
// One case per matter: open → investigating → decided → closed. The subject
// is the accused (disciplinary) or the complainant (grievance). Every step is
// an append-only line in hr_case_events; termination is only ever
// *recommended* here — the exit itself runs through the exit workflow.
// -----------------------------------------------------------------------------

export const hrCases = pgTable('hr_cases', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  category: varchar('category', { length: 15 }).notNull(), // disciplinary | grievance
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  severity: varchar('severity', { length: 10 }).notNull(), // minor | major | serious
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 15 }).default('open').notNull(), // open | investigating | decided | closed
  outcome: varchar('outcome', { length: 30 }),
  outcomeNote: text('outcome_note'),
  decidedBy: uuid('decided_by'),
  decidedAt: timestamp('decided_at'),
  openedBy: uuid('opened_by').notNull(),
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  closedBy: uuid('closed_by'),
  closedAt: timestamp('closed_at'),
}, (t) => ({
  employeeIdx: index('hr_cases_employee_idx').on(t.employeeId),
  statusIdx: index('hr_cases_status_idx').on(t.status),
}));

export const hrCaseEvents = pgTable('hr_case_events', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  caseId: uuid('case_id').references(() => hrCases.id, { onDelete: 'cascade' }).notNull(),
  kind: varchar('kind', { length: 12 }).notNull(), // opened | note | status | decision | closed
  text: text('text').notNull(),
  actorId: uuid('actor_id'),
  at: timestamp('at').defaultNow().notNull(),
}, (t) => ({
  caseIdx: index('hr_case_events_case_idx').on(t.caseId, t.at),
}));

// -----------------------------------------------------------------------------
// TRAINING (G7 — docs/redesign/06-hrms-gap-analysis.md)
// A programme moves planned → running → completed (or cancelled). Staff are
// nominated and marked attended / absent / completed; a programme may carry a
// service bond (months to stay after completion — the end date is derived).
// -----------------------------------------------------------------------------

export const trainingPrograms = pgTable('training_programs', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  provider: varchar('provider', { length: 200 }).default('').notNull(),
  kind: varchar('kind', { length: 12 }).notNull(), // internal | external | regulatory
  startAd: date('start_ad').notNull(),
  endAd: date('end_ad').notNull(),
  hours: numeric('hours', { precision: 7, scale: 2 }).notNull(),
  cost: numeric('cost', { precision: 15, scale: 2 }).default('0').notNull(),
  bondMonths: integer('bond_months').default(0).notNull(),
  note: text('note'),
  status: varchar('status', { length: 10 }).default('planned').notNull(), // planned | running | completed | cancelled
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  statusIdx: index('training_programs_status_idx').on(t.status),
}));

export const trainingParticipants = pgTable('training_participants', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  programId: uuid('program_id').references(() => trainingPrograms.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 10 }).default('nominated').notNull(), // nominated | attended | absent | completed
  score: numeric('score', { precision: 5, scale: 2 }),
  certificateNo: varchar('certificate_no', { length: 60 }),
  markedBy: uuid('marked_by'),
  markedAt: timestamp('marked_at'),
  nominatedBy: uuid('nominated_by'),
  nominatedAt: timestamp('nominated_at').defaultNow().notNull(),
}, (t) => ({
  onePerPerson: unique('training_participants_key').on(t.programId, t.employeeId),
  employeeIdx: index('training_participants_employee_idx').on(t.employeeId),
}));

// -----------------------------------------------------------------------------
// TARGETS & ACHIEVEMENTS (G15 — docs/redesign/06-hrms-gap-analysis.md)
// One row is one metric for one employee and one period (a fiscal month or the
// fiscal year). The employee reports the achievement (with attachments), the
// supervisor verifies and forwards, HR closes: set → submitted → forwarded →
// closed, with returned loops. The verified value (supervisor) wins over the
// reported one for scoring.
// -----------------------------------------------------------------------------

export const employeeTargets = pgTable('employee_targets', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  periodKind: varchar('period_kind', { length: 5 }).notNull(), // month | year
  fy: varchar('fy', { length: 9 }).notNull(), // BS fiscal year, e.g. 2082/83
  monthNo: integer('month_no'), // 1 = Shrawan … 12 = Ashadh; null for a year
  title: varchar('title', { length: 160 }).notNull(),
  unit: varchar('unit', { length: 30 }).default('').notNull(),
  targetValue: numeric('target_value', { precision: 18, scale: 2 }).notNull(),
  weight: numeric('weight', { precision: 5, scale: 2 }).default('0').notNull(),
  status: varchar('status', { length: 10 }).default('set').notNull(), // set | submitted | returned | forwarded | closed
  achievedValue: numeric('achieved_value', { precision: 18, scale: 2 }),
  achievedNote: text('achieved_note'),
  verifiedValue: numeric('verified_value', { precision: 18, scale: 2 }),
  reviewerNote: text('reviewer_note'),
  returnReason: text('return_reason'),
  submittedAt: timestamp('submitted_at'),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  closedBy: uuid('closed_by'),
  closedAt: timestamp('closed_at'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  employeePeriodIdx: index('employee_targets_employee_period_idx').on(t.employeeId, t.fy, t.periodKind, t.monthNo),
  statusIdx: index('employee_targets_status_idx').on(t.status),
}));

export const targetAttachments = pgTable('target_attachments', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  targetId: uuid('target_id').references(() => employeeTargets.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 200 }).notNull(),
  mime: varchar('mime', { length: 40 }).notNull(),
  size: integer('size').notNull(),
  content: bytea('content').notNull(),
  uploadedBy: uuid('uploaded_by').notNull(), // user id; target_id null = staged, not saved yet
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
}, (t) => ({
  targetIdx: index('target_attachments_target_idx').on(t.targetId),
}));

// -----------------------------------------------------------------------------
// ASSETS & NOTICE BOARD (G14 — docs/redesign/06-hrms-gap-analysis.md)
// assets: the register (laptop, phone, keys, ID card…); asset_handovers: who
// holds what since when, returned when — an asset has at most one open
// handover; the exit case shows unreturned items. notices: the board.
// -----------------------------------------------------------------------------

export const assets = pgTable('assets', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  tag: varchar('tag', { length: 50 }).notNull(), // asset tag / serial, unique
  name: varchar('name', { length: 200 }).notNull(),
  category: varchar('category', { length: 30 }).notNull(), // laptop | phone | key | id_card | vehicle | furniture | other
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  note: text('note'),
  status: varchar('status', { length: 12 }).default('available').notNull(), // available | issued | retired
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  tagKey: unique('assets_tag_key').on(t.tag),
  statusIdx: index('assets_status_idx').on(t.status),
}));

export const assetHandovers = pgTable('asset_handovers', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  issuedAd: date('issued_ad').notNull(),
  returnedAd: date('returned_ad'),
  condition: varchar('condition', { length: 12 }), // on return: good | damaged | lost
  note: text('note'),
  issuedBy: uuid('issued_by'),
  returnedBy: uuid('returned_by'),
}, (t) => ({
  employeeIdx: index('asset_handovers_employee_idx').on(t.employeeId),
  assetIdx: index('asset_handovers_asset_idx').on(t.assetId),
}));

export const notices = pgTable('notices', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  audience: varchar('audience', { length: 12 }).default('company').notNull(), // company | branch | department | employees
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }), // audience 'branch'
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }), // audience 'department'
  publishAd: date('publish_ad').notNull(),
  expiresAd: date('expires_ad'),
  pinned: boolean('pinned').default(false).notNull(),
  status: varchar('status', { length: 10 }).default('published').notNull(), // draft | published | withdrawn
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  publishIdx: index('notices_publish_idx').on(t.status, t.publishAd),
}));

// Named recipients of an audience 'employees' notice.
export const noticeRecipients = pgTable('notice_recipients', {
  noticeId: uuid('notice_id').notNull().references(() => notices.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.noticeId, t.employeeId] }),
  employeeIdx: index('notice_recipients_employee_idx').on(t.employeeId),
}));

// -----------------------------------------------------------------------------
// TRAVEL & DAILY ALLOWANCE — TA-DA (G11 — docs/redesign/06-hrms-gap-analysis.md)
// travel_rates: the card (default or per designation). travel_claims: one trip
// per claim; amounts are computed by the engine from the card in force when
// the claim is saved and FROZEN on the row (a later card change never changes
// an existing claim). draft → submitted → approved / rejected; settled when paid.
// -----------------------------------------------------------------------------

export const travelRates = pgTable('travel_rates', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  designationId: uuid('designation_id').references(() => designations.id, { onDelete: 'cascade' }), // null = default card
  dailyAllowance: numeric('daily_allowance', { precision: 12, scale: 2 }).default('0').notNull(),
  lodgingPerNight: numeric('lodging_per_night', { precision: 12, scale: 2 }).default('0').notNull(),
  kmRate: numeric('km_rate', { precision: 8, scale: 2 }).default('0').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  onePerDesignation: unique('travel_rates_designation_key').on(t.designationId),
}));

export const travelClaims = pgTable('travel_claims', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  purpose: varchar('purpose', { length: 300 }).notNull(),
  fromPlace: varchar('from_place', { length: 120 }).notNull(),
  toPlace: varchar('to_place', { length: 120 }).notNull(),
  startAd: date('start_ad').notNull(),
  endAd: date('end_ad').notNull(),
  mode: varchar('mode', { length: 15 }).notNull(),
  km: numeric('km', { precision: 8, scale: 1 }).default('0').notNull(),
  nights: integer('nights').default(0).notNull(),
  fareActual: numeric('fare_actual', { precision: 12, scale: 2 }).default('0').notNull(),
  lodgingActual: numeric('lodging_actual', { precision: 12, scale: 2 }).default('0').notNull(),
  advance: numeric('advance', { precision: 12, scale: 2 }).default('0').notNull(),
  // Frozen from the card when saved:
  rateName: varchar('rate_name', { length: 100 }).default('').notNull(),
  days: integer('days').notNull(),
  dailyAllowance: numeric('daily_allowance', { precision: 12, scale: 2 }).notNull(),
  lodging: numeric('lodging', { precision: 12, scale: 2 }).notNull(),
  travel: numeric('travel', { precision: 12, scale: 2 }).notNull(),
  gross: numeric('gross', { precision: 12, scale: 2 }).notNull(),
  payable: numeric('payable', { precision: 12, scale: 2 }).notNull(),
  note: text('note'),
  status: varchar('status', { length: 10 }).default('draft').notNull(), // draft | submitted | approved | rejected | settled
  decisionNote: text('decision_note'),
  decidedBy: uuid('decided_by'),
  decidedAt: timestamp('decided_at'),
  settledAt: timestamp('settled_at'),
  /** The payroll run that paid this claim (settled through payroll); null when settled by hand or still open. */
  payrollRunId: uuid('payroll_run_id').references(() => payrollRuns.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  employeeIdx: index('travel_claims_employee_idx').on(t.employeeId, t.startAd),
  statusIdx: index('travel_claims_status_idx').on(t.status),
}));

// -----------------------------------------------------------------------------
// EMPLOYEE DOSSIER (4.2c): qualifications, past employment, other attachments.
// Each row may own one scan in employee_document_files (attached_to set).
// -----------------------------------------------------------------------------

export const employeeQualifications = pgTable('employee_qualifications', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  level: varchar('level', { length: 12 }).notNull(),
  degree: varchar('degree', { length: 120 }).notNull(),
  institution: varchar('institution', { length: 200 }).default('').notNull(),
  board: varchar('board', { length: 200 }).default('').notNull(),
  passedYear: varchar('passed_year', { length: 10 }).default('').notNull(),
  division: varchar('division', { length: 40 }).default('').notNull(),
  major: varchar('major', { length: 120 }).default('').notNull(),
  fileId: uuid('file_id').references(() => employeeDocumentFiles.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  employeeIdx: index('employee_qualifications_employee_idx').on(t.employeeId),
}));

export const employeeWorkHistory = pgTable('employee_work_history', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  organisation: varchar('organisation', { length: 200 }).notNull(),
  designation: varchar('designation', { length: 120 }).notNull(),
  fromAd: date('from_ad').notNull(),
  toAd: date('to_ad'),
  duties: text('duties'),
  reference: varchar('reference', { length: 200 }).default('').notNull(),
  fileId: uuid('file_id').references(() => employeeDocumentFiles.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  employeeIdx: index('employee_work_history_employee_idx').on(t.employeeId),
}));

export const employeeAttachments = pgTable('employee_attachments', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  kind: varchar('kind', { length: 20 }).notNull(),
  title: varchar('title', { length: 150 }).notNull(),
  note: text('note'),
  fileId: uuid('file_id').references(() => employeeDocumentFiles.id, { onDelete: 'cascade' }).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  employeeIdx: index('employee_attachments_employee_idx').on(t.employeeId),
}));
