// Employee identity documents (4.2b): the rules the form and the server share,
// the file checks for uploads, and the mirror of the old employee_personal columns.

import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  PRIMARY_DOCUMENT_TYPES,
  type DocumentMimeType,
  type DocumentType,
  type EmployeeDocument,
  type EmployeeDocumentInput,
} from "@/lib/types/employee-document";
import { validateCitizenshipNo, validateDrivingLicenceNo, validateNIDNo, validatePassportNo, validateVoterIdNo, type DocValidationResult } from "@/lib/utils/nepal-docs";
import { DISTRICTS } from "@/lib/constants/nepal-locations";

const NUMBER_RULE: Record<DocumentType, (v: string) => DocValidationResult> = {
  citizenship: validateCitizenshipNo,
  nid: validateNIDNo,
  passport: validatePassportNo,
  driving_licence: validateDrivingLicenceNo,
  voter_id: validateVoterIdNo,
};

const DISTRICT_NAMES = new Set(DISTRICTS.map((d) => d.name));

export function isDocumentType(v: unknown): v is DocumentType {
  return typeof v === "string" && (DOCUMENT_TYPES as readonly string[]).includes(v);
}

export function isPrimaryDocument(type: DocumentType | ""): boolean {
  return type !== "" && PRIMARY_DOCUMENT_TYPES.includes(type);
}

/** A blank row for the form. */
export function emptyDocument(type: DocumentType | "" = ""): EmployeeDocumentInput {
  return { type, number: "", district: "", office: "", issuedDate: "", file: null };
}

/** The office that usually issues a document (pre-filled; the user can change it). */
export function suggestedIssuingOffice(type: DocumentType | "", district: string): string {
  const d = district.trim();
  switch (type) {
    case "citizenship":
      return d ? `District Administration Office, ${d}` : "District Administration Office";
    case "nid":
      return "Department of National ID and Civil Registration";
    case "passport":
      return "Department of Passports";
    case "driving_licence":
      return d ? `Transport Management Office, ${d}` : "Transport Management Office";
    case "voter_id":
      return d ? `District Election Office, ${d}` : "District Election Office";
    default:
      return "";
  }
}

/** The types still free for row `index` (each type once per employee). */
export function availableDocumentTypes(rows: readonly EmployeeDocumentInput[], index: number): DocumentType[] {
  const taken = new Set(rows.filter((_, i) => i !== index).map((r) => r.type));
  return DOCUMENT_TYPES.filter((t) => !taken.has(t));
}

/** Trimmed rows with at most one scan each; the shape is checked, never trusted. */
export function normalizeDocuments(raw: unknown): EmployeeDocumentInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, DOCUMENT_TYPES.length + 1).map((r) => {
    const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const f = row.file && typeof row.file === "object" ? (row.file as Record<string, unknown>) : null;
    const file = f && typeof f.id === "string" && f.id ? { id: f.id, name: text(f.name, 150), size: Number(f.size) || 0, mime: text(f.mime, 50) } : null;
    return {
      id: typeof row.id === "string" && row.id ? row.id : undefined,
      type: isDocumentType(row.type) ? row.type : "",
      number: text(row.number, 50),
      district: text(row.district, 100),
      office: text(row.office, 150),
      issuedDate: /^\d{4}-\d{2}-\d{2}$/.test(String(row.issuedDate ?? "")) ? String(row.issuedDate) : "",
      file,
    };
  });
}

export interface DocumentCheckContext {
  /** Date of birth "YYYY-MM-DD" ("" when not known yet). */
  dateOfBirth: string;
  /** Today in Nepal, "YYYY-MM-DD". */
  today: string;
  /** false: a new Citizenship / NID may come without its scan (F15 import; it is then a record to fix). */
  scanRequired?: boolean;
}

/**
 * Errors keyed `documents` (the list) and `documents.<row>.<field>`. A row with an id is a
 * document saved before: it may lack the issuing office, the issued date and a scan (added when
 * found; shown under Records to fix). A new document needs its office and date, and a new
 * Citizenship or NID its scan.
 */
