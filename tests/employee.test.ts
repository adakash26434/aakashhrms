import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { registerCounts, toEmployeeListRow, type RegisterNames } from '../lib/engines/employee.engine';
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
