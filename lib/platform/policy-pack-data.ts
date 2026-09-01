export interface StatutoryLeaveRule {
  code: string;
  name: string;
  nepaliName: string;
  statutoryCode: string;
  leaveType: 'Pay' | 'Non-Pay' | 'Partial-Pay';
  daysPerYear: number;
  maxAccumulation: number;
  maxPaidDays?: number;
  isEncashable: boolean;
  encashmentBasis: string;
  genderApplicable: 'All' | 'Male' | 'Female';
  requiresDocument: boolean;
  documentThresholdDays?: number;
  accrualMethod: string;
  description: string;
  legalSection: string;
  isPlatformLocked: boolean;
}

export interface StatutoryOtRule {
  code: string;
  name: string;
  ruleType: 'Hourly' | 'Fixed';
  rateOfficeDay: number;
  rateOffDay: number;
  maxWeeklyHours: number;
  description: string;
  legalSection: string;
  isPlatformLocked: boolean;
}

export interface StatutoryDeductionRule {
  code: string;
  name: string;
  nepaliName: string;
  employeePercent: number;
  employerPercent: number;
  isPreTax: boolean;
  description: string;
  legalSection: string;
  isPlatformLocked: boolean;
}

export interface StatutoryBenefitRule {
  code: string;
  name: string;
  nepaliName: string;
  amountMultiplier: number;
  serviceEligibilityMonths: number;
  proRataAllowed: boolean;
  description: string;
  legalSection: string;
  isPlatformLocked: boolean;
}

export interface StatutoryPolicyPackPayload {
  version: number;
  name: string;
  description: string;
  legalFramework: string;
  leaveRules: StatutoryLeaveRule[];
  otRules: StatutoryOtRule[];
  statutoryDeductions: StatutoryDeductionRule[];
  statutoryBenefits: StatutoryBenefitRule[];
}

