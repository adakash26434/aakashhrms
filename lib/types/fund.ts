// Welfare funds (G9): shared types for the funds screen.

export interface FundTypeView {
  id: string;
  code: string;
  name: string;
  nameNp: string;
  contributionMode: 'fixed' | 'percent_basic';
  employeeValue: number;
  employerValue: number;
  note: string | null;
  isActive: boolean;
  members: number;
  employeeSum: string;
  employerSum: string;
  total: string;
}

export interface FundBalanceRow {
  fundTypeId: string;
  fundName: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branch: string;
  employeeShare: string;
  employerShare: string;
  total: string;
}

export interface FundLineView {
  id: string;
  kind: string;
  employeeAmount: string;
  employerAmount: string;
  ref: string;
  note: string | null;
  postedAt: string; // ISO
}

export interface FundsPageData {
  funds: FundTypeView[];
  balances: FundBalanceRow[];
  employees: { id: string; fullName: string; employeeCode: string; branch: string }[];
  permissions: { post: boolean; manageTypes: boolean };
}
