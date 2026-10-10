import { NEPAL_BANKS, findBankByName, type NepalBank } from "@/lib/constants/nepal-banks";
import { DISTRICTS, findProvinceByDistrict, getPalikasByDistrict, serializeStructuredAddress } from "@/lib/constants/nepal-locations";
import { isValidWard } from "@/lib/engines/employee.engine";
import { excelChangedNumber, readAmount, readBsDate, readChoice, readYesNo, type ImportColumn, type RowIssue, type SheetRow } from "@/lib/engines/import.engine";
import type { EmployeeFormData } from "@/lib/types/employee";

// Employee import (4.8 / F15): one template row → the same form data the employee form saves,
// so every rule of the form (and the save) applies to imported rows too. The template's columns,
// the lookups by name or code, and which column a form error belongs to. Pure.

export const EMPLOYEE_IMPORT_COLUMNS: readonly ImportColumn[] = [
  { key: "employeeCode", header: "Employee code", help: "Leave empty for the next free code." },
  { key: "attendanceCode", header: "Attendance code", help: "The code on the attendance device; empty for the next free one." },
  { key: "fullName", header: "Full name", required: true, help: "As on the citizenship certificate." },
  { key: "gender", header: "Gender", required: true, help: "Male, Female or Other." },
  { key: "dateOfBirth", header: "Date of birth (BS)", required: true, help: "YYYY-MM-DD in BS, e.g. 2050-04-15 (18 or older)." },
  { key: "taxStatus", header: "Tax status", required: true, help: "Single, Married or Widow." },
  { key: "isDisabled", header: "Disability relief", help: "Yes or No (empty: No)." },
  { key: "branch", header: "Branch", required: true, help: "Branch name or code, as under Organization." },
  { key: "department", header: "Department", required: true, help: "Department name or code." },
  { key: "designation", header: "Designation", required: true, help: "A designation of that department." },
  { key: "level", header: "Level", required: true, help: "Level code (e.g. S5) or name." },
  { key: "category", header: "Category", required: true, help: "Employment type, e.g. Permanent, Contract, Probation." },
  { key: "joiningDate", header: "Joining date (BS)", required: true, help: "YYYY-MM-DD in BS." },
  { key: "confirmationDate", header: "Confirmation date (BS)", help: "YYYY-MM-DD in BS, when confirmed." },
  { key: "supervisor", header: "Reports to (employee code)", help: "Code of a supervisor already in the system." },
  { key: "mobileNo", header: "Mobile", required: true, help: "Nepali mobile number, e.g. 9841234567." },
  { key: "companyEmail", header: "Company email", required: true, help: "Also the self-service sign-in, when a login is created." },
  { key: "personalEmail", header: "Personal email", help: "Optional." },
  { key: "district", header: "Permanent district", required: true, help: "District name, e.g. Kaski." },
  { key: "localLevel", header: "Permanent local level", required: true, help: "Palika name, e.g. Pokhara Metropolitan City." },
  { key: "ward", header: "Permanent ward", help: "Ward number, 1 to 35." },
  { key: "tole", header: "Permanent tole", help: "Optional." },
  { key: "fatherName", header: "Father's name", required: true, help: "" },
  { key: "motherName", header: "Mother's name", required: true, help: "" },
  { key: "grandfatherName", header: "Grandfather's name", required: true, help: "" },
  { key: "spouseName", header: "Spouse's name", help: "Needed when the tax status is Married." },
  { key: "citizenshipNo", header: "Citizenship number", required: true, help: "" },
  { key: "citizenshipDistrict", header: "Citizenship district", required: true, help: "Issuing district." },
  { key: "citizenshipIssued", header: "Citizenship issued date (BS)", required: true, help: "YYYY-MM-DD in BS." },
  { key: "citizenshipOffice", header: "Citizenship issuing office", help: "Empty: District Administration Office, <district>." },
  { key: "panNumber", header: "PAN", help: "9 digits." },
  { key: "ssfNumber", header: "SSF ID", help: "Optional." },
  { key: "pfNumber", header: "PF number", help: "Optional." },
  { key: "citNumber", header: "CIT number", help: "Optional." },
  { key: "bankName", header: "Bank", required: true, help: "Bank name or short name, e.g. Nabil, NIC Asia." },
  { key: "bankBranch", header: "Bank branch", required: true, help: "" },
  { key: "bankAccountNumber", header: "Account number", required: true, help: "Digits, letters and hyphens." },
  { key: "basicSalary", header: "Basic salary", help: "Monthly; empty for the level's starting salary. Needs Salary mapping → Edit (without it, the level's starting salary applies)." },
  { key: "gradeCount", header: "Grades", help: "Number of grades (whole number); the grade amount follows the company's grade policy." },
];