export const DEFAULT_NEPAL_POLICY_PACK_V1: StatutoryPolicyPackPayload = {
  version: 1,
  name: 'Nepal Labour Act 2074 (Master Policy Pack v1.0)',
  description:
    'Mandatory statutory compliance rules governed by Nepal Labour Act 2074 (२०७४), Social Security Act 2074, and IRD guidelines enforced across all tenant databases.',
  legalFramework: 'Nepal Labour Act 2074 & SSF Act 2074',
  leaveRules: [
    {
      code: 'HOME',
      name: 'Home Leave (घर बिदा)',
      nepaliName: 'घर बिदा',
      statutoryCode: 'HOME',
      leaveType: 'Pay',
      daysPerYear: 18,
      maxAccumulation: 90,
      isEncashable: true,
      encashmentBasis: 'BasicSalary',
      genderApplicable: 'All',
      requiresDocument: false,
      accrualMethod: '1 day for every 20 days worked (18 days/yr)',
      description:
        'Accrues at 1 day per 20 working days. Up to 90 days can be accumulated. Excess days encashable at year-end based on basic remuneration.',
      legalSection: 'Section 40, Nepal Labour Act 2074',
      isPlatformLocked: true,
    },
    {
      code: 'SICK',
      name: 'Sick Leave (बिरामी बिदा)',
      nepaliName: 'बिरामी बिदा',
      statutoryCode: 'SICK',
      leaveType: 'Pay',
      daysPerYear: 12,
      maxAccumulation: 45,
      isEncashable: true,
      encashmentBasis: 'BasicSalary',
      genderApplicable: 'All',
      requiresDocument: true,
      documentThresholdDays: 3,
      accrualMethod: '12 days fully paid per fiscal year (Pro-rata for new joinees)',
      description:
        '12 days fully paid sick leave per fiscal year. Maximum accumulation up to 45 days. Medical certificate required if exceeding 3 consecutive days.',
      legalSection: 'Section 41, Nepal Labour Act 2074',
      isPlatformLocked: true,
    },
    {
      code: 'MATERNITY',
      name: 'Maternity Leave (प्रसूति बिदा)',
      nepaliName: 'प्रसूति बिदा',
      statutoryCode: 'MATERNITY',
      leaveType: 'Partial-Pay',
      daysPerYear: 98,
      maxPaidDays: 60,
      maxAccumulation: 98,
      isEncashable: false,
      encashmentBasis: 'None',
      genderApplicable: 'Female',
      requiresDocument: true,
      accrualMethod: 'Event-based statutory entitlement',
      description:
        '98 days total maternity leave. 60 days fully paid by employer; remaining 38 days unpaid or covered under SSF maternity benefit scheme.',
      legalSection: 'Section 42(1), Nepal Labour Act 2074',
      isPlatformLocked: true,
    },
    {
      code: 'PATERNITY',
      name: 'Paternity Leave (प्रसूति स्याहार बिदा)',
      nepaliName: 'प्रसूति स्याहार बिदा',
      statutoryCode: 'PATERNITY',
      leaveType: 'Pay',
      daysPerYear: 15,
      maxAccumulation: 15,
      isEncashable: false,
      encashmentBasis: 'None',
      genderApplicable: 'Male',
      requiresDocument: true,
      accrualMethod: 'Event-based statutory entitlement',
      description:
        '15 days fully paid paternity leave for male employees upon childbirth of spouse.',
      legalSection: 'Section 42(2), Nepal Labour Act 2074',
      isPlatformLocked: true,
    },
    {
      code: 'MOURNING',
      name: 'Mourning Leave (क्रिया बिदा)',
      nepaliName: 'क्रिया बिदा',
      statutoryCode: 'MOURNING',
      leaveType: 'Pay',
      daysPerYear: 13,
      maxAccumulation: 13,
      isEncashable: false,
      encashmentBasis: 'None',
      genderApplicable: 'All',
      requiresDocument: false,
      accrualMethod: 'Event-based statutory entitlement',
      description:
        '13 days fully paid mourning leave in the event of demise of parents, spouse, children, or in-laws (as per customary rites).',
      legalSection: 'Section 43, Nepal Labour Act 2074',
      isPlatformLocked: true,
    },
    {
      code: 'PUBLIC',
      name: 'Public & Festival Holidays (पर्व बिदा)',
      nepaliName: 'पर्व बिदा',
      statutoryCode: 'PUBLIC',
      leaveType: 'Pay',
      daysPerYear: 14,
      maxAccumulation: 14,
      isEncashable: false,
      encashmentBasis: 'None',
      genderApplicable: 'All',
      requiresDocument: false,
      accrualMethod: 'Annual Gazette / Statutory list',
      description:
        'Minimum 14 days fully paid public holidays per fiscal year as gazetted by Nepal Government.',
      legalSection: 'Section 39, Nepal Labour Act 2074',
      isPlatformLocked: true,
    },
  ],
  otRules: [
    {
      code: 'OT_STANDARD',
      name: 'Standard Nepal Labour Act Overtime',
      ruleType: 'Hourly',
      rateOfficeDay: 1.5,
      rateOffDay: 1.5,
      maxWeeklyHours: 24,
      description:
        'Overtime remuneration must be calculated at 1.5 times the regular basic hourly rate. Maximum 24 overtime hours allowed per week.',
      legalSection: 'Section 31, Nepal Labour Act 2074',
      isPlatformLocked: true,
    },
  ],
  statutoryDeductions: [
    {
      code: 'DED_SSF',
      name: 'Social Security Fund (SSF)',
      nepaliName: 'सामाजिक सुरक्षा कोष',
      employeePercent: 11,
      employerPercent: 20,
      isPreTax: true,
      description:
        '11% basic salary deducted from employee; 20% contributed by employer (total 31% deposited to SSF account for Medical, Accident, Maternity & Retirement).',
      legalSection: 'Social Security Act 2074 & Regulations',
      isPlatformLocked: true,
    },
    {
      code: 'DED_EPF',
      name: "Employees' Provident Fund (EPF / PF)",
      nepaliName: 'कर्मचारी सञ्चय कोष',
      employeePercent: 10,
      employerPercent: 10,
      isPreTax: true,
      description:
        '10% basic salary deducted from employee; 10% matched by employer (total 20% deposited to EPF account).',
      legalSection: 'Labour Act 2074 s.52 & EPF Act',
      isPlatformLocked: true,
    },
    {
      code: 'DED_CIT',
      name: 'Citizen Investment Trust (CIT)',
      nepaliName: 'नागरिक लगानी कोष',
      employeePercent: 0, // Voluntary
      employerPercent: 0,
      isPreTax: true,
      description:
        'Voluntary pre-tax monthly retirement savings scheme subject to annual tax exemption ceilings.',
      legalSection: 'Citizen Investment Trust Act 2047',
      isPlatformLocked: true,
    },
  ],
  statutoryBenefits: [
    {
      code: 'BEN_FESTIVAL',
      name: 'Festival Allowance (Dashain Bonus)',
      nepaliName: 'चाडपर्व भत्ता',
      amountMultiplier: 1.0,
      serviceEligibilityMonths: 12,
      proRataAllowed: true,
      description:
        'Employees completing 1 full year of service are entitled to 1 month basic salary before Dashain (or their major religious festival). Pro-rata for partial year service.',
      legalSection: 'Section 37, Nepal Labour Act 2074',
      isPlatformLocked: true,
    },
  ],
};
