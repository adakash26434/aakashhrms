import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { getAvailableFiscalYearPresets } from '../../utils/fiscal-year-presets';
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_DESIGNATIONS,
  DEFAULT_NEPAL_LEAVE_TYPES,
  DEFAULT_PAY_HEADS,
  LeaveTypePreset,
  PayHeadPreset,
} from '../../types/onboarding';
import { DEFAULT_NEPAL_POLICY_PACK_V1 } from '../policy-pack-data';

export interface SeedTenantOptions {
  connectionUrl: string;
  legalName: string;
  displayName?: string;
  companyCode: string;
  adminEmail: string;
  adminPasswordPlain?: string;
  industryType?: string;
  contactPhone?: string;
  panVatNumber?: string;
  registrationNumber?: string;
  headOfficeAddress?: string;
  headOfficeBranchCode?: string;
  headOfficeBranchAddress?: string;
  fiscalYear?: {
    label: string;
    slug: string;
    startDateBS: string;
    endDateBS: string;
    startDateAD: string;
    endDateAD: string;
  };
  leaveTypes?: LeaveTypePreset[];
  otHourlyMultiplier?: number;
  payHeads?: PayHeadPreset[];
  taxSlabs?: Array<{
    category: string;
    amountFrom: string;
    amountTo: string | null;
    ratePercent: string;
    fixedDeduction: string;
  }>;
}

