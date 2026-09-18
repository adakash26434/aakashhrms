import type { Branch } from './branch';
import type { Department } from './department';
import type { Designation } from './designation';
import type { ShreniLevelItem } from './shreni';

export interface EmploymentType {
  id: string;
  code: string;
  name: string;
  nameNepali?: string | null;
  isPfEligible: boolean;
  isSsfEligible: boolean;
  isFestivalEligible: boolean;
  isLeaveEligible: boolean;
  isOtEligible: boolean;
  noticePeriodDays: number;
  probationMonths: number;
  rankOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmploymentTypeFormData {
  code: string;
  name: string;
  nameNepali?: string;
  isPfEligible: boolean;
  isSsfEligible: boolean;
  isFestivalEligible: boolean;
  isLeaveEligible: boolean;
  isOtEligible: boolean;
  noticePeriodDays: number;
  probationMonths: number;
  rankOrder?: number;
  isActive?: boolean;
}

export interface CompanyWorkSchedule {
  workingDaysPerWeek: number; // 5 or 6
  weeklyOffDays: string[]; // ["Saturday"] or ["Saturday", "Sunday"] or ["Friday", "Saturday"]
  coreStartTime: string; // e.g. "09:00"
  coreEndTime: string; // e.g. "17:00"
  winterStartTime?: string; // e.g. "10:00"
  winterEndTime?: string; // e.g. "16:00"
  lunchBreakMinutes: number; // e.g. 45
  gracePeriodMinutes: number; // e.g. 15
  halfDayThresholdHours: number; // e.g. 4
}

export interface CompanyProfileSetupData {
  legalName: string;
  displayName: string;
  panVatNumber: string;
  registrationNumber: string;
  industryType: string;
  contactEmail: string;
  contactPhone: string;
  headOfficeAddress: string;
  headOfficeBranchCode: string;
  logoUrl?: string;
  signatory1Name?: string;
  signatory1Title?: string;
  signatory2Name?: string;
  signatory2Title?: string;
}

export interface CompanyMasterSetupData {
  shreniLevels: ShreniLevelItem[];
  branches: Branch[];
  departments: Department[];
  designations: Designation[];
  employmentTypes: EmploymentType[];
  workSchedule: CompanyWorkSchedule;
  companyProfile: CompanyProfileSetupData;
}
