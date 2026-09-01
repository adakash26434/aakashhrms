export interface OnboardingStatus {
  isCompleted: boolean;
  completedAt: string | null;
  mustChangePassword: boolean;
  currentStep: number;
  companyName: string;
  companySlug: string;
  contactEmail: string;
  contactPhone?: string;
  registeredCity?: string;
}

export interface OnboardingStep1PasswordInput {
  newPassword?: string;
  keepCurrentPassword?: boolean;
}

export interface OnboardingStep2CompanyInput {
  legalName: string;
  panVatNumber?: string;
  registrationNumber?: string;
  contactPhone: string;
  contactEmail: string;
  officeAddress: string;
  currency: string;
  fiscalYearLabel: string;
  fiscalYearSlug: string;
  startDateBS: string;
  endDateBS: string;
  startDateAD: string;
  endDateAD: string;
}

export interface DepartmentPreset {
  name: string;
  code: string;
  description: string;
  headName?: string;
}

export interface DesignationPreset {
  name: string;
  description: string;
}

export interface OnboardingStep3OrgInput {
  branchName: string;
  branchCode: string;
  branchLocation: string;
  branchPhone: string;
  branchEmail: string;
  departments: DepartmentPreset[];
  designations: DesignationPreset[];
}

export interface LeaveTypePreset {
  name: string;
  code: string;
  category: string;
  daysPerYear: number;
  isEncashable: boolean;
  maxAccumulation: number;
  isPaid: boolean;
  genderSpecific?: 'All' | 'Male' | 'Female';
}

export interface OnboardingStep4LeaveOtInput {
  leaveTypes: LeaveTypePreset[];
  otHourlyMultiplier: number;
}

export interface PayHeadPreset {
  name: string;
  code: string;
  type: 'EARNING' | 'DEDUCTION';
  isTaxable: boolean;
  isSsfHead?: boolean;
  isCitHead?: boolean;
  isPfHead?: boolean;
  isTdsHead?: boolean;
}

export interface OnboardingStep5PayHeadsInput {
  payHeads: PayHeadPreset[];
}

export interface FullOnboardingPayload {
  step1: OnboardingStep1PasswordInput;
  step2: OnboardingStep2CompanyInput;
  step3: OnboardingStep3OrgInput;
  step4: OnboardingStep4LeaveOtInput;
  step5: OnboardingStep5PayHeadsInput;
}

// -----------------------------------------------------------------------------
// Nepal Labour Act 2074 Statutory Presets
// -----------------------------------------------------------------------------

export const DEFAULT_NEPAL_LEAVE_TYPES: LeaveTypePreset[] = [
  {
    name: 'Home Leave (घर बिदा)',
    code: 'HOME',
    category: 'STATUTORY',
    daysPerYear: 18,
    isEncashable: true,
    maxAccumulation: 90,
    isPaid: true,
    genderSpecific: 'All',
  },
  {
    name: 'Sick Leave (बिरामी बिदा)',
    code: 'SICK',
    category: 'STATUTORY',
    daysPerYear: 12,
    isEncashable: true,
    maxAccumulation: 45,
    isPaid: true,
    genderSpecific: 'All',
  },
  {
    name: 'Maternity Leave (प्रसूति बिदा)',
    code: 'MATERNITY',
    category: 'STATUTORY',
    daysPerYear: 98,
    isEncashable: false,
    maxAccumulation: 98,
    isPaid: true,
    genderSpecific: 'Female',
  },
  {
    name: 'Paternity Leave (प्रसूति स्याहार बिदा)',
    code: 'PATERNITY',
    category: 'STATUTORY',
    daysPerYear: 15,
    isEncashable: false,
    maxAccumulation: 15,
    isPaid: true,
    genderSpecific: 'Male',
  },
  {
    name: 'Mourning Leave (क्रिया बिदा)',
    code: 'MOURNING',
    category: 'STATUTORY',
    daysPerYear: 13,
    isEncashable: false,
    maxAccumulation: 13,
    isPaid: true,
    genderSpecific: 'All',
  },
  {
    name: 'Public & Festival Holidays (पर्व बिदा)',
    code: 'PUBLIC',
    category: 'STATUTORY',
    daysPerYear: 14,
    isEncashable: false,
    maxAccumulation: 14,
    isPaid: true,
    genderSpecific: 'All',
  },
];

export const DEFAULT_DEPARTMENTS: DepartmentPreset[] = [
  {
    name: 'Administration & Operations',
    code: 'ADM',
    description: 'General administration, facilities, operations, and office support.',
    headName: 'Operations Lead',
  },
  {
    name: 'Human Resources',
    code: 'HR',
    description: 'Workforce management, recruitment, employee relations, and compliance.',
    headName: 'HR Manager',
  },
  {
    name: 'Finance & Accounts',
    code: 'FIN',
    description: 'Bookkeeping, tax compliance, payroll audit, and accounts management.',
    headName: 'Chief Accountant',
  },
  {
    name: 'Information Technology',
    code: 'IT',
    description: 'Software development, systems infrastructure, security, and digital assets.',
    headName: 'IT Lead',
  },
  {
    name: 'Sales & Marketing',
    code: 'MKT',
    description: 'Business development, client relations, campaigns, and growth.',
    headName: 'Marketing Head',
  },
];

export const DEFAULT_DESIGNATIONS: DesignationPreset[] = [
  { name: 'Chief Executive Officer (CEO)', description: 'Executive leadership & strategic oversight' },
  { name: 'Managing Director / Partner', description: 'Operational leadership' },
  { name: 'Human Resources Manager', description: 'HR policy & workforce operations' },
  { name: 'Senior Accountant / Officer', description: 'Financial reporting & tax filing' },
  { name: 'Software Engineer / Developer', description: 'Technical design & system development' },
  { name: 'Administrative Officer', description: 'Daily operations & administrative management' },
  { name: 'Associate / Assistant', description: 'Support functions & entry-level operations' },
];

export const DEFAULT_PAY_HEADS: PayHeadPreset[] = [
  { name: 'Basic Salary', code: 'BASIC', type: 'EARNING', isTaxable: true },
  { name: 'Grade Amount', code: 'GRADE', type: 'EARNING', isTaxable: true },
  { name: 'Dearness Allowance (महङ्गी भत्ता)', code: 'DA', type: 'EARNING', isTaxable: true },
  { name: 'House Rent Allowance (घरभाडा भत्ता)', code: 'HRA', type: 'EARNING', isTaxable: true },
  { name: 'Festival Allowance / Dashain Bonus (चाडपर्व भत्ता)', code: 'FESTIVAL', type: 'EARNING', isTaxable: true },
  { name: 'Social Security Fund (SSF 11%)', code: 'SSF', type: 'DEDUCTION', isTaxable: false, isSsfHead: true },
  { name: 'Provident Fund (EPF 10%)', code: 'EPF', type: 'DEDUCTION', isTaxable: false, isPfHead: true },
  { name: 'Citizen Investment Trust (CIT)', code: 'CIT', type: 'DEDUCTION', isTaxable: false, isCitHead: true },
  { name: 'Tax Deducted at Source (TDS)', code: 'TDS', type: 'DEDUCTION', isTaxable: false, isTdsHead: true },
];
