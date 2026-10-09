// Exit workflow (G5): shared types for the register and the case window.

export interface ExitListRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  kind: string;
  kindName: string;
  kindNameNp: string;
  noticeDate: string | null;
  lastWorkingDayAd: string;
  lastWorkingDayBs: string;
  reason: string | null;
  status: 'open' | 'closed' | 'cancelled';
  cleared: number;
  blocked: number;
  totalUnits: number;
  letterId: string | null;
  letterNumber: string | null;
  openedByName: string;
  cancelReason: string | null;
}

export interface ExitClearanceView {
  unit: string;
  unitName: string;
  unitNameNp: string;
  hint: string;
  status: 'pending' | 'cleared' | 'blocked';
  note: string | null;
  decidedByName: string | null;
}

export interface ExitDetail extends ExitListRow {
  clearances: ExitClearanceView[];
  blockers: string[];
  facts: {
    activeLoans: number;
    loanOutstanding: string;
    devicePins: { device: string; pin: string }[];
    /** Welfare-fund balances still held for the employee (non-zero only). */
    funds: { fund: string; employee: string; employer: string; total: string }[];
  };
}

export interface ExitPageData {
  cases: ExitListRow[];
  employees: { id: string; fullName: string; employeeCode: string; branch: string }[];
  permissions: { manage: boolean; issueLetter: boolean };
}
