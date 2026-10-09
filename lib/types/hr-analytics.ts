import type { CountRow, ReturnRow, Summary } from '@/lib/engines/hr-analytics.engine';

// HR analytics (G13): the page's data, headcount facts only — no pay figures.

export interface HrAnalyticsData {
  fiscalYears: { id: string; label: string }[];
  fiscalYearId: string;
  period: { startAd: string; endAd: string };
  summary: Summary;
  byBranch: CountRow[];
  byDepartment: CountRow[];
  byDesignation: CountRow[];
  byCategory: CountRow[];
  byAge: CountRow[];
  leave: { applications: number; approved: number; days: number };
  cases: { disciplinary: number; grievance: number; open: number } | null; // null without DISCIPLINE VIEW
  staffReturn: ReturnRow[];
  permissions: { export: boolean };
}
