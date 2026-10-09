// HR letters (G2): shared types for the register, templates and the print view.

import type { LetterLanguage } from '@/lib/engines/letter.engine';
import type { LetterDesign } from '@/lib/engines/letter-design.engine';

export interface LetterTemplateRow {
  id: string;
  code: string;
  name: string;
  nameNp: string;
  subjectEn: string;
  subjectNp: string;
  bodyEn: string;
  bodyNp: string;
  isSystem: boolean;
  isActive: boolean;
  updatedAt: string; // ISO
}

export interface LetterListRow {
  id: string;
  letterNumber: string;
  kind: string;
  kindName: string;
  language: LetterLanguage;
  subject: string;
  status: 'issued' | 'voided';
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  issuedDateBs: string;
  issuedDateAd: string; // YYYY-MM-DD
  issuedByName: string;
}

export interface LetterDetail extends LetterListRow {
  body: string;
  mergeData: Record<string, string>;
  voidReason: string | null;
  voidedByName: string | null;
  voidedAt: string | null; // ISO
}

export interface LetterEmployeeOption {
  id: string;
  fullName: string;
  employeeCode: string;
  branch: string;
}

export interface LettersPageData {
  letters: LetterListRow[];
  templates: LetterTemplateRow[];
  employees: LetterEmployeeOption[];
  fiscalYears: { id: string; label: string }[];
  currentFiscalYearId: string | null;
  permissions: { issue: boolean; templates: boolean; void: boolean };
  /** For the Design tab's live preview. */
  letterhead: LetterheadData;
}

/** The basic letterhead lines (also used by the evaluation printout). */
export interface LetterheadBase {
  name: string;
  address: string;
  pan: string;
  signatoryName: string;
  signatoryTitle: string;
}

/** Company letterhead and look for the letter print view. */
export interface LetterheadData extends LetterheadBase {
  signatory2Name: string;
  signatory2Title: string;
  regNo: string;
  phone: string;
  email: string;
  /** The company's chosen look (letterhead, text size, signature boxes). */
  design: LetterDesign;
}
