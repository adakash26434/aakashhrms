import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { attendanceMonth, codeConflicts, isValidWard, separationErrors, historySummary, registerCounts, resolveRecordTab, sectionProgress, tenureLabel, toEmployeeListRow, validateEmployeeField, type RegisterNames } from '../lib/engines/employee.engine';
import { EMPTY_EMPLOYEE_FORM } from '../lib/services/employee.service';
import { EMPLOYEE_FORM_SECTIONS, EMPLOYEE_FIELD_LABELS } from '../lib/constants/employee-form';
import type { EmployeeFormData } from '../lib/types/employee';
import type { Employee } from '../lib/types/employee';
import type { GradePolicySettings } from '../lib/types/system-control';
import { changeAddress, provinceIdOf } from '../lib/constants/nepal-locations';
import { DEFAULT_GRADE_POLICY, gradeBreakdown, policySyncedGradeAmount, resolvePay, type EmployeePay } from '../lib/engines/grade-policy.engine';

const names: RegisterNames = {
  department: new Map([['d1', 'Finance & Accounts']]),
  designation: new Map([['g1', 'Senior Accountant']]),
  branch: new Map([['b1', 'Head Office']]),
  employee: new Map([['sup', 'Sumina Shrestha']]),
};

const employee = (over: Partial<Employee> = {}): Employee =>
  ({
    id: 'e1',
    employeeCode: 'EMP-002',
    attendanceCode: 'ATD-002',
    fullName: 'Pramod Sharma',
    gender: 'Male',
    category: 'Permanent',
    status: 'Active',
    departmentId: 'd1',
    designationId: 'g1',
    branchId: 'b1',
    shreni: 'L7',
    supervisorId: 'sup',
    joiningDate: new Date('2026-06-15T00:00:00.000Z'),
    mobileNo: '+9779874562125',
    companyEmail: 'pramod@example.com',
    basicSalary: 30000,
    gradeAmount: 0,
    bankName: 'NIC Asia Bank Limited',
    bankAccountNumber: '0123456789015001',
    panNumber: '601234567',
    citizenshipNo: '27-01-75-12345',
    fatherName: 'Hari Sharma',
    permanentAddress: '{"district":"Kathmandu"}',
    ...over,
  }) as Employee;

describe('Employee register rows (4.2)', () => {
  it('resolves names and masks the bank account', () => {
    const row = toEmployeeListRow(employee(), names);
    assert.equal(row.departmentName, 'Finance & Accounts');
    assert.equal(row.designationName, 'Senior Accountant');
    assert.equal(row.branchName, 'Head Office');
    assert.equal(row.supervisorName, 'Sumina Shrestha');
    assert.equal(row.joiningDate, '2026-06-15');
    assert.equal(row.bankAccountMasked, '••••5001');
    assert.deepEqual(row.gaps, []);
  });

  it('never carries identity, family, address or full bank fields (S18)', () => {
    const row = toEmployeeListRow(employee(), names) as unknown as Record<string, unknown>;
    for (const key of ['bankAccountNumber', 'panNumber', 'citizenshipNo', 'fatherName', 'permanentAddress', 'dateOfBirth']) {
      assert.equal(key in row, false, key);
    }
    assert.ok(!JSON.stringify(row).includes('0123456789015001'));
  });

  it('lists record gaps and counts active employees to fix', () => {
    const rows = [
      toEmployeeListRow(employee({ panNumber: null, bankAccountNumber: '' }), names),
      toEmployeeListRow(employee({ id: 'e2', status: 'Inactive', basicSalary: 0 }), names),
      toEmployeeListRow(employee({ id: 'e3' }), names),
    ];
    assert.deepEqual(rows[0].gaps, ['pan', 'bank']);
    assert.deepEqual(registerCounts(rows), { total: 3, active: 2, inactive: 1, toFix: 1 });
  });

  it('shows no supervisor name for an unknown or missing supervisor', () => {
    assert.equal(toEmployeeListRow(employee({ supervisorId: null }), names).supervisorName, null);
    assert.equal(toEmployeeListRow(employee({ supervisorId: 'gone' }), names).supervisorName, null);
  });
});

