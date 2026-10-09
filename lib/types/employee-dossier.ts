import type { DocumentFileRef } from '@/lib/types/employee-document';

// Employee dossier (4.2c): qualifications, past employment and other
// attachments (certificates, training, undertakings). Rows are saved with the
// employee; each may carry one scan stored like an identity document's.

export const QUALIFICATION_LEVELS = [
  { code: 'see', label: 'SEE / SLC' },
  { code: 'plus2', label: '+2 / Intermediate' },
  { code: 'diploma', label: 'Diploma / TSLC' },
  { code: 'bachelor', label: "Bachelor's" },
  { code: 'master', label: "Master's" },
  { code: 'mphil', label: 'M.Phil' },
  { code: 'phd', label: 'PhD' },
  { code: 'other', label: 'Other' },
] as const;
export type QualificationLevel = (typeof QUALIFICATION_LEVELS)[number]['code'];

export const ATTACHMENT_KINDS = [
  { code: 'certificate', label: 'Certificate' },
  { code: 'training', label: 'Training certificate' },
  { code: 'experience', label: 'Experience letter' },
  { code: 'agreement', label: 'Agreement / contract' },
  { code: 'undertaking', label: 'Undertaking / guarantee (Dhanjamani)' },
  { code: 'police', label: 'Police / character report' },
  { code: 'medical', label: 'Medical report' },
  { code: 'other', label: 'Other' },
] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]['code'];

/** One qualification row; `id` is set once saved. */
export interface QualificationInput {
  id?: string;
  level: QualificationLevel | '';
  degree: string; // e.g. BBS, MBA, "SEE"
  institution: string; // school / college
  board: string; // board or university
  passedYear: string; // free text: "2078" or "2021"
  division: string; // division / grade / GPA
  major: string;
  file: DocumentFileRef | null;
}

/** One past employment row. */
export interface WorkHistoryInput {
  id?: string;
  organisation: string;
  designation: string;
  fromAd: string; // YYYY-MM-DD
  toAd: string; // YYYY-MM-DD or '' when it was the last job before joining
  duties: string;
  reference: string; // a contact at the organisation
  file: DocumentFileRef | null;
}

/** One attachment row: a scan with a title. */
export interface AttachmentInput {
  id?: string;
  kind: AttachmentKind | '';
  title: string;
  note: string;
  file: DocumentFileRef | null;
}

export interface EmployeeDossierInput {
  qualifications: QualificationInput[];
  workHistory: WorkHistoryInput[];
  attachments: AttachmentInput[];
}

export const EMPTY_DOSSIER: EmployeeDossierInput = { qualifications: [], workHistory: [], attachments: [] };

export const DOSSIER_LIMITS = { qualifications: 12, workHistory: 15, attachments: 25 } as const;
