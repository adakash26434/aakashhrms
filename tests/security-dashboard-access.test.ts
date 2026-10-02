import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redactDashboardForAccess, type DashboardAccess } from '../lib/services/dashboard-access';
import type { DashboardData } from '../lib/types/dashboard';

function snapshot(): DashboardData {
  return {
    hero: { greeting: 'Hi', summary: 's', payrollLockNote: 'Ashwin locked' },
    metrics: [
      { id: 'employees', label: 'Employees', value: '248', subtext: '', badge: '', badgeVariant: 'info', icon: 'users' },
      { id: 'liability', label: 'Liability', value: 'Rs 45,20,000', subtext: '', badge: '', badgeVariant: 'info', icon: 'wallet' },
      { id: 'leave', label: 'Leave', value: '6', subtext: '', badge: '', badgeVariant: 'info', icon: 'calendar' },
      { id: 'loans', label: 'Loans', value: 'Rs 9,00,000', subtext: '', badge: '', badgeVariant: 'info', icon: 'credit-card' },
    ],
    pendingApprovals: {
      value: 3,
      subtext: '3 waiting',
      badge: 'New',
      items: [
        { id: 'a', name: 'Sita', initials: 'S', type: 'Leave', durationOrAmount: '2d', dateTag: '', hasPayrollImpact: false, category: 'leave' },
        { id: 'b', name: 'Ram', initials: 'R', type: 'Loan', durationOrAmount: 'Rs 50,000', dateTag: '', hasPayrollImpact: true, category: 'loans' },
      ],
    },
    currentRun: {
      id: 'r1', period: 'Ashwin 2082', dateRange: '', statusLabel: 'Locked', statusVariant: 'success', awaitingLabel: '',
      employeesIncluded: 240, employeesExcluded: 8, exceptions: 2,
      grossPayroll: 5000000, totalDeductions: 480000, netPayable: 4520000,
      deductions: [{ label: 'SSF', amount: 100000, color: '#000' }], workflowSteps: [],
    },
    validationExceptions: [{ id: 'x', employeeName: 'Hari', employeeId: 'E1', department: 'Ops', exception: 'No bank', severity: 'critical' }],
    trend: [{ month: 'Shrawan', gross: 1, net: 1, tds: 1 }],
    headcount: [{ name: 'Finance', count: 12, color: '#000' }],
    attendance: [],
    complianceScore: 90,
    compliance: [],
    activity: [{ id: '1', actor: 'Admin', role: 'Admin', description: 'Changed salary', timestamp: 'now', category: 'payroll', icon: 'wallet' }],
    upcoming: [],
  };
}

const NONE: DashboardAccess = { payroll: false, approvals: false, loans: false, audit: false };
const ALL: DashboardAccess = { payroll: true, approvals: true, loans: true, audit: true };

describe('Dashboard redaction (S3)', () => {
  it('passes everything through for full access', () => {
    const data = snapshot();
    assert.deepEqual(redactDashboardForAccess(data, ALL).currentRun, data.currentRun);
    assert.equal(redactDashboardForAccess(data, ALL).pendingApprovals.items?.length, 2);
  });

  it('removes payroll money, trend and exceptions without payroll access', () => {
    const out = redactDashboardForAccess(snapshot(), NONE);
    assert.equal(out.currentRun.grossPayroll, 0);
    assert.equal(out.currentRun.netPayable, 0);
    assert.deepEqual(out.currentRun.deductions, []);
    assert.deepEqual(out.trend, []);
    assert.deepEqual(out.validationExceptions, []);
    assert.equal(out.metrics.find((m) => m.id === 'liability')?.value, '—');
  });

  it('removes approval items and loan figures without access', () => {
    const out = redactDashboardForAccess(snapshot(), NONE);
    assert.deepEqual(out.pendingApprovals.items, []);
    assert.equal(out.pendingApprovals.value, 0);
    assert.equal(out.metrics.find((m) => m.id === 'loans')?.value, '—');
  });

  it('keeps leave approvals but hides loan requests from a leave-only approver', () => {
    const out = redactDashboardForAccess(snapshot(), { ...NONE, approvals: true });
    assert.deepEqual(out.pendingApprovals.items?.map((i) => i.category), ['leave']);
  });

  it('removes the audit trail without audit access', () => {
    assert.deepEqual(redactDashboardForAccess(snapshot(), NONE).activity, []);
  });

  it('does not mutate the input snapshot', () => {
    const data = snapshot();
    redactDashboardForAccess(data, NONE);
    assert.equal(data.currentRun.grossPayroll, 5000000);
  });
});
