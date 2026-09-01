import { getDb } from '@/lib/db';
import { systemConfig } from '@/lib/db/schema';
import type { SystemControlData, EmployeeCategory, Meridiem } from '@/lib/types/system-control';

// Default values as defined by the Excel specifications
const DEFAULT_SYSTEM_CONTROL: SystemControlData = {
  officeTime: {
    inTime: { hour: 10, minute: 0, meridiem: "AM" },
    outTime: { hour: 4, minute: 0, meridiem: "PM" },
    calculateOtAndAbsent: false,
    applyGraceWindow: false,
    graceWindowMinutes: 40,
    otMultiplierOfficeDay: 1.5,
    otMultiplierOffDay: 2.0,
  },
  manualAttendance: {
    defaultWhenNotPosted: "Absent",
    yearlyInsurancePremiumLimit: 0,
  },
  leavePermissions: {
    enabledCategories: {
      Permanent: true,
      Temporary: true,
      OutSource: false,
      Consultant: false,
      Trainee: false,
      Volunteer: false,
      Contract: true,
    },
  },
  statutoryDeductionLimits: {
    pfMaximumLimitPercent: 30,
    citLimitNpr: 300000,
    retirementFundLimitNpr: 500000,
    handicappedDeductionPercent: 50,
    companyHasSsf: false,
  },
  insuranceDiscounts: {
    medicalInsuranceNpr: 20000,
    houseInsuranceNpr: 5000,
    lifeInsuranceNpr: 25000,
    womenDiscountPercent: 10,
    remoteAllowanceNpr: 50000,
  },
};

export async function findSettings(): Promise<SystemControlData> {
  let rows: Array<{ key: string; value: string; dataType: string; updatedAt: Date }> = [];
  try {
    rows = await getDb().select().from(systemConfig);
  } catch (error) {
    console.warn('[SYSTEM_CONTROL_REPOSITORY] Failed to fetch system_config rows, falling back to defaults:', error);
    return DEFAULT_SYSTEM_CONTROL;
  }

  if (!rows || rows.length === 0) {
    return DEFAULT_SYSTEM_CONTROL;
  }

  // Strictly typed parsing helper
  function getBoolean(key: string, fallback: boolean): boolean {
    const row = rows.find(r => r.key === key);
    return row ? row.value === 'true' : fallback;
  }

  function getNumber(key: string, fallback: number): number {
    const row = rows.find(r => r.key === key);
    const num = row ? Number(row.value) : NaN;
    return !Number.isNaN(num) ? num : fallback;
  }

  function getString<T extends string>(key: string, fallback: T): T {
    const row = rows.find(r => r.key === key);
    return (row ? row.value : fallback) as T;
  }

  function getJson<T>(key: string, fallback: T): T {
    const row = rows.find(r => r.key === key);
    if (!row) return fallback;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  }

  // Reconstruct the deep object safely
  return {
    officeTime: {
      inTime: getJson('officeTime.inTime', DEFAULT_SYSTEM_CONTROL.officeTime.inTime),
      outTime: getJson('officeTime.outTime', DEFAULT_SYSTEM_CONTROL.officeTime.outTime),
      calculateOtAndAbsent: getBoolean('officeTime.calculateOtAndAbsent', DEFAULT_SYSTEM_CONTROL.officeTime.calculateOtAndAbsent),
      applyGraceWindow: getBoolean('officeTime.applyGraceWindow', DEFAULT_SYSTEM_CONTROL.officeTime.applyGraceWindow),
      graceWindowMinutes: getNumber('officeTime.graceWindowMinutes', DEFAULT_SYSTEM_CONTROL.officeTime.graceWindowMinutes),
      otMultiplierOfficeDay: getNumber('officeTime.otMultiplierOfficeDay', DEFAULT_SYSTEM_CONTROL.officeTime.otMultiplierOfficeDay ?? 1.5),
      otMultiplierOffDay: getNumber('officeTime.otMultiplierOffDay', DEFAULT_SYSTEM_CONTROL.officeTime.otMultiplierOffDay ?? 2.0),
    },
    manualAttendance: {
      defaultWhenNotPosted: getString('manualAttendance.defaultWhenNotPosted', DEFAULT_SYSTEM_CONTROL.manualAttendance.defaultWhenNotPosted),
      yearlyInsurancePremiumLimit: getNumber('manualAttendance.yearlyInsurancePremiumLimit', DEFAULT_SYSTEM_CONTROL.manualAttendance.yearlyInsurancePremiumLimit),
    },
    leavePermissions: {
      enabledCategories: getJson('leavePermissions.enabledCategories', DEFAULT_SYSTEM_CONTROL.leavePermissions.enabledCategories),
    },
    statutoryDeductionLimits: {
      pfMaximumLimitPercent: getNumber('statutoryDeductionLimits.pfMaximumLimitPercent', DEFAULT_SYSTEM_CONTROL.statutoryDeductionLimits.pfMaximumLimitPercent),
      citLimitNpr: getNumber('statutoryDeductionLimits.citLimitNpr', DEFAULT_SYSTEM_CONTROL.statutoryDeductionLimits.citLimitNpr),
      retirementFundLimitNpr: getNumber('statutoryDeductionLimits.retirementFundLimitNpr', DEFAULT_SYSTEM_CONTROL.statutoryDeductionLimits.retirementFundLimitNpr),
      handicappedDeductionPercent: getNumber('statutoryDeductionLimits.handicappedDeductionPercent', DEFAULT_SYSTEM_CONTROL.statutoryDeductionLimits.handicappedDeductionPercent),
      companyHasSsf: getBoolean('statutoryDeductionLimits.companyHasSsf', DEFAULT_SYSTEM_CONTROL.statutoryDeductionLimits.companyHasSsf),
    },
    insuranceDiscounts: {
      medicalInsuranceNpr: getNumber('insuranceDiscounts.medicalInsuranceNpr', DEFAULT_SYSTEM_CONTROL.insuranceDiscounts.medicalInsuranceNpr),
      houseInsuranceNpr: getNumber('insuranceDiscounts.houseInsuranceNpr', DEFAULT_SYSTEM_CONTROL.insuranceDiscounts.houseInsuranceNpr),
      lifeInsuranceNpr: getNumber('insuranceDiscounts.lifeInsuranceNpr', DEFAULT_SYSTEM_CONTROL.insuranceDiscounts.lifeInsuranceNpr),
      womenDiscountPercent: getNumber('insuranceDiscounts.womenDiscountPercent', DEFAULT_SYSTEM_CONTROL.insuranceDiscounts.womenDiscountPercent),
      remoteAllowanceNpr: getNumber('insuranceDiscounts.remoteAllowanceNpr', DEFAULT_SYSTEM_CONTROL.insuranceDiscounts.remoteAllowanceNpr),
    },
  };
}

