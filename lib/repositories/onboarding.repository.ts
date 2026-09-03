import { getDb, getDbAsync } from '@/lib/db';
import {
  systemConfig,
  fiscalYears,
  taxRateSlabs,
  branches,
  departments,
  designations,
  leaveTypes,
  leaveRules,
  otRules,
  payHeads,
  users,
  auditLogs,
} from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import type {
  OnboardingStep2CompanyInput,
  OnboardingStep3OrgInput,
  OnboardingStep4LeaveOtInput,
  OnboardingStep5PayHeadsInput,
  OnboardingStatus,
} from '@/lib/types/onboarding';
import { platformDb } from '@/lib/platform/db';
import { companies } from '@/lib/platform/schema';

export async function getOnboardingStatus(
  currentUserId: string,
  tenantSlug?: string
): Promise<OnboardingStatus> {
  const db = await getDbAsync(tenantSlug);

  // 1. Fetch system_config keys
  const configRows = await db.select().from(systemConfig);
  const configMap = new Map(configRows.map((r) => [r.key, r.value]));

  const isCompleted = configMap.get('onboarding_completed') === 'true';
  const completedAt = configMap.get('onboarding_completed_at') || null;

  // 2. Fetch user's mustChangePassword status
  const userRows = await db.select().from(users).where(eq(users.id, currentUserId));
  const mustChangePassword = userRows.length > 0 ? Boolean(userRows[0].mustChangePassword) : true;

  // 3. Resolve company metadata from platform DB if available
  let companyName = configMap.get('company_legal_name') || '';
  let contactEmail = configMap.get('company_email') || '';
  let contactPhone = configMap.get('company_phone') || '';
  let registeredCity = configMap.get('company_city') || '';

  if ((!companyName || !contactEmail) && tenantSlug) {
    try {
      const companyRows = await platformDb
        .select()
        .from(companies)
        .where(eq(companies.slug, tenantSlug));
      if (companyRows.length > 0) {
        const comp = companyRows[0];
        companyName = comp.legalName || comp.displayName || '';
        contactEmail = comp.contactEmail || '';
        contactPhone = comp.contactPhone || '';
      }
    } catch {
      // Platform DB optional fallback
    }
  }

  let industryType = configMap.get('company_industry_type') || 'General';

  return {
    isCompleted,
    completedAt,
    mustChangePassword,
    currentStep: isCompleted ? 5 : 1,
    companyName: companyName || 'My Organization',
    companySlug: tenantSlug || '',
    contactEmail: contactEmail || (userRows[0]?.email || ''),
    contactPhone,
    registeredCity,
    industryType,
  };
}

