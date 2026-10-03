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
    fields: ["fullName", "gender", "employeeCode", "attendanceCode", "dateOfBirth", "taxStatus", "isDisabled"],
    required: ["fullName", "gender", "employeeCode", "attendanceCode", "dateOfBirth", "taxStatus"],
  },
  {
    id: "job",
    label: "Job & placement",
    fields: ["departmentId", "designationId", "branchId", "shreni", "category", "supervisorId", "joiningDate", "confirmationDate", "isSupervisor"],
    required: ["departmentId", "designationId", "branchId", "shreni", "category", "joiningDate"],
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
    fields: ["citizenshipNo", "issuingDistrict", "nidNo", "nidIssuingDistrict", "passportNo", "passportIssuingDistrict", "votersId", "voterIdIssuingDistrict", "panNumber"],
    required: ["citizenshipNo", "issuingDistrict"],
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
  supervisorId: "Supervisor",
  isSupervisor: "Approves leave",
  joiningDate: "Joining date",
  confirmationDate: "Confirmation date",
  status: "Status",
  basicSalary: "Basic salary",
  gradeCount: "Grade count",
  gradeAmount: "Grade amount",
  citizenshipNo: "Citizenship no.",
  issuingDistrict: "Citizenship district",
  nidNo: "National ID (NID)",
  nidIssuingDistrict: "NID district",
  passportNo: "Passport no.",
  passportIssuingDistrict: "Passport district",
  votersId: "Voter ID",
  voterIdIssuingDistrict: "Voter ID district",
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

export function fieldLabel(field: string): string {
  return EMPLOYEE_FIELD_LABELS[field as EmployeeField] ?? field;
}