export function validateDocuments(rows: readonly EmployeeDocumentInput[], ctx: DocumentCheckContext): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!rows.some((r) => isPrimaryDocument(r.type))) {
    errors.documents = "Add a citizenship certificate or a National ID";
  }
  const used = new Set<string>();
  rows.forEach((r, i) => {
    const key = (field: string) => `documents.${i}.${field}`;
    if (!r.type) {
      errors[key("type")] = "Choose the document";
    } else if (used.has(r.type)) {
      errors[key("type")] = `${DOCUMENT_TYPE_LABEL[r.type]} is already listed`;
    } else {
      used.add(r.type);
    }

    const number = r.number.trim();
    if (!number) {
      errors[key("number")] = "Enter the document number";
    } else if (r.type) {
      const res = NUMBER_RULE[r.type](number);
      if (!res.isValid) errors[key("number")] = res.error ?? "Check the number";
    }

    if (!r.district.trim()) errors[key("district")] = "Choose the issuing district";
    else if (!DISTRICT_NAMES.has(r.district.trim())) errors[key("district")] = "Choose a district from the list";

    const isNew = !r.id;
    if (!r.office.trim()) {
      if (isNew) errors[key("office")] = "Enter the issuing office";
    } else if (r.office.trim().length > 150) {
      errors[key("office")] = "Keep the office to 150 characters";
    }

    if (!r.issuedDate) {
      if (isNew) errors[key("issuedDate")] = "Enter the issued date";
    } else if (r.issuedDate > ctx.today) {
      errors[key("issuedDate")] = "The issued date can't be in the future";
    } else if (ctx.dateOfBirth && r.issuedDate < ctx.dateOfBirth) {
      errors[key("issuedDate")] = "The issued date can't be before the date of birth";
    }

    if (isNew && isPrimaryDocument(r.type) && !r.file && ctx.scanRequired !== false) {
      errors[key("file")] = "Attach a scan of the document (front and back in one file)";
    }
  });
  return errors;
}

/**
 * Records to fix: no Citizenship / NID that has both its issued date and a scan
 * (documents saved before 4.2b have neither until someone adds them).
 */
export function lacksIdentityScan(docs: readonly Pick<EmployeeDocument, "type" | "issuedDate" | "file">[] | undefined): boolean {
  if (!docs) return false;
  return !docs.some((d) => PRIMARY_DOCUMENT_TYPES.includes(d.type) && !!d.issuedDate && !!d.file);
}

/** The old employee_personal columns, kept as a mirror of the list for older readers (until Phase 8). */
export function legacyDocumentColumns(rows: readonly Pick<EmployeeDocumentInput, "type" | "number" | "district">[]) {
  const of = (t: DocumentType) => rows.find((r) => r.type === t);
  const no = (t: DocumentType) => of(t)?.number.trim() || null;
  const district = (t: DocumentType) => (of(t) ? of(t)!.district.trim() || null : null);
  return {
    citizenshipNo: no("citizenship") ?? "",
    issuingDistrict: district("citizenship") ?? "",
    nidNo: no("nid"),
    nidIssuingDistrict: district("nid"),
    passportNo: no("passport"),
    passportIssuingDistrict: district("passport"),
    votersId: no("voter_id"),
    voterIdIssuingDistrict: district("voter_id"),
  };
}

/** Did the list change (rows, numbers, districts, offices, dates or scans)? For the audit's field names. */
export function documentsChanged(before: readonly EmployeeDocument[], after: readonly EmployeeDocumentInput[]): boolean {
  const key = (d: { type: string; number: string; district: string; office: string; issuedDate: string | null; file: { id: string } | null }) =>
    [d.type, d.number.trim(), d.district.trim(), d.office.trim(), d.issuedDate ?? "", d.file?.id ?? ""].join("|");
  const a = before.map(key).sort().join("\n");
  const b = after.map(key).sort().join("\n");
  return a !== b;
}

// ---------------------------------------------------------------------------
// Upload checks (S25): the file's content decides its type.
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** PDF, JPEG or PNG from the first bytes; null for anything else (the name and the browser's type are ignored). */
export function sniffFileType(bytes: Uint8Array): DocumentMimeType | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return "image/png";
  return null;
}

const EXTENSION: Record<DocumentMimeType, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

/** A safe name to store and to offer on download: no folders or control characters, 120 characters at most, the extension of the real type. */
export function safeFileName(name: string, mime: DocumentMimeType): string {
  const base = String(name ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 110);
  return `${cleaned || "scan"}.${EXTENSION[mime]}`;
}

/** Why a file can't be uploaded, checked in the browser before sending (the server checks again). */
export function fileProblem(size: number): string | null {
  if (size <= 0) return "The file is empty";
  if (size > DOCUMENT_MAX_BYTES) return "The file is larger than 3 MB. Scan at a lower resolution or save it as JPG.";
  return null;
}

/** "1.2 MB", "340 KB". */
export function fileSizeText(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Where an employee photo is shown from (the route checks scope, or that it is your own). */
export function photoUrl(photoId: string | null | undefined): string | null {
  return photoId ? `/api/employees/photos/${encodeURIComponent(photoId)}` : null;
}
