import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmployee,
  validateEmployeeTab,
  getNextEmployeeCode,
  getNextAttendanceCode,
} from '../lib/engines/employee.engine';
import {
  validateCitizenshipNo,
  validateNIDNo,
  validatePassportNo,
  validateVoterIdNo,
  validatePanNo,
} from '../lib/utils/nepal-docs';
import {
  PROVINCES,
  DISTRICTS,
  getDistrictsByProvince,
  getPalikasByDistrict,
  parseStructuredAddress,
  formatStructuredAddress,
  serializeStructuredAddress,
} from '../lib/constants/nepal-locations';
import { bsToAD, adToBS } from '../lib/utils/bs-calendar';
import type { EmployeeFormData } from '../lib/types/employee';

function createValidEmployeeData(): EmployeeFormData {
  return {
    attendanceCode: "ATD-101",
    employeeCode: "EMP-101",
    firstName: "Aarav",
    lastName: "Sharma",
    gender: "Male",
    dateOfBirth: "1995-05-15", // ~31 years old
    taxStatus: "Normal Single",
    isDisabled: false,
    category: "Permanent",
    shreni: "S1",
    departmentId: "dept-1",
    designationId: "desig-1",
    branchId: "branch-1",
    supervisorId: "",
    joiningDate: "2020-01-01", // Age at joining: ~24.6 years (>= 18)
    confirmationDate: "2020-06-01",
    retirementDateProjected: "2055-05-15",
    status: "Active",
    salaryGrade: "G9",
    gradePercent: 100,
    gradeAmount: 45000,
    citizenshipNo: "27-01-75-01234",
    issuingDistrict: "Kathmandu",
    nidNo: "123-456-7890",
    nidIssuingDistrict: "Kathmandu",
    passportNo: "PA1234567",
    passportIssuingDistrict: "Kathmandu",
    votersId: "12345678",
    voterIdIssuingDistrict: "Kathmandu",
    panNumber: "123456789",
    phoneHome: "015551234",
    mobileNo: "9841123456",
    email: "aarav.sharma@company.com",
    companyEmail: "aarav.sharma@company.com",
    personalEmail: "aarav.sharma@gmail.com",
    permanentAddress: serializeStructuredAddress({
      province: "P3",
      district: "Kathmandu",
      localLevel: "Kathmandu Metropolitan City",
      wardNo: "4",
      tole: "Baluwatar Marg",
    }),
    temporaryAddress: serializeStructuredAddress({
      province: "P3",
      district: "Lalitpur",
      localLevel: "Lalitpur Metropolitan City",
      wardNo: "2",
      tole: "Sanepa",
    }),
    fatherName: "Bishnu Sharma",
    motherName: "Radha Sharma",
    spouseName: "",
    grandfatherName: "Hari Prasad Sharma",
    bankName: "Nabil Bank",
    bankBranch: "Baluwatar",
    bankAccountNumber: "012345678901",
    informedDate: "",
    terminationDate: "",
    terminationType: "",
    terminationReason: "",
    terminationPlan: "",
    terminationRemarks: "",
  };
}

describe("Nepal Administrative Hierarchy & Address System", () => {
  it("should contain all 7 Provinces and 77 Districts", () => {
    assert.equal(PROVINCES.length, 7);
    assert.equal(DISTRICTS.length, 77);
  });

  it("should cascade districts by province", () => {
    const bagmatiDistricts = getDistrictsByProvince("P3");
    assert.equal(bagmatiDistricts.length, 13);
    const names = bagmatiDistricts.map((d) => d.name);
    assert.ok(names.includes("Kathmandu"));
    assert.ok(names.includes("Lalitpur"));
    assert.ok(names.includes("Bhaktapur"));
  });

  it("should retrieve local levels (palikas) for a given district", () => {
    const ktmPalikas = getPalikasByDistrict("Kathmandu");
    assert.ok(ktmPalikas.includes("Kathmandu Metropolitan City"));
    assert.ok(ktmPalikas.includes("Budhanilkantha Municipality"));

    const lalitpurPalikas = getPalikasByDistrict("Lalitpur");
    assert.ok(lalitpurPalikas.includes("Lalitpur Metropolitan City"));
  });

  it("should serialize, parse, and format structured addresses losslessly", () => {
    const addr = {
      province: "P3",
      district: "Lalitpur",
      localLevel: "Lalitpur Metropolitan City",
      wardNo: "4",
      tole: "Kumaripati",
    };

    const serialized = serializeStructuredAddress(addr);
    const parsed = parseStructuredAddress(serialized);
    assert.equal(parsed.province, "P3");
    assert.equal(parsed.district, "Lalitpur");
    assert.equal(parsed.localLevel, "Lalitpur Metropolitan City");
    assert.equal(parsed.wardNo, "4");
    assert.equal(parsed.tole, "Kumaripati");

    const formatted = formatStructuredAddress(parsed);
    assert.equal(formatted, "Kumaripati-4, Lalitpur Metropolitan City, Lalitpur, Bagmati Province");
  });
});