export async function updateSettings(data: SystemControlData): Promise<SystemControlData> {
  const entries = [
    { key: 'officeTime.inTime', value: JSON.stringify(data.officeTime.inTime), dataType: 'json' },
    { key: 'officeTime.outTime', value: JSON.stringify(data.officeTime.outTime), dataType: 'json' },
    { key: 'officeTime.calculateOtAndAbsent', value: String(data.officeTime.calculateOtAndAbsent), dataType: 'boolean' },
    { key: 'officeTime.applyGraceWindow', value: String(data.officeTime.applyGraceWindow), dataType: 'boolean' },
    { key: 'officeTime.graceWindowMinutes', value: String(data.officeTime.graceWindowMinutes), dataType: 'number' },
    { key: 'officeTime.otMultiplierOfficeDay', value: String(data.officeTime.otMultiplierOfficeDay ?? 1.5), dataType: 'number' },
    { key: 'officeTime.otMultiplierOffDay', value: String(data.officeTime.otMultiplierOffDay ?? 2.0), dataType: 'number' },
    
    { key: 'manualAttendance.defaultWhenNotPosted', value: data.manualAttendance.defaultWhenNotPosted, dataType: 'string' },
    { key: 'manualAttendance.yearlyInsurancePremiumLimit', value: String(data.manualAttendance.yearlyInsurancePremiumLimit), dataType: 'number' },
    
    { key: 'leavePermissions.enabledCategories', value: JSON.stringify(data.leavePermissions.enabledCategories), dataType: 'json' },
    
    { key: 'statutoryDeductionLimits.pfMaximumLimitPercent', value: String(data.statutoryDeductionLimits.pfMaximumLimitPercent), dataType: 'number' },
    { key: 'statutoryDeductionLimits.citLimitNpr', value: String(data.statutoryDeductionLimits.citLimitNpr), dataType: 'number' },
    { key: 'statutoryDeductionLimits.retirementFundLimitNpr', value: String(data.statutoryDeductionLimits.retirementFundLimitNpr), dataType: 'number' },
    { key: 'statutoryDeductionLimits.handicappedDeductionPercent', value: String(data.statutoryDeductionLimits.handicappedDeductionPercent), dataType: 'number' },
    { key: 'statutoryDeductionLimits.companyHasSsf', value: String(data.statutoryDeductionLimits.companyHasSsf), dataType: 'boolean' },
    
    { key: 'insuranceDiscounts.medicalInsuranceNpr', value: String(data.insuranceDiscounts.medicalInsuranceNpr), dataType: 'number' },
    { key: 'insuranceDiscounts.houseInsuranceNpr', value: String(data.insuranceDiscounts.houseInsuranceNpr), dataType: 'number' },
    { key: 'insuranceDiscounts.lifeInsuranceNpr', value: String(data.insuranceDiscounts.lifeInsuranceNpr), dataType: 'number' },
    { key: 'insuranceDiscounts.womenDiscountPercent', value: String(data.insuranceDiscounts.womenDiscountPercent), dataType: 'number' },
    { key: 'insuranceDiscounts.remoteAllowanceNpr', value: String(data.insuranceDiscounts.remoteAllowanceNpr), dataType: 'number' },
  ];

  for (const entry of entries) {
    await getDb().insert(systemConfig)
      .values(entry)
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: entry.value, dataType: entry.dataType, updatedAt: new Date() },
      });
  }

  // Return the data back so the service can pass it back to the action
  return data;
}