import * as repo from '@/lib/repositories/hr-analytics.repository';
import {
  headcountByAgeBand,
  headcountByBranch,
  headcountByCategory,
  headcountByDepartment,
  headcountByDesignation,
  staffReturn,
  summarize,
} from '@/lib/engines/hr-analytics.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { nepalToday, toIsoDate } from '@/lib/utils/nepal-time';
import { UserFacingError } from '@/lib/errors/action-error';
import type { HrAnalyticsData } from '@/lib/types/hr-analytics';

// HR analytics (G13): orchestration. Everything is read within the caller's
// employee scope (a branch manager sees their branch); case figures are counts
// only and appear only with DISCIPLINE VIEW; no pay figures anywhere.

export interface AnalyticsCtx {
  scope: ScopeFilter;
  canSeeCases: boolean;
  canExport: boolean;
}

export async function hrAnalytics(fiscalYearId: string | null, ctx: AnalyticsCtx): Promise<HrAnalyticsData> {
  const years = await repo.fiscalYearOptions();
  if (!years.length) throw new UserFacingError('Set up a fiscal year first.');
  const year = (fiscalYearId && years.find((y) => y.id === fiscalYearId)) || years[0];
  const scopeCondition = buildEmployeeScopeCondition(ctx.scope);
  const today = toIsoDate(nepalToday());
  // The period ends today when the year is still running (age / tenure are "as of today").
  const endAd = year.endAd < today ? year.endAd : today;

  const [staff, movement, training, leave, cases] = await Promise.all([
    repo.staffFacts(scopeCondition),
    repo.movement(year.startAd, endAd, scopeCondition),
    repo.trainingFacts(year.startAd, endAd, scopeCondition),
    repo.leaveFacts(year.startAd, endAd, scopeCondition),
    ctx.canSeeCases ? repo.caseFacts(year.startAd, endAd, scopeCondition) : Promise.resolve(null),
  ]);

  return {
    fiscalYears: years.map((y) => ({ id: y.id, label: y.label })),
    fiscalYearId: year.id,
    period: { startAd: year.startAd, endAd },
    summary: summarize(staff, movement, today),
    byBranch: headcountByBranch(staff),
    byDepartment: headcountByDepartment(staff),
    byDesignation: headcountByDesignation(staff),
    byCategory: headcountByCategory(staff),
    byAge: headcountByAgeBand(staff, today),
    leave,
    cases,
    staffReturn: staffReturn(staff, movement, training),
    permissions: { export: ctx.canExport },
  };
}
