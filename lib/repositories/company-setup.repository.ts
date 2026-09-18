import { getDb } from '@/lib/db';
import { systemConfig, branches } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type {
  CompanyWorkSchedule,
  CompanyProfileSetupData,
  CompanyMasterSetupData,
} from '@/lib/types/company-setup';
import { findAllShreniLevels } from './shreni.repository';
import { findAllBranches } from './branch.repository';
import { findAllDepartments } from './department.repository';
import { findAllDesignations } from './designation.repository';
import { findAllEmploymentTypes } from './employment-type.repository';

export async function getCompanyWorkSchedule(): Promise<CompanyWorkSchedule> {
  const db = getDb();
  const rows = await db.select().from(systemConfig);
  const configMap = new Map(rows.map((r) => [r.key, r.value]));

  let weeklyOff = ['Saturday'];
  try {
    const rawOff = configMap.get('workSchedule.weeklyOffDays');
    if (rawOff) weeklyOff = JSON.parse(rawOff);
  } catch {}

  return {
    workingDaysPerWeek: Number(configMap.get('workSchedule.workingDaysPerWeek')) || 6,
    weeklyOffDays: weeklyOff,
    coreStartTime: configMap.get('workSchedule.coreStartTime') || configMap.get('officeTime.startTime') || '09:00',
    coreEndTime: configMap.get('workSchedule.coreEndTime') || configMap.get('officeTime.endTime') || '17:00',
    winterStartTime: configMap.get('workSchedule.winterStartTime') || '10:00',
    winterEndTime: configMap.get('workSchedule.winterEndTime') || '16:00',
    lunchBreakMinutes: Number(configMap.get('workSchedule.lunchBreakMinutes')) || 45,
    gracePeriodMinutes: Number(configMap.get('workSchedule.gracePeriodMinutes')) || Number(configMap.get('officeTime.gracePeriodMinutes')) || 15,
    halfDayThresholdHours: Number(configMap.get('workSchedule.halfDayThresholdHours')) || Number(configMap.get('officeTime.halfDayThresholdHours')) || 4,
  };
}

export async function saveCompanyWorkSchedule(data: CompanyWorkSchedule): Promise<void> {
  const db = getDb();
  const entries: Array<{ key: string; value: string }> = [
    { key: 'workSchedule.workingDaysPerWeek', value: String(data.workingDaysPerWeek) },
    { key: 'workSchedule.weeklyOffDays', value: JSON.stringify(data.weeklyOffDays) },
    { key: 'workSchedule.coreStartTime', value: data.coreStartTime },
    { key: 'workSchedule.coreEndTime', value: data.coreEndTime },
    { key: 'workSchedule.winterStartTime', value: data.winterStartTime || '10:00' },
    { key: 'workSchedule.winterEndTime', value: data.winterEndTime || '16:00' },
    { key: 'workSchedule.lunchBreakMinutes', value: String(data.lunchBreakMinutes) },
    { key: 'workSchedule.gracePeriodMinutes', value: String(data.gracePeriodMinutes) },
    { key: 'workSchedule.halfDayThresholdHours', value: String(data.halfDayThresholdHours) },
    // Also sync to legacy officeTime keys for backwards compatibility with attendance engine
    { key: 'officeTime.startTime', value: data.coreStartTime },
    { key: 'officeTime.endTime', value: data.coreEndTime },
    { key: 'officeTime.gracePeriodMinutes', value: String(data.gracePeriodMinutes) },
    { key: 'officeTime.halfDayThresholdHours', value: String(data.halfDayThresholdHours) },
  ];

  for (const item of entries) {
    await db
      .insert(systemConfig)
      .values({
        key: item.key,
        value: item.value,
        dataType: 'string',
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: item.value, updatedAt: new Date() },
      });
  }
}