describe('Employee record page (4.2)', () => {
  it('opens only tabs the user may see, falling back to Overview', () => {
    assert.equal(resolveRecordTab('payslips', ['profile', 'payslips']), 'payslips');
    assert.equal(resolveRecordTab('payslips', ['overview', 'profile', 'leave']), 'overview');
    assert.equal(resolveRecordTab(['leave'], ['overview', 'profile', 'leave']), 'overview');
    assert.equal(resolveRecordTab(undefined, ['overview', 'profile']), 'overview');
    assert.equal(resolveRecordTab('profile', ['overview', 'profile']), 'profile');
  });

  it('counts a month of attendance without treating missing days as absent', () => {
    const days = [1, 2, 3, 4, 5].map((d) => ({ date: `2026-09-${String(16 + d).padStart(2, '0')}`, bsDay: d, weekday: d % 7 }));
    const rec = (date: string, status: string) => ({ date, status, inTime: null, outTime: null, workHours: 8, isLate: false });
    const month = attendanceMonth('Aswin 2083', days, [rec('2026-09-17', 'Present'), rec('2026-09-18', 'Absent'), rec('2026-09-19', 'Half Day'), rec('2026-09-20', 'On Leave')]);
    assert.deepEqual(month.totals, { present: 1, absent: 1, leave: 1, halfDay: 1, other: 0, notRecorded: 1 });
    assert.equal(month.days[4].status, null);
  });

  it('describes history entries by field label, never by value', () => {
    assert.equal(historySummary({ action: 'EDIT', result: 'SUCCESS', newValues: { changedFields: ['basicSalary', 'panNumber'] } }), 'Changed Basic salary, PAN');
    assert.equal(
      historySummary({ action: 'EDIT', result: 'SUCCESS', newValues: { changedFields: ['fullName', 'mobileNo', 'bankName', 'bankBranch', 'bankAccountNumber', 'panNumber'] } }),
      'Changed Full name, Mobile, Bank, Bank branch and 2 more'
    );
    assert.equal(historySummary({ action: 'ADD', result: 'SUCCESS', newValues: { loginCreated: true } }), 'Record created, with a self-service login');
    assert.equal(historySummary({ action: 'EDIT', result: 'SUCCESS', newValues: { credentials: 'resent' } }), 'Sign-in details sent again');
    assert.equal(historySummary({ action: 'VIEW', result: 'DENIED_SCOPE', newValues: null }), "Refused: outside the user's branch or department");
  });

  it('shows length of service', () => {
    const today = new Date(2026, 9, 3);
    assert.equal(tenureLabel(new Date(2024, 6, 1), today), '2 yr 3 mo');
    assert.equal(tenureLabel(new Date(2026, 6, 15), today), '2 mo');
    assert.equal(tenureLabel(new Date(2026, 8, 20), today), 'Less than a month');
    assert.equal(tenureLabel(new Date(2027, 0, 1), today), 'Not started');
    assert.equal(tenureLabel(null, today), '');
  });

  it('loads the record through the scoped loader and keeps bank numbers out of tab queries (S18)', () => {
    const root = join(__dirname, '..');
    const service = readFileSync(join(root, 'lib/services/employee-record.service.ts'), 'utf8');
    assert.match(service, /getEmployeeInScope\(id, scope\)/);
    assert.match(service, /maskAccountNumber\(bankAccountNumber\)/);
    const payroll = readFileSync(join(root, 'lib/repositories/payroll.repository.ts'), 'utf8');
    const slips = payroll.slice(payroll.indexOf('export async function findSlipsByEmployee('));
    assert.ok(!/bankAccountNumber/.test(slips.slice(0, slips.indexOf('\n}\n'))));
  });
});

