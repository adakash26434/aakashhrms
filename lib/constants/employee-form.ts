// Employee form layout (4.2): sections in Enter order, the fields in each
// (in the order they appear),
// and the label every field shows. The form, its section index, the error
// summary and the record page's change history all read from here.

import type { EmployeeFormData } from "@/lib/types/employee";

export type EmployeeField = keyof EmployeeFormData;

export interface EmployeeFormSection {
  id: string;
  label: string;
  fields: EmployeeField[];
  /** Fields that must be filled for the section to count as done. */
  required: EmployeeField[];
}

export const EMPLOYEE_FORM_SECTIONS: EmployeeFormSection[] = [
  {
    id: "general",
    label: "General",
    fields: ["photoId", "fullName", "employeeCode", "attendanceCode", "gender", "dateOfBirth", "taxStatus", "isDisabled"],
    required: ["fullName", "employeeCode", "attendanceCode", "gender", "dateOfBirth", "taxStatus"],
  },
  {
    id: "job",
    label: "Job & placement",
    fields: ["branchId", "departmentId", "designationId", "shreni", "category", "supervisorId", "joiningDate", "confirmationDate", "isSupervisor"],
    required: ["branchId", "departmentId", "designationId", "shreni", "category", "joiningDate"],
  },
  {
    id: "pay",
    label: "Pay",
    fields: ["basicSalary", "gradeCount", "gradeAmount"],
    required: ["basicSalary"],
  },
  {
    id: "documents",
    label: "Identity documents",
    // documents: the list (Citizenship or NID required); row errors are keyed documents.<row>.<field>.
    fields: ["documents", "panNumber"],
    required: ["documents"],
  },
  {
    id: "contact",
    label: "Contact & address",
    fields: ["mobileNo", "phoneHome", "companyEmail", "personalEmail", "permanentAddress", "temporaryAddress"],
    required: ["companyEmail", "mobileNo", "permanentAddress"],
  },
  {
    id: "family",
    label: "Family",
    fields: ["fatherName", "motherName", "grandfatherName", "spouseName"],
    required: ["fatherName", "motherName", "grandfatherName"],
  },
  {
    id: "bank",
    label: "Bank",
    fields: ["bankName", "bankBranch", "bankAccountNumber"],
    required: ["bankName", "bankBranch", "bankAccountNumber"],
  },
  { id: "access", label: "Self-service access", fields: [], required: [] },
  {
    id: "separation",
    label: "Separation",
    fields: ["informedDate", "terminationDate", "terminationType", "terminationPlan", "terminationReason", "terminationRemarks"],
    required: [],
  },
];

export const EMPLOYEE_FIELD_LABELS: Partial<Record<EmployeeField, string>> = {
  employeeCode: "Employee code",
  attendanceCode: "Attendance code",
  photoId: "Photo",
  fullName: "Full name",
  dateOfBirth: "Date of birth",
  gender: "Gender",
  taxStatus: "Tax status",
  isDisabled: "Disability relief",
  departmentId: "Department",
  designationId: "Designation",
  branchId: "Branch",
  shreni: "Shreni (level)",
  category: "Category",
  supervisorId: "Reports to",
  isSupervisor: "Is supervisor",
  joiningDate: "Joining date",
  confirmationDate: "Confirmation date",
  status: "Status",
  basicSalary: "Basic salary",
  gradeCount: "Grade count",
  gradeAmount: "Grade amount",
  gradeManual: "Grade by hand",
  documents: "Identity documents",
  panNumber: "PAN",
  companyEmail: "Company email",
  personalEmail: "Personal email",
  mobileNo: "Mobile",
  phoneHome: "Home phone",
  permanentAddress: "Permanent address",
  temporaryAddress: "Temporary address",
  fatherName: "Father's name",
  motherName: "Mother's name",
  grandfatherName: "Grandfather's name",
  spouseName: "Spouse's name",
  bankName: "Bank",
  bankBranch: "Bank branch",
  bankAccountNumber: "Account number",
  informedDate: "Notice date",
  terminationDate: "Last working day",
  terminationType: "Separation type",
  terminationPlan: "Retirement benefit",
  terminationReason: "Reason",
  terminationRemarks: "Remarks",
};

/** Labels for a document row's fields (documents.<row>.<field>). */
export const DOCUMENT_FIELD_LABELS: Record<string, string> = {
  type: "Document",
  number: "Document number",
  district: "Issuing district",
  office: "Issuing office",
  issuedDate: "Issued date",
  file: "Scan",
};

/** Old document field names, still in the audit history of records saved before the documents list. */
const LEGACY_LABELS: Record<string, string> = {
  citizenshipNo: "Citizenship no.",
  issuingDistrict: "Citizenship district",
  nidNo: "National ID (NID)",
  nidIssuingDistrict: "NID district",
  passportNo: "Passport no.",
  passportIssuingDistrict: "Passport district",
  votersId: "Voter ID",
  voterIdIssuingDistrict: "Voter ID district",
};

export function fieldLabel(field: string): string {
  const row = /^documents\.(\d+)\.(\w+)$/.exec(field);
  if (row) return `${DOCUMENT_FIELD_LABELS[row[2]] ?? row[2]} (document ${Number(row[1]) + 1})`;
  return EMPLOYEE_FIELD_LABELS[field as EmployeeField] ?? LEGACY_LABELS[field] ?? field;
}

/** The form tab a field, or an error key such as documents.0.number, is on. */
export function sectionOfField(field: string): string | undefined {
  const base = field.split(".")[0];
  return EMPLOYEE_FORM_SECTIONS.find((s) => s.id === base || s.fields.includes(base as EmployeeField))?.id;
}
