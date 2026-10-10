import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPLOYEE_IMPORT_COLUMNS, columnOfField, columnsBehindField, employeeRowToForm, matchBank, numberKey, type EmployeeImportLookups } from "@/lib/engines/employee-import.engine";
import { readBsDate, type SheetRow } from "@/lib/engines/import.engine";
import { parseStructuredAddress } from "@/lib/constants/nepal-locations";

// F15: a template row becomes the employee form's data, so the form's own rules check it.

const lookups: EmployeeImportLookups = {
  branches: [
    { id: "b-lkn", name: "Lekhnath", code: "LKN", status: "Active" },
    { id: "b-ktm", name: "Kathmandu", code: "KTM", status: "Active" },
  ],
  departments: [
    { id: "d-ops", name: "Operations", code: "OPS", status: "Active" },
    { id: "d-fin", name: "Finance", code: "FIN", status: "Active" },
  ],
  designations: [
    { id: "g-asst", name: "Assistant", departmentId: "d-ops", status: "Active" },
    { id: "g-acct", name: "Accountant", departmentId: "d-fin", status: "Active" },
  ],
  levels: [{ code: "S5", name: "Assistant level", minSalary: 25000 }],
  categories: ["Permanent", "Contract"],
  supervisors: [{ id: "e-sita", employeeCode: "EMP-001" }],
};

const filled: Record<string, string> = {
  employeeCode: "",
  attendanceCode: "",
  fullName: "Gita Gurung",
  gender: "F",
  dateOfBirth: "2050-04-15",
  taxStatus: "single",
  isDisabled: "",
  branch: "lkn",
  department: "Operations",
  designation: "assistant",
  level: "S5",
  category: "permanent",
  joiningDate: "2081-04-01",
  confirmationDate: "",
  supervisor: "emp-001",
  mobileNo: "9841234567",
  companyEmail: "Gita@Example.coop",
  personalEmail: "",
  district: "kaski",
  localLevel: "pokhara metropolitan city",
  ward: "8",
  tole: "Lakeside",
  fatherName: "Hari Gurung",
  motherName: "Maya Gurung",
  grandfatherName: "Ram Gurung",
  spouseName: "",
  citizenshipNo: "45-01-75-12345",
  citizenshipDistrict: "Kaski",
  citizenshipIssued: "2068-05-10",
  citizenshipOffice: "",
  panNumber: "123456789",
  ssfNumber: "",
  pfNumber: "",
  citNumber: "",
  bankName: "nic asia",
  bankBranch: "Pokhara",
  bankAccountNumber: "0123 4567 8901",
  basicSalary: "",
  gradeCount: "2",
};
const row = (patch: Record<string, string> = {}): SheetRow => ({ line: 2, cells: { ...filled, ...patch } });
const ad = (bs: string) => {
  const r = readBsDate(bs);
  assert.ok("ad" in r);
  return r.ad;
};
const errorsOf = (patch: Record<string, string>) =>
  employeeRowToForm(row(patch), lookups)
    .issues.filter((i) => i.level === "error")
    .map((i) => `${i.column}: ${i.message}`);

test("a filled-in row becomes the form's data: ids by name or code, AD dates, the address and the citizenship row", () => {
  const { form, issues } = employeeRowToForm(row(), lookups);
  assert.deepEqual(issues, []);
  assert.equal(form.fullName, "Gita Gurung");
  assert.equal(form.gender, "Female");
  assert.equal(form.taxStatus, "Normal Single");
  assert.deepEqual([form.branchId, form.departmentId, form.designationId, form.shreni, form.category, form.supervisorId], ["b-lkn", "d-ops", "g-asst", "S5", "Permanent", "e-sita"]);
  assert.equal(form.dateOfBirth, ad("2050-04-15"));
  assert.equal(form.joiningDate, ad("2081-04-01"));
  assert.equal(form.confirmationDate, "");
  assert.equal(form.companyEmail, "gita@example.coop");
  assert.equal(form.email, "gita@example.coop");
  const address = parseStructuredAddress(form.permanentAddress ?? "");
  assert.deepEqual([address.province, address.district, address.localLevel, address.wardNo, address.tole], ["P4", "Kaski", "Pokhara Metropolitan City", "8", "Lakeside"]);
  assert.deepEqual(form.documents, [
    { type: "citizenship", number: "45-01-75-12345", district: "Kaski", office: "District Administration Office, Kaski", issuedDate: ad("2068-05-10"), file: null },
  ]);
  assert.equal(form.bankName, "NIC Asia Bank Limited");
  assert.equal(form.bankAccountNumber, "012345678901");
  // No basic salary typed: the level's starting salary, as choosing the level in the form gives.
  assert.equal(form.basicSalary, 25000);
  assert.equal(form.gradeCount, 2);
});