describe("Nepal Official Identity Documents Validation", () => {
  it("validates Nepal Citizenship Numbers", () => {
    assert.equal(validateCitizenshipNo("27-01-75-01234").isValid, true);
    assert.equal(validateCitizenshipNo("123/4567").isValid, true);
    assert.equal(validateCitizenshipNo("62-01-12-0849").isValid, true);
    assert.equal(validateCitizenshipNo("ABC12345").isValid, false);
    assert.equal(validateCitizenshipNo("12").isValid, false);
  });

  it("validates National Identity Card (NID) Numbers (Exactly 10 digits)", () => {
    assert.equal(validateNIDNo("123-456-7890").isValid, true);
    assert.equal(validateNIDNo("1234567890").isValid, true);
    assert.equal(validateNIDNo("123456789").isValid, false); // 9 digits
    assert.equal(validateNIDNo("12345678901").isValid, false); // 11 digits
    assert.equal(validateNIDNo("ABC4567890").isValid, false);
  });

  it("validates Nepal Passport Numbers", () => {
    assert.equal(validatePassportNo("PA1234567").isValid, true);
    assert.equal(validatePassportNo("08123456").isValid, true);
    assert.equal(validatePassportNo("P1234567").isValid, true);
    assert.equal(validatePassportNo("123").isValid, false);
    assert.equal(validatePassportNo("PA1234567890").isValid, false); // too long
    assert.equal(validatePassportNo("PA-12345").isValid, false);
  });

  it("validates Nepal Voter ID Numbers", () => {
    assert.equal(validateVoterIdNo("12345678").isValid, true);
    assert.equal(validateVoterIdNo("0123456789").isValid, true);
    assert.equal(validateVoterIdNo("V-12345678").isValid, true);
    assert.equal(validateVoterIdNo("123").isValid, false); // too short
    assert.equal(validateVoterIdNo("123456789012345").isValid, false); // too long
  });

  it("validates Nepal PAN Numbers (Exactly 9 digits)", () => {
    assert.equal(validatePanNo("123456789").isValid, true);
    assert.equal(validatePanNo("12345678").isValid, false); // 8 digits
    assert.equal(validatePanNo("1234567890").isValid, false); // 10 digits
    assert.equal(validatePanNo("ABC123456").isValid, false);
  });
});