const header = (key: string) => EMPLOYEE_IMPORT_COLUMNS.find((c) => c.key === key)?.header ?? key;

/** The template column a form error belongs to (form field or documents.<row>.<field>). */
export function columnOfField(field: string, message = ""): string {
  if ((field === "permanentAddress" || field === "address1") && /^ward/i.test(message)) return header("ward");
  const doc = /^documents(?:\.\d+\.(\w+))?$/.exec(field);
  if (doc) return header(doc[1] === "district" ? "citizenshipDistrict" : doc[1] === "issuedDate" ? "citizenshipIssued" : doc[1] === "office" ? "citizenshipOffice" : "citizenshipNo");
  const map: Record<string, string> = {
    branchId: "branch",
    departmentId: "department",
    designationId: "designation",
    shreni: "level",
    supervisorId: "supervisor",
    permanentAddress: "district",
    address1: "district",
    email: "companyEmail",
  };
  return header(map[field] ?? field);
}

/**
 * The template columns behind a form field: an error already reported on one of them explains the
 * field's own error (an unknown local level leaves the permanent address empty).
 */
export function columnsBehindField(field: string, message = ""): string[] {
  if (field === "permanentAddress" || field === "address1") return [header("district"), header("localLevel"), header("ward")];
  return [columnOfField(field, message)];
}

/** Citizenship / NID and account numbers compare without spaces, dashes or slashes. */
export function numberKey(text: string): string {
  return text.replace(/[^0-9a-z]/gi, "").toLowerCase();
}