test("names that match nothing are errors on their own column, never guesses", () => {
  assert.deepEqual(errorsOf({ branch: "Nowhere" }), ['Branch: No branch "Nowhere"']);
  // A designation must belong to the row's department.
  assert.deepEqual(errorsOf({ designation: "Accountant" }), ['Designation: No designation "Accountant" in Operations']);
  assert.deepEqual(errorsOf({ level: "S9", supervisor: "EMP-404" }), ['Level: No level "S9"', "Reports to (employee code): EMP-404 is not a supervisor in the system"]);
  assert.deepEqual(errorsOf({ gender: "X", category: "Daily wage" }), ['Gender: "X" is not Male, Female or Other', 'Category: No employment type "Daily wage"']);
  assert.deepEqual(errorsOf({ localLevel: "Bharatpur Metropolitan City" }), ['Permanent local level: No local level "Bharatpur Metropolitan City" in Kaski']);
  assert.deepEqual(errorsOf({ isDisabled: "maybe" }), ["Disability relief: Use Yes or No"]);
  // An unknown bank is kept as typed, with a note.
  const bank = employeeRowToForm(row({ bankName: "Pokhara Sahakari Bank" }), lookups);
  assert.equal(bank.form.bankName, "Pokhara Sahakari Bank");
  assert.deepEqual(bank.issues.map((i) => i.level), ["warning"]);
});

test("pay: an amount below the level's start is a note, anything not an amount or whole grade count is an error", () => {
  const below = employeeRowToForm(row({ basicSalary: "20,000" }), lookups);
  assert.equal(below.form.basicSalary, 20000);
  assert.deepEqual(below.issues, [{ column: "Basic salary", message: "Below the level's starting salary (NPR 25,000)", level: "warning" }]);
  assert.equal(employeeRowToForm(row({ basicSalary: "32,500.50" }), lookups).form.basicSalary, 32500.5);
  assert.deepEqual(errorsOf({ basicSalary: "abc" }), ['Basic salary: "abc" is not an amount']);
  assert.deepEqual(errorsOf({ basicSalary: "-5" }), ['Basic salary: "-5" is not an amount']);
  assert.deepEqual(errorsOf({ gradeCount: "1.5" }), ["Grades: Use a whole number from 0 to 99"]);
});

test("what Excel changes (long numbers, BS dates read as AD) is pointed out with the fix", () => {
  assert.deepEqual(errorsOf({ bankAccountNumber: "1.23457E+15" }), ["Account number: Excel changed this number to 1.23457E+15: set the column to Text and type it again"]);
  assert.deepEqual(errorsOf({ dateOfBirth: "4/15/2050" }), ["Date of birth (BS): Excel changed this date to 4/15/2050: set the column to Text and type the BS date again as YYYY-MM-DD"]);
  assert.deepEqual(errorsOf({ ward: "40" }), ["Permanent ward: Ward number must be between 1 and 35"]);
  // The ward may be empty, as in the form.
  assert.deepEqual(errorsOf({ ward: "" }), []);
});

test("form errors land on the template column they are about", () => {
  assert.equal(columnOfField("branchId"), "Branch");
  assert.equal(columnOfField("shreni"), "Level");
  assert.equal(columnOfField("email"), "Company email");
  assert.equal(columnOfField("documents"), "Citizenship number");
  assert.equal(columnOfField("documents.0.number"), "Citizenship number");
  assert.equal(columnOfField("documents.0.issuedDate"), "Citizenship issued date (BS)");
  assert.equal(columnOfField("documents.0.district"), "Citizenship district");
  assert.equal(columnOfField("permanentAddress", "Permanent address is required"), "Permanent district");
  assert.equal(columnOfField("permanentAddress", "Ward number must be between 1 and 35"), "Permanent ward");
  assert.equal(columnOfField("panNumber"), "PAN");
});

test("banks match by full or short name, or the one bank a start of the name fits", () => {
  assert.equal(matchBank("Nabil Bank Limited")?.id, "nabil");
  assert.equal(matchBank("nic asia")?.id, "nic-asia");
  assert.equal(matchBank("Nepal"), undefined); // several banks start with Nepal
  assert.equal(matchBank("ni"), undefined); // too short to tell
});

test("the template has one column per key and header", () => {
  const keys = EMPLOYEE_IMPORT_COLUMNS.map((c) => c.key);
  const headers = EMPLOYEE_IMPORT_COLUMNS.map((c) => c.header.toLowerCase());
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(headers).size, headers.length);
  // Every column the row reader uses is in the template.
  for (const key of Object.keys(filled)) assert.ok(keys.includes(key), key);
});

test("an address error already reported on its own column explains the empty permanent address", () => {
  assert.deepEqual(columnsBehindField("permanentAddress"), ["Permanent district", "Permanent local level", "Permanent ward"]);
  assert.deepEqual(columnsBehindField("documents.0.issuedDate"), ["Citizenship issued date (BS)"]);
});

test("identity and account numbers compare as the same number however they are separated", () => {
  assert.equal(numberKey("41-01-72-01234"), numberKey("41/01/72/01234"));
  assert.equal(numberKey(" 4101 7201234 "), "41017201234");
  assert.equal(numberKey("AB-12"), numberKey("ab12"));
  assert.equal(numberKey("--"), "");
});