describe('Employee form (4.2)', () => {
  const filled: EmployeeFormData = {
    ...EMPTY_EMPLOYEE_FORM,
    employeeCode: 'EMP-010', attendanceCode: 'ATD-010', fullName: 'Sita Rai', dateOfBirth: '1995-04-14',
    departmentId: 'd1', designationId: 'g1', branchId: 'b1', shreni: 'L5', joiningDate: '2023-07-17', basicSalary: 30000,
    documents: [{ type: 'citizenship', number: '27-01-75-12345', district: 'Kaski', office: 'District Administration Office, Kaski', issuedDate: '2013-02-01', file: { id: 'f1', name: 'c.jpg', size: 900, mime: 'image/jpeg' } }],
    companyEmail: 'sita@example.test', mobileNo: '+9779841123456',
    permanentAddress: JSON.stringify({ province: 'P4', district: 'Kaski', localLevel: 'Pokhara Metropolitan City', wardNo: '4', tole: '' }),
    fatherName: 'A', motherName: 'B', grandfatherName: 'C', bankName: 'Nabil Bank Limited', bankBranch: 'Lakeside', bankAccountNumber: '001122',
  };

  it('checks one field with the same rules the server uses', () => {
    assert.equal(validateEmployeeField(filled, 'fullName'), null);
    assert.equal(validateEmployeeField({ ...filled, fullName: ' ' }, 'fullName'), 'Full name is required');
    assert.match(validateEmployeeField({ ...filled, panNumber: '12345' }, 'panNumber') ?? '', /9 digits/);
    assert.equal(validateEmployeeField({ ...filled, panNumber: '' }, 'panNumber'), null);
    // F9: fund numbers are optional, kept as typed, safe characters only.
    assert.equal(validateEmployeeField({ ...filled, ssfNumber: '' }, 'ssfNumber'), null);
    assert.equal(validateEmployeeField({ ...filled, ssfNumber: '2081-123/45' }, 'ssfNumber'), null);
    assert.match(validateEmployeeField({ ...filled, pfNumber: '=SUM(A1)' }, 'pfNumber') ?? '', /letters, digits/);
    assert.match(validateEmployeeField({ ...filled, citNumber: 'ab' }, 'citNumber') ?? '', /3–30/);
    assert.match(validateEmployeeField({ ...filled, dateOfBirth: '2015-01-01' }, 'dateOfBirth') ?? '', /18/);
    assert.equal(validateEmployeeField({ ...filled, spouseName: '' }, 'spouseName'), null);
    assert.match(validateEmployeeField({ ...filled, taxStatus: 'Married', spouseName: '' }, 'spouseName') ?? '', /Spouse/);
    assert.equal(validateEmployeeField(filled, 'gender'), null); // no rule
  });

  it('finds duplicate codes company-wide, case-insensitively, ignoring the record itself', () => {
    const codes = [{ id: 'x', employeeCode: 'EMP-010', attendanceCode: 'atd-010' }];
    assert.deepEqual(Object.keys(codeConflicts(codes, filled, null)).sort(), ['attendanceCode', 'employeeCode']);
    assert.deepEqual(codeConflicts(codes, filled, 'x'), {});
  });

  it('reports section progress for the section index', () => {
    const empty = sectionProgress(EMPTY_EMPLOYEE_FORM, {});
    assert.equal(empty.find((p) => p.id === 'general')?.state, 'todo');
    assert.equal(empty.find((p) => p.id === 'access')?.state, 'optional');
    // Defaults count as filled: gender and tax status (General), category (Job).
    assert.deepEqual(empty.filter((p) => p.filled > 0).map((p) => `${p.id}:${p.filled}/${p.required}`), ['general:2/6', 'job:1/6']);
    const done = sectionProgress(filled, {});
    assert.ok(done.filter((p) => p.id !== 'access' && p.id !== 'separation' && p.id !== 'dossier').every((p) => p.state === 'complete'), JSON.stringify(done));
    assert.equal(sectionProgress({ ...filled, taxStatus: 'Married' }, {}).find((p) => p.id === 'family')?.state, 'todo');
    assert.deepEqual(sectionProgress(filled, { panNumber: 'x', 'documents.0.number': 'y' }).find((p) => p.id === 'documents'), { id: 'documents', label: 'Identity documents', state: 'error', errors: 2, filled: 1, required: 1 });
    // The new-employee form starts with an empty Citizenship row: not filled until it has a number.
    assert.equal(sectionProgress(EMPTY_EMPLOYEE_FORM, {}).find((p) => p.id === 'documents')?.filled, 0);
  });

  it('labels every field the form lays out', () => {
    for (const section of EMPLOYEE_FORM_SECTIONS) for (const f of section.fields) assert.ok(EMPLOYEE_FIELD_LABELS[f], f);
  });

  it('keeps PII out of browser storage (standing measure 3, S18)', () => {
    const root = join(__dirname, '..');
    for (const file of readdirSync(join(root, 'components/employee'))) {
      const src = readFileSync(join(root, 'components/employee', file), 'utf8');
      assert.ok(!/sessionStorage/.test(src), file);
      assert.ok(!/localStorage\.setItem\((?!QUICK_VIEW_KEY)/.test(src), file);
    }
  });

  it('checks separation details for the status change', () => {
    const base = { ...EMPTY_EMPLOYEE_FORM, joiningDate: '2023-07-17' };
    const missing = separationErrors(base);
    assert.ok(missing.terminationDate && missing.terminationType && missing.terminationReason);
    assert.deepEqual(separationErrors({ ...base, terminationDate: '2026-10-03', terminationType: 'Resignation', terminationReason: 'Moving abroad' }), {});
    assert.ok(separationErrors({ ...base, terminationDate: '2020-01-01', terminationType: 'Resignation', terminationReason: 'x' }).terminationDate, 'before joining');
    assert.ok(separationErrors({ ...base, terminationDate: '2026-10-03', terminationType: 'Fired' as never, terminationReason: 'x' }).terminationType);
  });
});

describe('Address province (4.2 follow-up)', () => {
  const empty = { province: '', district: '', localLevel: '', wardNo: '', tole: '' };

  it('picking a district fills its province and clears the local level', () => {
    const a = changeAddress({ ...empty, localLevel: 'Old' }, { district: 'Kaski' });
    assert.equal(a.province, 'P4');
    assert.equal(a.localLevel, '');
  });

  it('a new province clears a district outside it, and keeps one inside it', () => {
    const inKaski = { ...empty, province: 'P4', district: 'Kaski', localLevel: 'Pokhara Metropolitan City' };
    assert.deepEqual(changeAddress(inKaski, { province: 'P3' }), { ...inKaski, province: 'P3', district: '', localLevel: '' });
    assert.equal(changeAddress(inKaski, { province: 'P4' }).district, 'Kaski');
  });

  it('older addresses holding a province name read as its id', () => {
    assert.equal(provinceIdOf('Bagmati Province'), 'P3');
    assert.equal(provinceIdOf('P3'), 'P3');
    assert.equal(provinceIdOf('Nowhere'), '');
  });

  it('ward numbers run 1 to 35', () => {
    assert.equal(isValidWard('1'), true);
    assert.equal(isValidWard('35'), true);
    assert.equal(isValidWard(''), true);
    assert.equal(isValidWard('0'), false);
    assert.equal(isValidWard('36'), false);
    const address = JSON.stringify({ province: 'P4', district: 'Kaski', localLevel: 'Pokhara Metropolitan City', wardNo: '36', tole: '' });
    assert.match(validateEmployeeField({ ...EMPTY_EMPLOYEE_FORM, permanentAddress: address }, 'permanentAddress') ?? '', /between 1 and 35/);
  });

  it('Mobile on the form refuses a landline', () => {
    assert.match(validateEmployeeField({ ...EMPTY_EMPLOYEE_FORM, mobileNo: '01-4412345' }, 'mobileNo') ?? '', /96, 97 or 98/);
    assert.equal(validateEmployeeField({ ...EMPTY_EMPLOYEE_FORM, mobileNo: '+9779841123456' }, 'mobileNo'), null);
    assert.equal(validateEmployeeField({ ...EMPTY_EMPLOYEE_FORM, mobileNo: '9841123456', phoneHome: '01-4412345' }, 'phoneHome'), null);
  });
});

describe('Grade: policy, by hand and Salary mapping permission (4.2 follow-up)', () => {
  const policy = (over: Partial<GradePolicySettings> = {}): GradePolicySettings => ({ ...DEFAULT_GRADE_POLICY, ...over });
  const pay = (over: Partial<EmployeePay> = {}): EmployeePay => ({ basicSalary: 30000, gradeCount: 3, gradeAmount: 0, gradeManual: false, ...over });

  it('breaks the grade down step by step for each policy method', () => {
    const daily = gradeBreakdown(30000, 3, policy());
    assert.equal(daily.rate, 1000);
    assert.equal(daily.amount, 3000);
    assert.equal(daily.formula, '30,000 ÷ 30 = 1,000 × 3 = 3,000');
    assert.equal(gradeBreakdown(30000, 2, policy({ calculationMethod: 'PERCENTAGE_OF_BASIC', fixedGradePercent: 5 })).formula, '30,000 × 5% = 1,500 × 2 = 3,000');
    assert.equal(gradeBreakdown(30000, 2, policy({ calculationMethod: 'FIXED_AMOUNT_PER_GRADE', fixedAmountPerGrade: 800 })).amount, 1600);
    assert.equal(gradeBreakdown(30000, 2, policy({ calculationMethod: 'MANUAL_INPUT' })).formula, '');
    assert.equal(gradeBreakdown(30000, 2, policy({ calculationMethod: 'DISABLED_NO_GRADES' })).amount, 0);
  });

  it('counts at most the policy cap', () => {
    const b = gradeBreakdown(30000, 12, policy({ maxGradesAllowedPerLevel: 10 }));
    assert.equal(b.counted, 10);
    assert.equal(b.capped, true);
    assert.equal(b.amount, 10000);
    assert.equal(gradeBreakdown(30000, 12, policy({ maxGradesAllowedPerLevel: 0 })).capped, false);
  });

  it('without Salary mapping → Edit, an employee keeps their stored pay whatever the browser sends', () => {
    const stored = pay({ gradeAmount: 3000 });
    const hostile = pay({ basicSalary: 999999, gradeCount: 50, gradeAmount: 500000, gradeManual: true });
    assert.deepEqual(resolvePay({ submitted: hostile, stored, policy: policy(), canEditPay: false }), stored);
  });

  it('without the permission, a new hire starts on the level starting salary with no grades', () => {
    const hostile = pay({ basicSalary: 999999, gradeCount: 50, gradeAmount: 500000, gradeManual: true });
    assert.deepEqual(resolvePay({ submitted: hostile, stored: null, policy: policy(), canEditPay: false, levelStartingSalary: 25000 }), {
      basicSalary: 25000,
      gradeCount: 0,
      gradeAmount: 0,
      gradeManual: false,
    });
  });

  it('with the permission, the grade amount follows the policy unless typed by hand', () => {
    assert.deepEqual(resolvePay({ submitted: pay({ gradeAmount: 777 }), stored: null, policy: policy(), canEditPay: true }), pay({ gradeAmount: 3000 }));
    assert.deepEqual(resolvePay({ submitted: pay({ gradeAmount: 777, gradeManual: true }), stored: null, policy: policy(), canEditPay: true }), pay({ gradeAmount: 777, gradeManual: true }));
    assert.equal(resolvePay({ submitted: pay({ gradeAmount: 1234 }), stored: null, policy: policy({ calculationMethod: 'MANUAL_INPUT' }), canEditPay: true }).gradeAmount, 1234);
    assert.equal(resolvePay({ submitted: pay({ gradeAmount: 1234, gradeManual: true }), stored: null, policy: policy({ calculationMethod: 'DISABLED_NO_GRADES' }), canEditPay: true }).gradeAmount, 0);
    assert.equal(resolvePay({ submitted: pay({ gradeAmount: -50, gradeManual: true, gradeCount: -2 }), stored: null, policy: policy(), canEditPay: true }).gradeAmount, 0);
  });

  it('a policy re-sync never overwrites grades typed by hand, and never zeroes under a "typed in" policy', () => {
    assert.equal(policySyncedGradeAmount({ basicSalary: 30000, gradeCount: 3, gradeManual: true }, policy()), null);
    assert.equal(policySyncedGradeAmount({ basicSalary: 30000, gradeCount: 3, gradeManual: false }, policy({ calculationMethod: 'MANUAL_INPUT' })), null);
    assert.equal(policySyncedGradeAmount({ basicSalary: 30000, gradeCount: 3, gradeManual: false }, policy({ calculationMethod: 'DISABLED_NO_GRADES' })), 0);
    assert.equal(policySyncedGradeAmount({ basicSalary: 30000, gradeCount: 3, gradeManual: false }, policy()), 3000);
  });

  it('the save works pay out on the server with the Salary mapping permission (S18)', () => {
    const actions = readFileSync(join(__dirname, '..', 'app/actions/employee.actions.ts'), 'utf8');
    assert.match(actions, /hasPermission\('EDIT', 'SALARY_MAPPING'\)[\s\S]*saveEmployee\(id, formData, \{\s*userId: scope\.userId,\s*access: accessOptions,\s*canEditPay,\s*detail: \{ scope, canApprove: canApproveDetails, reason: detail\?\.reason \}/);
    const service = readFileSync(join(__dirname, '..', 'lib/services/employee.service.ts'), 'utf8');
    assert.match(service, /const pay = resolvePay\(/);
  });

  it('supervisor fields read "Is supervisor" and "Reports to"', () => {
    assert.equal(EMPLOYEE_FIELD_LABELS.isSupervisor, 'Is supervisor');
    assert.equal(EMPLOYEE_FIELD_LABELS.supervisorId, 'Reports to');
  });
});