export async function updateUserPassword(
  userId: string,
  passwordHash: string,
  setMustChangePasswordFalse = true
): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: setMustChangePasswordFalse ? false : undefined,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function clearMustChangePasswordFlag(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function saveCompanyProfile(data: OnboardingStep2CompanyInput): Promise<void> {
  const db = getDb();

  // Protect company_industry_type: Super Admin exclusively controls this.
  // If already set in tenant system_config, preserve it strictly.
  const existingIndustryConfig = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, 'company_industry_type'))
    .limit(1);

  const lockedIndustryType =
    existingIndustryConfig.length > 0 && existingIndustryConfig[0].value
      ? existingIndustryConfig[0].value
      : data.industryType || 'General';

  const configsToSet = [
    { key: 'company_legal_name', value: data.legalName, dataType: 'string' },
    { key: 'company_pan_vat', value: data.panVatNumber || '', dataType: 'string' },
    { key: 'company_registration_no', value: data.registrationNumber || '', dataType: 'string' },
    { key: 'company_phone', value: data.contactPhone, dataType: 'string' },
    { key: 'company_email', value: data.contactEmail, dataType: 'string' },
    { key: 'company_office_address', value: data.officeAddress, dataType: 'string' },
    { key: 'company_currency', value: data.currency || 'NPR', dataType: 'string' },
    { key: 'company_industry_type', value: lockedIndustryType, dataType: 'string' },
    { key: 'active_fiscal_year_label', value: data.fiscalYearLabel, dataType: 'string' },
  ];

  // Upsert config keys
  for (const cfg of configsToSet) {
    await db
      .insert(systemConfig)
      .values(cfg)
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: cfg.value, updatedAt: new Date() },
      });
  }

  // Ensure active Fiscal Year exists
  const existingFY = await db
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.slug, data.fiscalYearSlug));

  if (existingFY.length === 0) {
    const [newFY] = await db
      .insert(fiscalYears)
      .values({
        label: data.fiscalYearLabel,
        slug: data.fiscalYearSlug,
        fromMonth: 4, // Shrawan
        toMonth: 3, // Asar
        startDateBS: data.startDateBS,
        endDateBS: data.endDateBS,
        startDateAD: new Date(data.startDateAD),
        endDateAD: new Date(data.endDateAD),
        status: 'Active',
        payslipsGenerated: false,
      })
      .returning({ id: fiscalYears.id });

    // Seed standard Nepal IRD Progressive Income Tax Slabs for this fiscal year
    const standardSlabs = [
      // Normal Single Individual
      { category: 'Normal Single', amountFrom: '0', amountTo: '500000', ratePercent: '1.00', fixedDeduction: '0' },
      { category: 'Normal Single', amountFrom: '500000', amountTo: '700000', ratePercent: '10.00', fixedDeduction: '5000' },
      { category: 'Normal Single', amountFrom: '700000', amountTo: '1000000', ratePercent: '20.00', fixedDeduction: '25000' },
      { category: 'Normal Single', amountFrom: '1000000', amountTo: '2000000', ratePercent: '30.00', fixedDeduction: '85000' },
      { category: 'Normal Single', amountFrom: '2000000', amountTo: null, ratePercent: '36.00', fixedDeduction: '385000' },

      // Married Couple
      { category: 'Married', amountFrom: '0', amountTo: '600000', ratePercent: '1.00', fixedDeduction: '0' },
      { category: 'Married', amountFrom: '600000', amountTo: '800000', ratePercent: '10.00', fixedDeduction: '6000' },
      { category: 'Married', amountFrom: '800000', amountTo: '1100000', ratePercent: '20.00', fixedDeduction: '26000' },
      { category: 'Married', amountFrom: '1100000', amountTo: '2000000', ratePercent: '30.00', fixedDeduction: '86000' },
      { category: 'Married', amountFrom: '2000000', amountTo: null, ratePercent: '36.00', fixedDeduction: '356000' },

      // Widow
      { category: 'Widow', amountFrom: '0', amountTo: '500000', ratePercent: '0.00', fixedDeduction: '0' },
      { category: 'Widow', amountFrom: '500000', amountTo: '2000000', ratePercent: '10.00', fixedDeduction: '0' },
      { category: 'Widow', amountFrom: '2000000', amountTo: null, ratePercent: '20.00', fixedDeduction: '150000' },

      // Handicapped
      { category: 'Handicapped', amountFrom: '0', amountTo: '500000', ratePercent: '1.00', fixedDeduction: '0' },
      { category: 'Handicapped', amountFrom: '500000', amountTo: '700000', ratePercent: '5.00', fixedDeduction: '2500' },
      { category: 'Handicapped', amountFrom: '700000', amountTo: '2000000', ratePercent: '10.00', fixedDeduction: '12500' },
      { category: 'Handicapped', amountFrom: '2000000', amountTo: null, ratePercent: '15.00', fixedDeduction: '142500' },
    ];

    for (const slab of standardSlabs) {
      await db.insert(taxRateSlabs).values({
        fiscalYearId: newFY.id,
        category: slab.category,
        amountFrom: slab.amountFrom,
        amountTo: slab.amountTo,
        ratePercent: slab.ratePercent,
        fixedDeduction: slab.fixedDeduction,
      });
    }
  }
}

export async function bootstrapOrgStructure(data: OnboardingStep3OrgInput): Promise<void> {
  const db = getDb();

  // 1. Insert or update Primary Branch
  let primaryBranchId: string;
  const existingBranch = await db
    .select()
    .from(branches)
    .where(eq(branches.code, data.branchCode));

  if (existingBranch.length > 0) {
    primaryBranchId = existingBranch[0].id;
    await db
      .update(branches)
      .set({
        name: data.branchName,
        location: data.branchLocation,
        phone: data.branchPhone,
        email: data.branchEmail,
        updatedAt: new Date(),
      })
      .where(eq(branches.id, primaryBranchId));
  } else {
    const [inserted] = await db
      .insert(branches)
      .values({
        code: data.branchCode,
        name: data.branchName,
        location: data.branchLocation,
        phone: data.branchPhone,
        email: data.branchEmail,
        status: 'active',
      })
      .returning({ id: branches.id });
    primaryBranchId = inserted.id;
  }

  // 2. Insert standard Departments
  const deptMap = new Map<string, string>();
  let primaryDeptId: string | null = null;

  for (const dept of data.departments) {
    const existingDept = await db
      .select()
      .from(departments)
      .where(eq(departments.code, dept.code));

    let deptId: string;
    if (existingDept.length === 0) {
      const [newDept] = await db
        .insert(departments)
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
        .returning({ id: departments.id });
      deptId = newDept.id;
    } else {
      deptId = existingDept[0].id;
    }

    deptMap.set(dept.code, deptId);
    if (!primaryDeptId) primaryDeptId = deptId;
  }

  // 3. Insert standard Designations with department mapping
  if (primaryDeptId) {
    for (const desig of data.designations) {
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

      const existingDesig = await db
        .select()
        .from(designations)
        .where(eq(designations.name, desig.name));

      if (existingDesig.length === 0) {
        await db.insert(designations).values({
          name: desig.name,
          departmentId: targetDeptId,
          description: desig.description || desig.name,
          status: 'active',
          employeeCount: 0,
        });
      }
    }

    // Synchronize designation counts for all departments
    for (const [_, deptId] of deptMap.entries()) {
      const desigList = await db
        .select({ id: designations.id })
        .from(designations)
        .where(eq(designations.departmentId, deptId));

      await db
        .update(departments)
        .set({ designationCount: desigList.length, updatedAt: new Date() })
        .where(eq(departments.id, deptId));
    }
  }
}