describe("Employee Chronological Date Validations", () => {
  it("passes validation with a completely valid employee record", () => {
    const validData = createValidEmployeeData();
    const errors = validateEmployee(validData);
    assert.equal(Object.keys(errors).length, 0);
  });

  it("fails if employee is less than 18 years old today in Tab 0", () => {
    const data = createValidEmployeeData();
    data.dateOfBirth = "2015-01-01"; // 11 years old today
    const tab0Errors = validateEmployeeTab(data, 0);
    assert.ok(tab0Errors.dateOfBirth?.includes("at least 18 years old"));
  });

  it("fails if date of birth is in the future", () => {
    const data = createValidEmployeeData();
    const nextYear = new Date().getFullYear() + 1;
    data.dateOfBirth = `${nextYear}-01-01`;
    const tab0Errors = validateEmployeeTab(data, 0);
    assert.equal(tab0Errors.dateOfBirth, "Date of birth cannot be in the future");
  });

  it("fails if date of birth is older than 100 years", () => {
    const data = createValidEmployeeData();
    data.dateOfBirth = "1900-01-01";
    const tab0Errors = validateEmployeeTab(data, 0);
    assert.ok(tab0Errors.dateOfBirth?.includes("maximum 100 years"));
  });

  it("fails if employee is less than 18 years old at joining date", () => {
    const data = createValidEmployeeData();
    data.dateOfBirth = "2000-01-01";
    data.joiningDate = "2015-01-01"; // Age at joining: 15 years old
    const errors = validateEmployee(data);
    assert.ok(errors.joiningDate?.includes("at least 18 years old on joining date"));
  });

  it("fails if confirmation date is before joining date", () => {
    const data = createValidEmployeeData();
    data.joiningDate = "2023-01-01";
    data.confirmationDate = "2022-12-01"; // Before joining date!
    const errors = validateEmployee(data);
    assert.equal(errors.confirmationDate, "Confirmation date cannot be before joining date");
  });

  it("fails if projected retirement date is before joining or confirmation date", () => {
    const data = createValidEmployeeData();
    data.joiningDate = "2023-01-01";
    data.confirmationDate = "2023-06-01";
    data.retirementDateProjected = "2023-03-01"; // Before confirmation date!
    const errors = validateEmployee(data);
    assert.equal(errors.retirementDateProjected, "Projected retirement date must be after confirmation date");
  });

  it("validates termination date and notice date chronological consistency", () => {
    const data = createValidEmployeeData();
    data.status = "Terminated";
    data.joiningDate = "2023-01-01";
    data.terminationDate = "2022-01-01"; // Before joining!
    data.informedDate = "2022-05-01"; // After termination!
    data.terminationType = "Resignation";
    data.terminationReason = "Relocation";

    const errors = validateEmployee(data);
    assert.equal(errors.terminationDate, "Termination date cannot be before joining date");
    assert.equal(errors.informedDate, "Informed/Notice date cannot be after termination date");
  });
});

describe("Family Information & Marital Status Requirements", () => {
  it("requires fatherName, motherName, and grandfatherName", () => {
    const data = createValidEmployeeData();
    data.fatherName = "";
    data.motherName = "";
    data.grandfatherName = "";

    const errors = validateEmployee(data);
    assert.equal(errors.fatherName, "Father's name is required");
    assert.equal(errors.motherName, "Mother's name is required");
    assert.equal(errors.grandfatherName, "Grandfather's name is required");
  });

  it("requires spouseName ONLY if taxStatus is Married", () => {
    const data = createValidEmployeeData();
    data.taxStatus = "Married";
    data.spouseName = "";

    const errors = validateEmployee(data);
    assert.equal(errors.spouseName, "Spouse's name is required for married employees");

    // Once spouse name is provided, error should disappear
    data.spouseName = "Sunita Sharma";
    const errorsFixed = validateEmployee(data);
    assert.equal(errorsFixed.spouseName, undefined);
  });

  it("does NOT require spouseName if taxStatus is Normal Single", () => {
    const data = createValidEmployeeData();
    data.taxStatus = "Normal Single";
    data.spouseName = "";

    const errors = validateEmployee(data);
    assert.equal(errors.spouseName, undefined);
  });
});

