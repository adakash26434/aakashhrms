// Disciplinary & grievance (G8): shared types for the register and the case window.

export interface CaseListRow {
  id: string;
  category: 'disciplinary' | 'grievance';
  categoryName: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  severity: 'minor' | 'major' | 'serious';
  title: string;
  status: 'open' | 'investigating' | 'decided' | 'closed';
  outcome: string | null;
  outcomeName: string | null;
  openedAt: string;
  openedByName: string;
}

export interface CaseEventView {
  id: string;
  kind: string;
  text: string;
  actorName: string;
  at: string;
}

export interface CaseDetail extends CaseListRow {
  description: string;
  outcomeNote: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  events: CaseEventView[];
  /** Statuses the case may move to next (empty when closed). */
  next: string[];
}

export interface CasePageData {
  cases: CaseListRow[];
  employees: { id: string; fullName: string; employeeCode: string; branch: string }[];
  permissions: { open: boolean; manage: boolean; decide: boolean };
}