export async function bootstrapStatutoryLeavesAndOT(
  data: OnboardingStep4LeaveOtInput
): Promise<void> {
  const db = getDb();

  // 1. Insert Leave Types and matching Statutory Leave Rules
  for (const lt of data.leaveTypes) {
    let leaveTypeId: string;
    const existing = await db
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.code, lt.code));

    if (existing.length === 0) {
      const [inserted] = await db
        .insert(leaveTypes)
        .values({
          name: lt.name,
          code: lt.code,
          leaveType: lt.isPaid ? 'Pay' : 'Non-Pay',
          noOfDays: String(lt.daysPerYear),
          carryForward: lt.maxAccumulation > 0,
          accumulationCap: String(lt.maxAccumulation),
          isStatutory: true,
          statutoryCode: lt.code,
          genderApplicable: lt.genderSpecific || 'All',
          isEncashable: lt.isEncashable,
          encashmentBasis: 'BasicSalary',
          proRataForNewJoinees: true,
          isActive: true,
        })
        .returning({ id: leaveTypes.id });
      leaveTypeId = inserted.id;
    } else {
      leaveTypeId = existing[0].id;
    }

    // Seed matching statutory Leave Rule
    const existingRule = await db
      .select()
      .from(leaveRules)
      .where(eq(leaveRules.leaveTypeId, leaveTypeId));

    if (existingRule.length === 0) {
      const isDaysWorked = lt.code === 'HOME' || lt.code === 'SUBSTITUTE';
      const ruleName = `${lt.name.split(' (')[0]} Statutory Rule`;
      const accrualMethod = isDaysWorked ? 'DAYS_WORKED' : 'FIXED_ANNUAL';
      const accrualValue = lt.code === 'HOME' ? '20' : String(lt.daysPerYear);

      await db.insert(leaveRules).values({
        leaveTypeId,
        ruleName,
        ruleCategory: 'STATUTORY',
        accrualMethod,
        accrualValue,
        encashmentRate: lt.isEncashable ? 'BASIC_DAILY' : 'BASIC_DAILY',
        encashmentFixedAmount: '0',
        minServiceDaysForEligibility: 0,
        isPlatformLocked: true,
        isActive: true,
      });
    }
  }

  // 2. Insert / Update Default Overtime Rule
  const existingOT = await db
    .select()
    .from(otRules)
    .where(eq(otRules.ruleName, 'Standard Nepal Labour Act Overtime (1.5x)'));

  if (existingOT.length === 0) {
    await db.insert(otRules).values({
      ruleName: 'Standard Nepal Labour Act Overtime (1.5x)',
      ruleType: 'Hourly',
      rateOfficeDay: String(data.otHourlyMultiplier || 1.5),
      rateOffDay: String(data.otHourlyMultiplier || 1.5),
      isPlatformLocked: true,
      isActive: true,
    });
  }
}

export async function bootstrapPayHeads(data: OnboardingStep5PayHeadsInput): Promise<void> {
  const db = getDb();

  for (const ph of data.payHeads) {
    const existing = await db
      .select()
      .from(payHeads)
      .where(eq(payHeads.code, ph.code));

    if (existing.length === 0) {
      await db.insert(payHeads).values({
        name: ph.name,
        code: ph.code,
        type: ph.type === 'EARNING' ? 'allowance' : 'deduction',
        effectOnTax: ph.isTaxable,
        calcBasis: 'BasicSalary',
        calcParameter: 'BasicSalary',
        calcPercent: '0',
        isFestivalAllowance: ph.code === 'FESTIVAL',
        isSsfHead: Boolean(ph.isSsfHead),
        isCitHead: Boolean(ph.isCitHead),
        isPfHead: Boolean(ph.isPfHead),
        isTdsHead: Boolean(ph.isTdsHead),
      });
    }
  }
}

export async function completeOnboarding(changedByUserId: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .insert(systemConfig)
    .values({
      key: 'onboarding_completed',
      value: 'true',
      dataType: 'boolean',
    })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: 'true', updatedAt: new Date() },
    });

  await db
    .insert(systemConfig)
    .values({
      key: 'onboarding_completed_at',
      value: now,
      dataType: 'string',
    })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: now, updatedAt: new Date() },
    });

  // Forensic Audit Log
  await db.insert(auditLogs).values({
    userId: changedByUserId,
    action: 'EDIT',
    module: 'SYSTEM_CONTROL',
    recordId: 'COMPANY_ONBOARDING',
    result: 'SUCCESS',
    newValues: {
      event: 'COMPANY_INITIAL_ONBOARDING_COMPLETED',
      completedAt: now,
      completedBy: changedByUserId,
    },
    ipAddress: '127.0.0.1',
  });
}