describe("Step-by-Step Per-Tab Validation Engine (validateEmployeeTab)", () => {
  it("validates Tab 0 (General Information) in isolation", () => {
    const data = createValidEmployeeData();
    data.firstName = "";
    data.dateOfBirth = "";

    // Tab 0 has errors
    const tab0Errors = validateEmployeeTab(data, 0);
    assert.equal(tab0Errors.firstName, "First name is required");
    assert.equal(tab0Errors.dateOfBirth, "Date of birth is required");

    // Other tabs are unaffected
    const tab1Errors = validateEmployeeTab(data, 1);
    assert.equal(Object.keys(tab1Errors).length, 0);
  });

  it("validates Tab 1 (Office Information) in isolation", () => {
    const data = createValidEmployeeData();
    data.departmentId = "";
    data.salaryGrade = "";
    data.shreni = "";
    data.gradeAmount = -1;

    const tab1Errors = validateEmployeeTab(data, 1);
    assert.equal(tab1Errors.departmentId, "Department is required");
    assert.equal(tab1Errors.salaryGrade, "Salary grade is required");
    assert.equal(tab1Errors.shreni, "Shreni is required");
    assert.equal(tab1Errors.gradeAmount, "Grade amount is required");

    const tab0Errors = validateEmployeeTab(data, 0);
    assert.equal(Object.keys(tab0Errors).length, 0);
  });

  it("validates Tab 2 (Personal Info & Documents & Addresses) in isolation", () => {
    const data = createValidEmployeeData();
    data.citizenshipNo = "invalid citizenship";
    data.nidNo = "123"; // invalid 3 digits
    data.permanentAddress = "";

    const tab2Errors = validateEmployeeTab(data, 2);
    assert.ok(tab2Errors.citizenshipNo);
    assert.ok(tab2Errors.nidNo);
    assert.equal(tab2Errors.permanentAddress, "Permanent address is required");
  });

  it("validates Tab 3 (Family Info) in isolation", () => {
    const data = createValidEmployeeData();
    data.fatherName = "";

    const tab3Errors = validateEmployeeTab(data, 3);
    assert.equal(tab3Errors.fatherName, "Father's name is required");
    assert.equal(tab3Errors.motherName, undefined);
  });

  it("validates Tab 4 (Bank & Termination) in isolation", () => {
    const data = createValidEmployeeData();
    data.bankName = "";
    data.bankBranch = "";
    data.bankAccountNumber = "";
    data.status = "Terminated";
    data.terminationDate = "";

    const tab4Errors = validateEmployeeTab(data, 4);
    assert.equal(tab4Errors.bankName, "Bank name is required");
    assert.equal(tab4Errors.bankBranch, "Bank branch is required");
    assert.equal(tab4Errors.bankAccountNumber, "Bank account number is required");
    assert.ok(tab4Errors.terminationDate);
  });
});

describe("Bikram Sambat (B.S.) Exact Day Preservation", () => {
  it("preserves exact BS day without off-by-one subtraction when converting to AD and back", () => {
    const testCases = [
      { year: 2081, month: 1, day: 1 },
      { year: 2081, month: 1, day: 15 },
      { year: 2081, month: 1, day: 31 },
      { year: 2055, month: 8, day: 24 },
      { year: 2060, month: 12, day: 30 },
      { year: 2078, month: 5, day: 10 },
    ];

    for (const tc of testCases) {
      const ad = bsToAD(tc.year, tc.month, tc.day);
      const bs = adToBS(ad);
      assert.equal(bs.year, tc.year, `Year mismatch for ${tc.year}-${tc.month}-${tc.day}`);
      assert.equal(bs.month, tc.month, `Month mismatch for ${tc.year}-${tc.month}-${tc.day}`);
      assert.equal(bs.day, tc.day, `Day mismatch (off-by-one error) for ${tc.year}-${tc.month}-${tc.day}`);
    }
  });
});

describe("Employee Code & Attendance Code Smart Generation", () => {
  it("generates initial code EMP-001 when list is empty", () => {
    const nextCode = getNextEmployeeCode([]);
    assert.equal(nextCode, "EMP-001");
  });

  it("calculates next sequential code accurately", () => {
    const existing = ["EMP-001", "EMP-002", "EMP-009"];
    const nextCode = getNextEmployeeCode(existing);
    assert.equal(nextCode, "EMP-010");
  });

  it("handles mixed codes and preserves width", () => {
    const existing = ["EMP-001", "EMP-042", "EMP-099"];
    const nextCode = getNextEmployeeCode(existing);
    assert.equal(nextCode, "EMP-100");
  });

  it("generates initial attendance code when list is empty", () => {
    const atdCode = getNextAttendanceCode([]);
    assert.equal(atdCode, "ATD-001");
  });

  it("generates sequential attendance code based on existing attendance codes", () => {
    const atdCode = getNextAttendanceCode(["ATD-001", "ATD-002", "ATD-009"]);
    assert.equal(atdCode, "ATD-010");
  });

  it("generates numeric sequential attendance code when existing codes are numeric", () => {
    const atdCode = getNextAttendanceCode(["101", "102", "103"]);
    assert.equal(atdCode, "104");
  });
});



