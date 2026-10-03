import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { attendanceMonth, codeConflicts, separationErrors, historySummary, registerCounts, resolveRecordTab, sectionProgress, tenureLabel, toEmployeeListRow, validateEmployeeField, type RegisterNames } from '../lib/engines/employee.engine';
import { EMPTY_EMPLOYEE_FORM } from '../lib/services/employee.service';
import { EMPLOYEE_FORM_SECTIONS, EMPLOYEE_FIELD_LABELS } from '../lib/constants/employee-form';
import type { EmployeeFormData } from '../lib/types/employee';
import type { Employee } from '../lib/types/employee';

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
  it('opens only tabs the user may see, falling back to Profile', () => {
    assert.equal(resolveRecordTab('payslips', ['profile', 'payslips']), 'payslips');
    assert.equal(resolveRecordTab('payslips', ['profile', 'leave']), 'profile');
    assert.equal(resolveRecordTab(['leave'], ['profile', 'leave']), 'profile');
    assert.equal(resolveRecordTab(undefined, ['profile']), 'profile');
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
    citizenshipNo: '27-01-75-12345', issuingDistrict: 'Kaski', companyEmail: 'sita@example.test', mobileNo: '+9779841123456',
    permanentAddress: JSON.stringify({ province: 'P4', district: 'Kaski', localLevel: 'Pokhara Metropolitan City', wardNo: '4', tole: '' }),
    fatherName: 'A', motherName: 'B', grandfatherName: 'C', bankName: 'Nabil Bank Limited', bankBranch: 'Lakeside', bankAccountNumber: '001122',
  };

  it('checks one field with the same rules the server uses', () => {
    assert.equal(validateEmployeeField(filled, 'fullName'), null);
    assert.equal(validateEmployeeField({ ...filled, fullName: ' ' }, 'fullName'), 'Full name is required');
    assert.match(validateEmployeeField({ ...filled, panNumber: '12345' }, 'panNumber') ?? '', /9 digits/);
    assert.equal(validateEmployeeField({ ...filled, panNumber: '' }, 'panNumber'), null);
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
    const done = sectionProgress(filled, {});
    assert.ok(done.filter((p) => p.id !== 'access' && p.id !== 'separation').every((p) => p.state === 'complete'), JSON.stringify(done));
    assert.equal(sectionProgress({ ...filled, taxStatus: 'Married' }, {}).find((p) => p.id === 'family')?.state, 'todo');
    assert.deepEqual(sectionProgress(filled, { panNumber: 'x', citizenshipNo: 'y' }).find((p) => p.id === 'documents'), { id: 'documents', label: 'Identity documents', state: 'error', errors: 2 });
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

