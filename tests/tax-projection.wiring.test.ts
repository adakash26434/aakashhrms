import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// F5 wiring: every place that calculates a payslip gives the engine the earlier months of the
// fiscal year (approved / locked only, never the run being recalculated) and keeps the sheet.

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const service = read('lib/services/payroll.service.ts');
const repo = read('lib/repositories/payroll.repository.ts');

describe('tax projection wiring', () => {
  it('the history is approved / locked slips of earlier fiscal months, never the run itself', () => {
    const fn = repo.slice(repo.indexOf('export async function findEarlierTaxMonths'));
    assert.match(fn, /inArray\(payrollRuns\.status, \['APPROVED', 'LOCKED'\]\)/);
    assert.match(fn, /< \$\{fiscalMonthIndex\}/);
    assert.match(fn, /\$\{payrollRuns\.id\} <> \$\{excludeRunId\}/);
    assert.match(fn, /inArray\(payrollSlips\.employeeId, employeeIds\)/);
  });

  it('all three calculation sites pass the month index and history; the year-end month keeps reconciling', () => {
    // Merged with the pay calendar (2026-10-10): the index is counted in the run's calendar (BS or AD).
    assert.equal((service.match(/fiscalMonthIndex: fiscalMonthIdx,/g) ?? []).length, 2);
    assert.equal((service.match(/const fiscalMonthIdx = fiscalMonthIndexFor\(runCalendar, run\.payPeriodMonth\);/g) ?? []).length, 2);
    assert.match(service, /const fiscalMonthIndex = fiscalMonthIndexFor\(calendar, payPeriodMonth\);/);
    assert.match(service, /fiscalMonthIndex,\n\s+projectionHistory: earlierTaxMonths\.get\(emp\.id\)/);
    assert.equal((service.match(/isYearEnd \? \[\]/g) ?? []).length, 2);
    assert.match(service, /isYearEndMonth \? new Map/);
  });

  it('the sheet is stored on every slip write', () => {
    assert.equal((service.match(/taxSheet: calcResult\.taxSheet \?\? null/g) ?? []).length, 3);
  });
});
