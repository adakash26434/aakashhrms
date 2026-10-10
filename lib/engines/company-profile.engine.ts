/**
 * Company setup (4.12c) — pure logic for the company's own details and its
 * requests to change the legal ones.
 *
 * The company edits the name it trades under, its contacts and the two
 * signatories printed on letters, salary sheets and certificates. The legal
 * registration (name, PAN, registration number, industry, registered
 * office) belongs to the platform: the company asks for a change with a
 * reason, and the platform approves it. Tests: tests/company-profile.engine.test.ts.
 */

import { INDUSTRY_SECTORS, type IndustrySectorKey } from "@/lib/constants/industry-types";
import type { CompanyProfileErrors, CompanyProfileForm, LegalChangeErrors, LegalChangeForm, LegalDetails } from "@/lib/types/company-setup";

export const PROFILE_LABEL: Record<keyof CompanyProfileForm, string> = {
  displayName: "Display name",
  contactEmail: "Email",
  contactPhone: "Phone",
  signatory1Name: "Prepared / verified by",
  signatory1Title: "Prepared / verified by: title",
  signatory2Name: "Authorised / approved by",
  signatory2Title: "Authorised / approved by: title",
};

export const LEGAL_LABEL: Record<keyof LegalDetails, string> = {
  legalName: "Legal name",
  panVatNumber: "PAN / VAT number",
  registrationNumber: "Registration number",
  industryType: "Industry",
  headOfficeAddress: "Registered office",
};

const LIMIT: Record<keyof CompanyProfileForm, number> = {
  displayName: 120,
  contactEmail: 120,
  contactPhone: 30,
  signatory1Name: 80,
  signatory1Title: 80,
  signatory2Name: 80,
  signatory2Title: 80,
};

export const REASON_MIN = 10;

const text = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\-\s/,]{6,30}$/;
const PAN = /^\d{9}$/;

/** The industry's name ("Cooperatives (Saving & Multipurpose)"), or the stored key. */
export const industryLabel = (key: string) => INDUSTRY_SECTORS[(key || "General") as IndustrySectorKey]?.label ?? key;

export const PROFILE_KEYS = Object.keys(PROFILE_LABEL) as (keyof CompanyProfileForm)[];
export const LEGAL_KEYS = Object.keys(LEGAL_LABEL) as (keyof LegalDetails)[];

/** The profile form from the browser. */
export function normalizeProfileForm(raw: unknown): CompanyProfileForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(PROFILE_KEYS.map((k) => [k, k === "contactEmail" ? text(r[k]).toLowerCase() : text(r[k])])) as unknown as CompanyProfileForm;
}

export function validateProfileForm(f: CompanyProfileForm): CompanyProfileErrors {
  const e: CompanyProfileErrors = {};
  for (const k of PROFILE_KEYS) if (f[k].length > LIMIT[k]) e[k] = `At most ${LIMIT[k]} characters.`;
  if (!f.displayName) e.displayName = "Give the name the company works under.";
  if (f.contactEmail && !e.contactEmail && !EMAIL.test(f.contactEmail)) e.contactEmail = "An email address such as info@company.com.";
  if (f.contactPhone && !e.contactPhone && !PHONE.test(f.contactPhone)) e.contactPhone = "Digits, spaces and + - ( ) only.";
  if (f.signatory1Title && !f.signatory1Name && !e.signatory1Name) e.signatory1Name = "Give the person's name too.";
  if (f.signatory2Title && !f.signatory2Name && !e.signatory2Name) e.signatory2Name = "Give the person's name too.";
  return e;
}

export const profileIsValid = (e: CompanyProfileErrors) => Object.keys(e).length === 0;

/** The fields that differ, in form order. */
export const profileChanges = (before: CompanyProfileForm, after: CompanyProfileForm) => PROFILE_KEYS.filter((k) => before[k] !== after[k]);

/** A request to change the legal details, from the browser. */
export function normalizeLegalChange(raw: unknown): LegalChangeForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    legalName: text(r.legalName),
    panVatNumber: text(r.panVatNumber).replace(/\s/g, ""),
    registrationNumber: text(r.registrationNumber),
    industryType: text(r.industryType),
    headOfficeAddress: text(r.headOfficeAddress),
    reason: typeof r.reason === "string" ? r.reason.trim().slice(0, 2000) : "",
    reference: text(r.reference),
  };
}

/** Checks a request against the details in force: something must change, with a reason. */
export function validateLegalChange(f: LegalChangeForm, current: LegalDetails): LegalChangeErrors {
  const e: LegalChangeErrors = {};
  if (!f.legalName) e.legalName = "Give the legal name.";
  else if (f.legalName.length > 200) e.legalName = "At most 200 characters.";
  if (f.panVatNumber && !PAN.test(f.panVatNumber)) e.panVatNumber = "A PAN has 9 digits.";
  if (f.registrationNumber.length > 60) e.registrationNumber = "At most 60 characters.";
  if (!(f.industryType in INDUSTRY_SECTORS)) e.industryType = "Choose the industry.";
  if (f.headOfficeAddress.length > 200) e.headOfficeAddress = "At most 200 characters.";
  if (f.reason.length < REASON_MIN) e.reason = "Say why it changes (the registrar's or IRD's decision).";
  else if (f.reason.length > 1000) e.reason = "At most 1000 characters.";
  if (f.reference.length > 120) e.reference = "At most 120 characters.";
  if (!Object.keys(e).length && !legalChanges(current, f).length) e.legalName = "Nothing would change: edit the details that changed.";
  return e;
}

export const legalChangeIsValid = (e: LegalChangeErrors) => Object.keys(e).length === 0;

/** The legal details that differ. */
export const legalChanges = (before: LegalDetails, after: LegalDetails) => LEGAL_KEYS.filter((k) => (before[k] ?? "") !== (after[k] ?? ""));

/** The details a request proposes (what the platform stores when it approves). */
export const proposedDetails = (f: LegalChangeForm): LegalDetails => ({
  legalName: f.legalName,
  panVatNumber: f.panVatNumber,
  registrationNumber: f.registrationNumber,
  industryType: f.industryType,
  headOfficeAddress: f.headOfficeAddress,
});
