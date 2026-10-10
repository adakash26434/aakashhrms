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
  signatory1Name?: string;
  signatory1Title?: string;
  signatory2Name?: string;
  signatory2Title?: string;
}


// ---------------------------------------------------------------------------
// 4.12c: Setup → Company setup (lib/engines/company-profile.engine.ts)
// ---------------------------------------------------------------------------

/** What the company edits itself: the name it trades under, contacts and the signatories on printouts. */
export interface CompanyProfileForm {
  displayName: string;
  contactEmail: string;
  contactPhone: string;
  signatory1Name: string;
  signatory1Title: string;
  signatory2Name: string;
  signatory2Title: string;
}

export type CompanyProfileErrors = Partial<Record<keyof CompanyProfileForm, string>>;

/** The legal registration the platform keeps (changed only through a request it approves). */
export interface LegalDetails {
  legalName: string;
  panVatNumber: string;
  registrationNumber: string;
  industryType: string;
  headOfficeAddress: string;
}

export interface LegalChangeForm extends LegalDetails {
  reason: string;
  /** The registrar's or IRD's document number, if any. */
  reference: string;
}

export type LegalChangeErrors = Partial<Record<keyof LegalChangeForm, string>>;

export type LegalChangeStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/** The company's latest request to change its legal details. */
export interface LegalChangeRequestView {
  id: string;
  status: LegalChangeStatus;
  proposed: LegalDetails;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  rejectionReason: string | null;
}

export interface CompanySetupPage {
  legal: LegalDetails;
  form: CompanyProfileForm;
  /** The company default shift (read-only here: Attendance → Shifts owns it). */
  schedule: CompanyWorkSchedule;
  request: LegalChangeRequestView | null;
  /** False when the platform could not be reached (requests can't be made now). */
  platform: boolean;
  /** Organization → Edit with a company-wide role (buttons only; the server checks again). */
  canEdit: boolean;
}
