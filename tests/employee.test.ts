import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { attendanceMonth, historySummary, registerCounts, resolveRecordTab, tenureLabel, toEmployeeListRow, type RegisterNames } from '../lib/engines/employee.engine';
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
