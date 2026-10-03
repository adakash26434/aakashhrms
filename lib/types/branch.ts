/**
 * Branch (read model): a physical office of the organisation. Editing lives
 * in Organization (lib/types/organization.ts).
 */
export type BranchStatus = "active" | "inactive";

export interface Branch {
  id: string;
  /** Short code, e.g. "KTM". */
  code: string;
  name: string;
  /** Structured address (serializeStructuredAddress) or older free text. */
  location: string;
  phone: string;
  email: string;
  isHeadOffice: boolean;
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
}