export interface EmployeeImportLookups {
  branches: readonly { id: string; name: string; code: string; status: string }[];
  departments: readonly { id: string; name: string; code: string; status: string }[];
  designations: readonly { id: string; name: string; departmentId: string; status: string }[];
  /** Active levels; minSalary is the starting salary a hire gets when the file gives none. */
  levels: readonly { code: string; name: string; minSalary?: number | null }[];
  categories: readonly string[];
  supervisors: readonly { id: string; employeeCode: string }[];
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const npr = (n: number) => `NPR ${n.toLocaleString("en-IN")}`;

/** Columns holding numbers that are codes: Excel must keep them as typed. */
const CODE_COLUMNS = ["mobileNo", "citizenshipNo", "panNumber", "ssfNumber", "pfNumber", "citNumber", "bankAccountNumber"] as const;

/** A bank by its name, short name or id, else the one bank whose name starts with what was typed ("NIC Asia"). */
export function matchBank(typed: string): NepalBank | undefined {
  const exact = findBankByName(typed);
  if (exact) return exact;
  const q = typed.trim().toLowerCase();
  if (q.length < 3) return undefined;
  const starts = NEPAL_BANKS.filter((b) => b.name.toLowerCase().startsWith(q) || b.shortName.toLowerCase().startsWith(q));
  return starts.length === 1 ? starts[0] : undefined;
}
const GENDERS = [
  { value: "Male", label: "Male", aliases: ["m", "पुरुष"] },
  { value: "Female", label: "Female", aliases: ["f", "महिला"] },
  { value: "Other", label: "Other", aliases: ["अन्य"] },
] as const;
const TAX_STATUSES = [
  { value: "Normal Single", label: "Single", aliases: ["unmarried", "एकल"] },
  { value: "Married", label: "Married", aliases: ["couple", "married (couple slab)", "दम्पती", "विवाहित"] },
  { value: "Widow", label: "Widow", aliases: ["widower", "widow / widower"] },
] as const;

/**
 * One row as the employee form's data (no codes yet when the row leaves them empty), with the
 * problems found while reading it. The caller merges it into an empty form and runs the form's
 * own validation.
 */
export function employeeRowToForm(row: SheetRow, lookups: EmployeeImportLookups): { form: Partial<EmployeeFormData>; issues: RowIssue[] } {
  const c = row.cells;
  const issues: RowIssue[] = [];
  const err = (key: string, message: string) => issues.push({ column: header(key), message, level: "error" });
  const warn = (key: string, message: string) => issues.push({ column: header(key), message, level: "warning" });
  const date = (key: string, required: boolean): string => {
    const text = c[key] ?? "";
    if (!text) {
      if (required) err(key, "Required");
      return "";
    }
    const r = readBsDate(text);
    if ("error" in r) {
      err(key, r.error);
      return "";
    }
    return r.ad;
  };

  const gender = readChoice(c.gender ?? "", GENDERS);
  if (!gender) err("gender", c.gender ? `"${c.gender}" is not Male, Female or Other` : "Required");
  const taxStatus = readChoice(c.taxStatus ?? "", TAX_STATUSES);
  if (!taxStatus) err("taxStatus", c.taxStatus ? `"${c.taxStatus}" is not Single, Married or Widow` : "Required");
  const disabled = readYesNo(c.isDisabled ?? "");
  if (disabled === null) err("isDisabled", "Use Yes or No");

  const branch = lookups.branches.find((b) => same(b.name, c.branch ?? "") || same(b.code, c.branch ?? ""));
  if (!branch) err("branch", c.branch ? `No branch "${c.branch}"` : "Required");
  const department = lookups.departments.find((d) => same(d.name, c.department ?? "") || same(d.code, c.department ?? ""));
  if (!department) err("department", c.department ? `No department "${c.department}"` : "Required");
  const designation = department ? lookups.designations.find((d) => d.departmentId === department.id && same(d.name, c.designation ?? "")) : undefined;
  if (department && !designation) err("designation", c.designation ? `No designation "${c.designation}" in ${department.name}` : "Required");
  const level = lookups.levels.find((l) => same(l.code, c.level ?? "") || same(l.name, c.level ?? ""));
  if (!level) err("level", c.level ? `No level "${c.level}"` : "Required");
  const category = lookups.categories.find((x) => same(x, c.category ?? ""));
  if (!category) err("category", c.category ? `No employment type "${c.category}"` : "Required");
  const supervisor = c.supervisor ? lookups.supervisors.find((s) => same(s.employeeCode, c.supervisor)) : undefined;
  if (c.supervisor && !supervisor) err("supervisor", `${c.supervisor} is not a supervisor in the system`);

  for (const key of CODE_COLUMNS) {
    if (c[key] && excelChangedNumber(c[key])) err(key, `Excel changed this number to ${c[key]}: set the column to Text and type it again`);
  }

  const district = DISTRICTS.find((d) => same(d.name, c.district ?? ""));
  if (!district) err("district", c.district ? `No district "${c.district}"` : "Required");
  const localLevel = district ? getPalikasByDistrict(district.name).find((p) => same(p, c.localLevel ?? "")) : undefined;
  if (district && !localLevel) err("localLevel", c.localLevel ? `No local level "${c.localLevel}" in ${district.name}` : "Required");
  if (!isValidWard(c.ward)) err("ward", "Ward number must be between 1 and 35");
  const docDistrict = DISTRICTS.find((d) => same(d.name, c.citizenshipDistrict ?? ""));
  if (!docDistrict) err("citizenshipDistrict", c.citizenshipDistrict ? `No district "${c.citizenshipDistrict}"` : "Required");

  const bank = c.bankName ? matchBank(c.bankName) : undefined;
  if (c.bankName && !bank) warn("bankName", `"${c.bankName}" is not in the list of banks; kept as typed`);

  // An empty basic salary is the level's starting salary, as choosing the level in the form gives.
  const startingSalary = Math.max(0, Number(level?.minSalary) || 0);
  const basicText = c.basicSalary ?? "";
  const typedBasic = basicText ? readAmount(basicText) : null;
  if (basicText && (typedBasic === null || typedBasic < 0)) err("basicSalary", `"${basicText}" is not an amount`);
  else if (typedBasic !== null && typedBasic > 0 && typedBasic < startingSalary) warn("basicSalary", `Below the level's starting salary (${npr(startingSalary)})`);
  const basic = basicText ? Math.max(0, typedBasic ?? 0) : startingSalary;
  const gradesText = c.gradeCount ?? "";
  const grades = gradesText ? Number(gradesText) : 0;
  if (!Number.isInteger(grades) || grades < 0 || grades > 99) err("gradeCount", "Use a whole number from 0 to 99");

  const issuedDate = date("citizenshipIssued", true);
  const form: Partial<EmployeeFormData> = {
    employeeCode: c.employeeCode ?? "",
    attendanceCode: c.attendanceCode ?? "",
    fullName: c.fullName ?? "",
    gender: (gender ?? "Male") as EmployeeFormData["gender"],
    dateOfBirth: date("dateOfBirth", true),
    taxStatus: (taxStatus ?? "Normal Single") as EmployeeFormData["taxStatus"],
    isDisabled: disabled ?? false,
    branchId: branch?.id ?? "",
    departmentId: department?.id ?? "",
    designationId: designation?.id ?? "",
    shreni: level?.code ?? "",
    category: (category ?? "") as EmployeeFormData["category"],
    joiningDate: date("joiningDate", true),
    confirmationDate: date("confirmationDate", false),
    supervisorId: supervisor?.id ?? "",
    isSupervisor: false,
    mobileNo: c.mobileNo ?? "",
    companyEmail: (c.companyEmail ?? "").toLowerCase(),
    email: (c.companyEmail ?? "").toLowerCase(),
    personalEmail: (c.personalEmail ?? "").toLowerCase(),
    permanentAddress:
      district && localLevel
        ? serializeStructuredAddress({ province: findProvinceByDistrict(district.name)?.id ?? "", district: district.name, localLevel, wardNo: c.ward ?? "", tole: c.tole ?? "" })
        : "",
    temporaryAddress: "",
    fatherName: c.fatherName ?? "",
    motherName: c.motherName ?? "",
    grandfatherName: c.grandfatherName ?? "",
    spouseName: c.spouseName ?? "",
    documents: [
      {
        type: "citizenship",
        number: c.citizenshipNo ?? "",
        district: docDistrict?.name ?? "",
        office: c.citizenshipOffice || (docDistrict ? `District Administration Office, ${docDistrict.name}` : ""),
        issuedDate,
        file: null,
      },
    ],
    panNumber: c.panNumber ?? "",
    ssfNumber: c.ssfNumber ?? "",
    pfNumber: c.pfNumber ?? "",
    citNumber: c.citNumber ?? "",
    bankName: bank?.name ?? c.bankName ?? "",
    bankBranch: c.bankBranch ?? "",
    bankAccountNumber: (c.bankAccountNumber ?? "").replace(/\s+/g, ""),
    basicSalary: basic,
    gradeCount: Number.isInteger(grades) ? grades : 0,
  };
  return { form, issues };
}