export async function getCompanyProfileSetup(): Promise<CompanyProfileSetupData> {
  const db = getDb();
  const [rows, branchList] = await Promise.all([
    db.select().from(systemConfig),
    db.select().from(branches).limit(5),
  ]);
  const configMap = new Map(rows.map((r) => [r.key, r.value]));

  const primaryBranch = branchList.find((b) => b.isHeadOffice) || branchList[0];

  return {
    legalName: configMap.get('company_legal_name') || 'Organization Head Office',
    displayName: configMap.get('company_display_name') || configMap.get('company_legal_name') || 'Company Workspace',
    panVatNumber: configMap.get('company_pan_vat') || '',
    registrationNumber: configMap.get('company_registration_no') || '',
    industryType: configMap.get('company_industry_type') || 'General',
    contactEmail: configMap.get('company_email') || '',
    contactPhone: configMap.get('company_phone') || primaryBranch?.phone || '',
    headOfficeAddress: configMap.get('company_office_address') || primaryBranch?.location || '',
    headOfficeBranchCode: primaryBranch?.code || 'HO-01',
    logoUrl: configMap.get('company_logo_url') || '',
    signatory1Name: configMap.get('company_signatory1_name') || '',
    signatory1Title: configMap.get('company_signatory1_title') || '',
    signatory2Name: configMap.get('company_signatory2_name') || '',
    signatory2Title: configMap.get('company_signatory2_title') || '',
  };
}

export async function saveCompanyProfileSetup(data: CompanyProfileSetupData): Promise<void> {
  const db = getDb();
  // Only Tier 2 fields are self-service editable by tenant
  const entries: Array<{ key: string; value: string }> = [
    { key: 'company_display_name', value: (data.displayName || data.legalName).trim() },
    { key: 'company_email', value: data.contactEmail.trim() },
    { key: 'company_phone', value: data.contactPhone.trim() },
    { key: 'company_logo_url', value: data.logoUrl?.trim() || '' },
    { key: 'company_signatory1_name', value: data.signatory1Name?.trim() || '' },
    { key: 'company_signatory1_title', value: data.signatory1Title?.trim() || '' },
    { key: 'company_signatory2_name', value: data.signatory2Name?.trim() || '' },
    { key: 'company_signatory2_title', value: data.signatory2Title?.trim() || '' },
  ];

  for (const item of entries) {
    await db
      .insert(systemConfig)
      .values({
        key: item.key,
        value: item.value,
        dataType: 'string',
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: item.value, updatedAt: new Date() },
      });
  }
}

/**
 * Synchronizes Tier 1 legal fields directly to tenant systemConfig upon Super Admin verification/approval
 */
export async function syncCompanyTier1Fields(
  tenantDb: any,
  tier1: {
    legalName: string;
    panVatNumber?: string | null;
    registrationNumber?: string | null;
    industryType?: string | null;
    headOfficeAddress?: string | null;
  }
): Promise<void> {
  const entries: Array<{ key: string; value: string }> = [
    { key: 'company_legal_name', value: tier1.legalName.trim() },
    { key: 'company_pan_vat', value: (tier1.panVatNumber || '').trim() },
    { key: 'company_registration_no', value: (tier1.registrationNumber || '').trim() },
    { key: 'company_industry_type', value: (tier1.industryType || 'General').trim() },
    { key: 'company_office_address', value: (tier1.headOfficeAddress || '').trim() },
  ];

  for (const item of entries) {
    await tenantDb
      .insert(systemConfig)
      .values({
        key: item.key,
        value: item.value,
        dataType: 'string',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: item.value, updatedAt: new Date() },
      });
  }
}


/**
 * Loads complete organizational master setup bundle in parallel
 */
export async function getCompanyMasterSetupBundle(): Promise<CompanyMasterSetupData> {
  const [
    shreniLevels,
    branches,
    departments,
    designations,
    employmentTypes,
    workSchedule,
    companyProfile,
  ] = await Promise.all([
    findAllShreniLevels(),
    findAllBranches(),
    findAllDepartments(),
    findAllDesignations(),
    findAllEmploymentTypes(),
    getCompanyWorkSchedule(),
    getCompanyProfileSetup(),
  ]);

  return {
    shreniLevels,
    branches,
    departments,
    designations,
    employmentTypes,
    workSchedule,
    companyProfile,
  };
}