export async function seedTenantDatabase(options: SeedTenantOptions): Promise<{
  adminUserId: string;
  tempPasswordPlain: string;
}> {
  const {
    connectionUrl,
    legalName,
    displayName,
    companyCode,
    adminEmail,
    adminPasswordPlain,
    industryType,
    contactPhone,
    panVatNumber,
    registrationNumber,
    headOfficeAddress,
    headOfficeBranchCode,
    headOfficeBranchAddress,
    fiscalYear,
    leaveTypes,
    otHourlyMultiplier,
    payHeads,
    taxSlabs,
  } = options;

  const tempPasswordPlain =
    adminPasswordPlain ||
    process.env.DEFAULT_TENANT_ADMIN_PASSWORD ||
    process.env.INITIAL_ADMIN_PASSWORD ||
    'Password123!';

  const sql = postgres(connectionUrl, { max: 1 });
  const tenantDb = drizzle(sql, { schema });

  try {
    // 1. SEED PERMISSIONS MATRIX (Action x Module)
    const ACTIONS = schema.actionEnum.enumValues;
    const MODULES = schema.moduleEnum.enumValues;

    for (const mod of MODULES) {
      for (const act of ACTIONS) {
        await tenantDb
          .insert(schema.permissions)
          .values({ action: act, module: mod })
          .onConflictDoNothing();
      }
    }

    // 2. SEED PROTECTED ROLES
    const [officeAdminRole] = await tenantDb
      .insert(schema.roles)
      .values({
        name: 'Office Administrator',
        slug: 'office_admin',
        scopeType: 'GLOBAL',
        isSystemRole: true,
        isProtected: true,
        description: 'Primary Office Administrator for company tenant. Full administrative authority.',
      })
      .onConflictDoNothing({ target: schema.roles.slug })
      .returning();

    await tenantDb
      .insert(schema.roles)
      .values({
        name: 'Employee Self-Service',
        slug: 'employee',
        scopeType: 'SELF',
        isSystemRole: true,
        isProtected: true,
        description: 'Standard employee role for self-service portal, payslip viewing, and leave requests.',
      })
      .onConflictDoNothing({ target: schema.roles.slug });

    // Resolve Office Admin role ID
    const targetAdminRole =
      officeAdminRole ||
      (
        await tenantDb
          .select()
          .from(schema.roles)
          .where(eq(schema.roles.slug, 'office_admin'))
          .limit(1)
      )[0];

    // Map all permissions to Office Administrator
    const allPermissions = await tenantDb.select().from(schema.permissions);
    for (const perm of allPermissions) {
      await tenantDb
        .insert(schema.rolePermissions)
        .values({
          roleId: targetAdminRole.id,
          permissionId: perm.id,
        })
        .onConflictDoNothing();
    }

    // 3. SEED FIRST HEAD OFFICE BRANCH
    const resolvedBranchCode = (headOfficeBranchCode || 'HO-01').trim();
    const resolvedBranchAddress = (headOfficeBranchAddress || headOfficeAddress || 'Head Office').trim();
    const resolvedPhone = (contactPhone || 'N/A').trim();

    let primaryBranchId: string;
    const existingBranch = await tenantDb
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.code, resolvedBranchCode))
      .limit(1);

    if (existingBranch.length > 0) {
      primaryBranchId = existingBranch[0].id;
    } else {
      const [insertedBranch] = await tenantDb
        .insert(schema.branches)
        .values({
          code: resolvedBranchCode,
          name: 'Head Office',
          location: resolvedBranchAddress,
          phone: resolvedPhone,
          email: adminEmail,
          status: 'active',
        })
        .returning({ id: schema.branches.id });
      primaryBranchId = insertedBranch.id;
    }

    // 4. SEED STARTER DEPARTMENTS & DESIGNATIONS
    const deptMap = new Map<string, string>();
    let primaryDeptId: string | null = null;

    for (const dept of DEFAULT_DEPARTMENTS) {
      const existingDept = await tenantDb
        .select()
        .from(schema.departments)
        .where(eq(schema.departments.code, dept.code))
        .limit(1);

      let deptId: string;
      if (existingDept.length === 0) {
        const [newDept] = await tenantDb
          .insert(schema.departments)
          .values({
            code: dept.code,
            name: dept.name,
            branchId: primaryBranchId,
            headName: dept.headName || 'Department Lead',
            description: dept.description || `${dept.name} department`,
            status: 'active',
            designationCount: 0,
            employeeCount: 0,
          })
          .returning({ id: schema.departments.id });
        deptId = newDept.id;
      } else {
        deptId = existingDept[0].id;
      }

      deptMap.set(dept.code, deptId);
      if (!primaryDeptId) primaryDeptId = deptId;
    }

    if (primaryDeptId) {
      for (const desig of DEFAULT_DESIGNATIONS) {
        let targetDeptId = primaryDeptId;
        const lower = desig.name.toLowerCase();
        if ((lower.includes('human resources') || lower.includes('hr')) && deptMap.has('HR')) {
          targetDeptId = deptMap.get('HR')!;
        } else if ((lower.includes('accountant') || lower.includes('finance')) && deptMap.has('FIN')) {
          targetDeptId = deptMap.get('FIN')!;
        } else if ((lower.includes('software') || lower.includes('engineer') || lower.includes('developer') || lower.includes('it')) && deptMap.has('IT')) {
          targetDeptId = deptMap.get('IT')!;
        } else if ((lower.includes('marketing') || lower.includes('sales')) && deptMap.has('MKT')) {
          targetDeptId = deptMap.get('MKT')!;
        } else if (deptMap.has('ADM')) {
          targetDeptId = deptMap.get('ADM')!;
        }

        const existingDesig = await tenantDb
          .select()
          .from(schema.designations)
          .where(eq(schema.designations.name, desig.name))
          .limit(1);

        if (existingDesig.length === 0) {
          await tenantDb.insert(schema.designations).values({
            name: desig.name,
            departmentId: targetDeptId,
            description: desig.description || desig.name,
            status: 'active',
            employeeCount: 0,
          });
        }
      }

      // Sync designation counts
      for (const [_, deptId] of deptMap.entries()) {
        const desigList = await tenantDb
          .select({ id: schema.designations.id })
          .from(schema.designations)
          .where(eq(schema.designations.departmentId, deptId));

        await tenantDb
          .update(schema.departments)
          .set({ designationCount: desigList.length, updatedAt: new Date() })
          .where(eq(schema.departments.id, deptId));
      }
    }

    // 5. SEED ACTIVE FISCAL YEAR
    const defaultPresets = getAvailableFiscalYearPresets();
    const targetFY = fiscalYear || defaultPresets.current;

    const existingFY = await tenantDb
      .select()
      .from(schema.fiscalYears)
      .where(eq(schema.fiscalYears.slug, targetFY.slug))
      .limit(1);

    let fiscalYearId: string;
    if (existingFY.length === 0) {
      const [newFY] = await tenantDb
        .insert(schema.fiscalYears)
        .values({
          label: targetFY.label,
          slug: targetFY.slug,
          fromMonth: 4, // Shrawan
          toMonth: 3, // Asar
          startDateBS: targetFY.startDateBS,
          endDateBS: targetFY.endDateBS,
          startDateAD: new Date(targetFY.startDateAD),
          endDateAD: new Date(targetFY.endDateAD),
          status: 'Active',
          payslipsGenerated: false,
        })
        .returning({ id: schema.fiscalYears.id });
      fiscalYearId = newFY.id;
    } else {
      fiscalYearId = existingFY[0].id;
    }

    // 6. SEED TAX RATE SLABS (Tied to the initial active fiscal year)
    const standardTaxSlabs = (taxSlabs && taxSlabs.length > 0 
      ? taxSlabs 
      : DEFAULT_NEPAL_POLICY_PACK_V1.taxSlabsBaseline) || [];

    const existingSlabs = await tenantDb
      .select({ id: schema.taxRateSlabs.id })
      .from(schema.taxRateSlabs)
      .where(eq(schema.taxRateSlabs.fiscalYearId, fiscalYearId))
      .limit(1);

    if (existingSlabs.length === 0) {
      for (const slab of standardTaxSlabs) {
        await tenantDb.insert(schema.taxRateSlabs).values({
          fiscalYearId,
          category: slab.category,
          amountFrom: String(slab.amountFrom),
          amountTo: slab.amountTo !== null && slab.amountTo !== undefined && slab.amountTo !== '' ? String(slab.amountTo) : null,
          ratePercent: String(slab.ratePercent),
          fixedDeduction: String(slab.fixedDeduction || '0'),
        });
      }
    }

    // 7. SEED STATUTORY LEAVE TYPES & LEAVE RULES (Nepal Labour Act 2074)
    const targetLeaveTypes = leaveTypes && leaveTypes.length > 0 ? leaveTypes : DEFAULT_NEPAL_LEAVE_TYPES;

    for (const lt of targetLeaveTypes) {
      let leaveTypeId: string;
      const existingLT = await tenantDb
        .select()
        .from(schema.leaveTypes)
        .where(eq(schema.leaveTypes.code, lt.code))
        .limit(1);

      if (existingLT.length === 0) {
        const [insertedLT] = await tenantDb
          .insert(schema.leaveTypes)
          .values({
            name: lt.name,
            code: lt.code,
            leaveType: lt.isPaid ? 'Pay' : 'Non-Pay',
            noOfDays: String(lt.daysPerYear),
            carryForward: (lt.maxAccumulation || 0) > 0,
            accumulationCap: String(lt.maxAccumulation || 0),
            isStatutory: true,
            statutoryCode: lt.code,
            genderApplicable: lt.genderSpecific || 'All',
            isEncashable: Boolean(lt.isEncashable),
            encashmentBasis: 'BasicSalary',
            proRataForNewJoinees: true,
            isPlatformLocked: true,
            isActive: true,
          })
          .returning({ id: schema.leaveTypes.id });
        leaveTypeId = insertedLT.id;
      } else {
        leaveTypeId = existingLT[0].id;
      }

      // Seed matching statutory Leave Rule
      const existingRule = await tenantDb
        .select()
        .from(schema.leaveRules)
        .where(eq(schema.leaveRules.leaveTypeId, leaveTypeId))
        .limit(1);

      if (existingRule.length === 0) {
        const isDaysWorked = lt.code === 'HOME' || lt.code === 'SUBSTITUTE';
        const ruleName = `${lt.name.split(' (')[0]} Statutory Rule`;
        const accrualMethod = isDaysWorked ? 'DAYS_WORKED' : 'FIXED_ANNUAL';
        const accrualValue = lt.code === 'HOME' ? '20' : String(lt.daysPerYear);

        await tenantDb.insert(schema.leaveRules).values({
          leaveTypeId,
          ruleName,
          ruleCategory: 'STATUTORY',
          accrualMethod,
          accrualValue,
          encashmentRate: 'BASIC_DAILY',
          encashmentFixedAmount: '0',
          minServiceDaysForEligibility: 0,
          isPlatformLocked: true,
          isActive: true,
        });
      }
    }

    // 8. SEED OVERTIME RULES
    const otRate = String(otHourlyMultiplier || 1.5);
    const existingOT = await tenantDb
      .select()
      .from(schema.otRules)
      .where(eq(schema.otRules.platformCode, 'OT_STANDARD'))
      .limit(1);

    if (existingOT.length === 0) {
      await tenantDb.insert(schema.otRules).values({
        ruleName: `Standard Nepal Labour Act Overtime (${otRate}x)`,
        ruleType: 'Hourly',
        rateOfficeDay: otRate,
        rateOffDay: otRate,
        isPlatformLocked: true,
        platformCode: 'OT_STANDARD',
        isActive: true,
      });
    }

    // 9. SEED PAY HEADS (Standard Earnings & Statutory Deductions)
    const targetPayHeads = payHeads && payHeads.length > 0 ? payHeads : DEFAULT_PAY_HEADS;

    for (const ph of targetPayHeads) {
      const existingPH = await tenantDb
        .select()
        .from(schema.payHeads)
        .where(eq(schema.payHeads.code, ph.code))
        .limit(1);

      if (existingPH.length === 0) {
        await tenantDb.insert(schema.payHeads).values({
          name: ph.name,
          code: ph.code,
          type: ph.type === 'EARNING' ? 'allowance' : 'deduction',
          effectOnTax: ph.isTaxable,
          calcBasis: 'BasicSalary',
          calcParameter: 'BasicSalary',
          calcPercent:
            ph.code === 'SSF-ER'
              ? '20'
              : ph.code === 'SSF'
              ? '31'
              : ph.code === 'EPF'
              ? '10'
              : '0',
          isFestivalAllowance: ph.code === 'FESTIVAL',
          isSsfHead: Boolean(ph.isSsfHead),
          isSsfEmployerHead: Boolean(ph.isSsfEmployerHead),
          isCitHead: Boolean(ph.isCitHead),
          isPfHead: Boolean(ph.isPfHead),
          isTdsHead: Boolean(ph.isTdsHead),
        });
      }
    }

    // 10. CREATE INITIAL OFFICE ADMIN USER ACCOUNT
    const passwordHash = await bcrypt.hash(tempPasswordPlain, 12);
    const [adminUser] = await tenantDb
      .insert(schema.users)
      .values({
        name: `${displayName || legalName} Admin`,
        email: adminEmail,
        passwordHash,
        isActive: true,
        mustChangePassword: true, // First login requires forced password change
      })
      .onConflictDoNothing({ target: schema.users.email })
      .returning();

    const targetUser =
      adminUser ||
      (
        await tenantDb
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, adminEmail))
          .limit(1)
      )[0];

    // If admin user already existed and was re-seeded, update password hash & require password change
    if (!adminUser && targetUser) {
      await tenantDb
        .update(schema.users)
        .set({
          passwordHash,
          mustChangePassword: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, targetUser.id));
    }

    // Assign Office Admin role
    await tenantDb
      .insert(schema.userRoles)
      .values({
        userId: targetUser.id,
        roleId: targetAdminRole.id,
      })
      .onConflictDoNothing();

    // 11. SEED INITIAL SYSTEM CONFIG
    const initialConfigs = [
      { key: 'onboarding_completed', value: 'true', dataType: 'boolean' },
      { key: 'onboarding_completed_at', value: new Date().toISOString(), dataType: 'string' },
      { key: 'company_legal_name', value: legalName, dataType: 'string' },
      { key: 'company_display_name', value: displayName || legalName, dataType: 'string' },
      { key: 'company_code', value: companyCode, dataType: 'string' },
      { key: 'company_contact_email', value: adminEmail, dataType: 'string' },
      { key: 'company_phone', value: contactPhone || '', dataType: 'string' },
      { key: 'company_pan_vat', value: panVatNumber || '', dataType: 'string' },
      { key: 'company_registration_no', value: registrationNumber || '', dataType: 'string' },
      { key: 'company_office_address', value: headOfficeAddress || '', dataType: 'string' },
      { key: 'company_currency', value: 'NPR', dataType: 'string' },
      { key: 'company_industry_type', value: industryType || 'General', dataType: 'string' },
      { key: 'active_fiscal_year_label', value: targetFY.label, dataType: 'string' },
    ];

    for (const conf of initialConfigs) {
      await tenantDb
        .insert(schema.systemConfig)
        .values(conf)
        .onConflictDoUpdate({
          target: schema.systemConfig.key,
          set: { value: conf.value, updatedAt: new Date() },
        });
    }

    return {
      adminUserId: targetUser.id,
      tempPasswordPlain,
    };
  } finally {
    await sql.end();
  }
}
