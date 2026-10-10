import { auth } from "@/lib/auth";
import { resolvePlatformCompanyForTenant } from "@/lib/platform/company-resolver";
import { getCompanyProfileSetup, getCompanyWorkSchedule, saveProfileFields } from "@/lib/repositories/company-setup.repository";
import { cancelDetailsRequest, createDetailsRequest, latestDetailsRequest, legalDetailsOf } from "@/lib/platform/company-details";
import {
  LEGAL_LABEL,
  PROFILE_LABEL,
  industryLabel,
  legalChangeIsValid,
  legalChanges,
  normalizeLegalChange,
  normalizeProfileForm,
  profileChanges,
  profileIsValid,
  proposedDetails,
  validateLegalChange,
  validateProfileForm,
} from "@/lib/engines/company-profile.engine";
import { recordAuditLog } from "@/lib/services/audit.service";
import { UserFacingError } from "@/lib/errors/action-error";
import type { CompanyProfileErrors, CompanyProfileForm, CompanyProfileSetupData, CompanySetupPage, LegalChangeErrors, LegalDetails } from "@/lib/types/company-setup";

// Company setup (4.12c, S53): the company's own details — the name it works under, contacts and
// the signatories on printouts — saved with Organization → Edit by a company-wide role
// (checkCompanyControl in the actions) and audited field by field; the legal registration is the
// platform's, changed through a request for the signed-in user's own company only.

export class CompanyProfileValidationError extends UserFacingError {
  constructor(public errors: CompanyProfileErrors) {
    super("Check the highlighted fields.");
    this.name = "CompanyProfileValidationError";
  }
}

export class LegalChangeValidationError extends UserFacingError {
  constructor(public errors: LegalChangeErrors) {
    super("Check the highlighted fields.");
    this.name = "LegalChangeValidationError";
  }
}

export interface CompanySetupCtx {
  userId: string;
  email: string | null;
  /** The signed-in user's company on the platform (null: the platform could not be reached). */
  companyId: string | null;
  canEdit: boolean;
}

/** The context for a user: their company resolved from the signed-in session, never from the browser. */
export async function contextFor(userId: string, canEdit: boolean): Promise<CompanySetupCtx> {
  const session = await auth();
  let companyId: string | null = null;
  try {
    companyId = (await resolvePlatformCompanyForTenant(session?.user?.tenantSlug || undefined)).id;
  } catch {
    companyId = null;
  }
  return { userId, email: session?.user?.email ?? null, companyId, canEdit };
}

const formOfProfile = (p: CompanyProfileSetupData): CompanyProfileForm => ({
  displayName: p.displayName ?? "",
  contactEmail: p.contactEmail ?? "",
  contactPhone: p.contactPhone ?? "",
  signatory1Name: p.signatory1Name ?? "",
  signatory1Title: p.signatory1Title ?? "",
  signatory2Name: p.signatory2Name ?? "",
  signatory2Title: p.signatory2Title ?? "",
});

const legalOfProfile = (p: CompanyProfileSetupData): LegalDetails => ({
  legalName: p.legalName,
  panVatNumber: p.panVatNumber,
  registrationNumber: p.registrationNumber,
  industryType: p.industryType,
  headOfficeAddress: p.headOfficeAddress,
});

export async function companySetupPage(ctx: CompanySetupCtx): Promise<CompanySetupPage> {
  const [profile, schedule] = await Promise.all([getCompanyProfileSetup(), getCompanyWorkSchedule()]);
  let legal = legalOfProfile(profile);
  let request: CompanySetupPage["request"] = null;
  let platform = false;
  if (ctx.companyId) {
    try {
      const [held, latest] = await Promise.all([legalDetailsOf(ctx.companyId), latestDetailsRequest(ctx.companyId)]);
      if (held) legal = held;
      request = latest;
      platform = true;
    } catch {
      platform = false;
    }
  }
  return { legal, form: formOfProfile(profile), schedule, request, platform, canEdit: ctx.canEdit };
}

/** Saves the company's own details; audited with each changed field before and after. */
export async function saveCompanyProfile(raw: unknown, ctx: Pick<CompanySetupCtx, "userId">): Promise<{ changed: string[] }> {
  const form = normalizeProfileForm(raw);
  const errors = validateProfileForm(form);
  if (!profileIsValid(errors)) throw new CompanyProfileValidationError(errors);
  const before = formOfProfile(await getCompanyProfileSetup());
  const changed = profileChanges(before, form);
  if (!changed.length) throw new UserFacingError("Nothing changed.");
  await saveProfileFields(form);
  await recordAuditLog({
    userId: ctx.userId,
    action: "EDIT",
    module: "ORG_STRUCTURE",
    recordId: "Company profile",
    oldValues: Object.fromEntries(changed.map((k) => [PROFILE_LABEL[k], before[k] || "–"])),
    newValues: Object.fromEntries(changed.map((k) => [PROFILE_LABEL[k], form[k] || "–"])),
  });
  return { changed: changed.map((k) => PROFILE_LABEL[k]) };
}

const companyOf = (ctx: CompanySetupCtx): string => {
  if (!ctx.companyId) throw new UserFacingError("The platform could not be reached. Try again later.");
  return ctx.companyId;
};

const shown = (k: keyof LegalDetails, v: string) => (k === "industryType" ? industryLabel(v) : v || "–");

/** Asks the platform to change the legal details, with the reason; audited in the company too. */
export async function requestLegalChange(raw: unknown, ctx: CompanySetupCtx): Promise<{ id: string }> {
  const companyId = companyOf(ctx);
  const current = await legalDetailsOf(companyId);
  if (!current) throw new UserFacingError("The platform could not find this company.");
  const form = normalizeLegalChange(raw);
  const errors = validateLegalChange(form, current);
  if (!legalChangeIsValid(errors)) throw new LegalChangeValidationError(errors);
  const proposed = proposedDetails(form);
  const id = await createDetailsRequest({ companyId, userId: ctx.userId, email: ctx.email || "unknown", current, proposed, reason: form.reason, reference: form.reference });
  const changes = legalChanges(current, proposed);
  await recordAuditLog({
    userId: ctx.userId,
    action: "ADD",
    module: "ORG_STRUCTURE",
    recordId: "Legal details change request",
    oldValues: Object.fromEntries(changes.map((k) => [LEGAL_LABEL[k], shown(k, current[k])])),
    newValues: { ...Object.fromEntries(changes.map((k) => [LEGAL_LABEL[k], shown(k, proposed[k])])), reason: form.reason },
  });
  return { id };
}

/** Withdraws the company's own waiting request. */
export async function cancelLegalChange(requestId: string, ctx: CompanySetupCtx): Promise<void> {
  const companyId = companyOf(ctx);
  if (!(await cancelDetailsRequest({ companyId, requestId }))) throw new UserFacingError("This request was already reviewed or withdrawn.");
  await recordAuditLog({ userId: ctx.userId, action: "EDIT", module: "ORG_STRUCTURE", recordId: "Legal details change request", newValues: { status: "Withdrawn" } });
}
