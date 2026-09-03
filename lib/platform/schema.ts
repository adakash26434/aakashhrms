import { randomUUID } from 'node:crypto';
import { pgTable, timestamp, uuid, varchar, text, integer, boolean, jsonb, pgEnum, date } from 'drizzle-orm/pg-core';

// -----------------------------------------------------------------------------
// ENUMS FOR CONTROL PLANE
// -----------------------------------------------------------------------------
export const companyStatusEnum = pgEnum('company_status', [
  'DRAFT',
  'PENDING',
  'PROVISIONING',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED',
  'REJECTED',
]);

export const provisioningStatusEnum = pgEnum('provisioning_status', [
  'QUEUED',
  'RUNNING',
  'FAILED',
  'SUCCEEDED',
]);

// -----------------------------------------------------------------------------
// 1. PLATFORM USERS (Super Admins)
// -----------------------------------------------------------------------------
export const platformUsers = pgTable('platform_users', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

// -----------------------------------------------------------------------------
// 2. COMPANIES (Tenant Registrations)
// -----------------------------------------------------------------------------
export const companies = pgTable('companies', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  companyCode: varchar('company_code', { length: 16 }).notNull().unique(), // Public ID e.g. CMP-1111AF
  legalName: varchar('legal_name', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 63 }).notNull().unique(), // Domain label e.g. acme
  status: companyStatusEnum('status').default('PENDING').notNull(),
  contactEmail: varchar('contact_email', { length: 255 }).notNull(),
  contactPhone: varchar('contact_phone', { length: 50 }),
  industryType: varchar('industry_type', { length: 50 }).default('General').notNull(),
  registeredAt: date('registered_at').defaultNow().notNull(),
  notes: text('notes'),
  policyPackVersion: integer('policy_pack_version').default(1).notNull(),
  provisionedAt: timestamp('provisioned_at'),
  suspendedAt: timestamp('suspended_at'),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

// -----------------------------------------------------------------------------
// 3. TENANT DATABASES (Encrypted Connection Configs)
// -----------------------------------------------------------------------------
export const tenantDatabases = pgTable('tenant_databases', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull().unique(),
  dbName: varchar('db_name', { length: 100 }).notNull(),
  dbHost: varchar('db_host', { length: 255 }).default('127.0.0.1').notNull(),
  dbPort: integer('db_port').default(5432).notNull(),
  dbUser: varchar('db_user', { length: 100 }).notNull(),
  dbPasswordEncrypted: text('db_password_encrypted').notNull(),
  schemaVersion: varchar('schema_version', { length: 50 }).default('1.0.0').notNull(),
  lastHealthStatus: varchar('last_health_status', { length: 50 }).default('HEALTHY').notNull(),
  dbSizeBytes: integer('db_size_bytes'),
  lastHealthAt: timestamp('last_health_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

// -----------------------------------------------------------------------------
// 4. COMPANY ADMIN INVITES (Invite tracking on Control Plane)
// -----------------------------------------------------------------------------
export const companyAdminInvites = pgTable('company_admin_invites', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  inviteToken: varchar('invite_token', { length: 255 }).notNull().unique(),
  invitedAt: timestamp('invited_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
});

// -----------------------------------------------------------------------------
// 5. PLATFORM POLICY PACKS (Locked Leave & OT Rules)
// -----------------------------------------------------------------------------
export const platformPolicyPacks = pgTable('platform_policy_packs', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  version: integer('version').notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  payload: jsonb('payload').notNull(),
  isPublished: boolean('is_published').default(false).notNull(),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// -----------------------------------------------------------------------------
// 6. PLATFORM AUDIT LOGS
// -----------------------------------------------------------------------------
export const platformAuditLogs = pgTable('platform_audit_logs', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  actorPlatformUserId: uuid('actor_platform_user_id').references(() => platformUsers.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  meta: jsonb('meta'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// -----------------------------------------------------------------------------
// 7. PROVISIONING JOBS
// -----------------------------------------------------------------------------
export const provisioningJobs = pgTable('provisioning_jobs', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  status: provisioningStatusEnum('status').default('QUEUED').notNull(),
  step: varchar('step', { length: 50 }).notNull(), // 'create_db', 'migrate', 'seed', 'admin_user', 'complete'
  errorMessage: text('error_message'),
  attempts: integer('attempts').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

// -----------------------------------------------------------------------------
// 8. PLATFORM IMPERSONATION LOG
// Tracks every "View As Company" session for full audit trail.
// Super Admin access to tenant data is always logged here with
// start/end timestamps, IP, and user agent.
// -----------------------------------------------------------------------------
export const platformImpersonationLog = pgTable('platform_impersonation_log', {
  id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
  actorPlatformUserId: uuid('actor_platform_user_id').references(() => platformUsers.id, { onDelete: 'set null' }).notNull(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }).notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
