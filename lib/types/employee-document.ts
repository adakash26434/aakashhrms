// Employee identity documents (4.2b): a list of documents, each with up to two scans.

export const DOCUMENT_TYPES = ["citizenship", "nid", "passport", "driving_licence", "voter_id"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  citizenship: "Citizenship",
  nid: "National ID (NID)",
  passport: "Passport",
  driving_licence: "Driving licence",
  voter_id: "Voter ID",
};

/** At least one of these is required for every employee. */
export const PRIMARY_DOCUMENT_TYPES: readonly DocumentType[] = ["citizenship", "nid"];

/** One scan per document, front and back in one file (the database's side column is always "scan"). */
export const DOCUMENT_SIDE = "scan";

/** Files accepted for a scan, by content (never by the browser's type or the name). */
export const DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];

/** Largest scan accepted: 3 MB. */
export const DOCUMENT_MAX_BYTES = 3 * 1024 * 1024;

/** A scan as the form and the record page see it (never the content). */
export interface DocumentFileRef {
  id: string;
  name: string;
  size: number;
  mime: string;
}

/** One document row in the employee form. `id` is set for a document already saved. */
export interface EmployeeDocumentInput {
  id?: string;
  type: DocumentType | "";
  number: string;
  district: string;
  /** e.g. "District Administration Office, Kaski"; "" only on a document saved before 4.2b. */
  office: string;
  /** AD date "YYYY-MM-DD", or "" (allowed only on a document saved before issued dates existed). */
  issuedDate: string;
  /** The scan (front and back in one file), or null. */
  file: DocumentFileRef | null;
}

/** A saved document. */
export interface EmployeeDocument {
  id: string;
  type: DocumentType;
  number: string;
  district: string;
  office: string;
  issuedDate: string | null;
  file: DocumentFileRef | null;
}

/** Largest photo upload (already cropped to 512 x 512 in the browser): 1 MB. */
export const PHOTO_MAX_BYTES = 1024 * 1024;
/** Largest image the crop window opens (before cropping): 10 MB. */
export const PHOTO_SOURCE_MAX_BYTES = 10 * 1024 * 1024;
