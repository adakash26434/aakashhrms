import type { SettlementLine, SettlementPolicy, SettlementStatus } from '@/lib/engines/settlement.engine';
import type { TaxSheet } from '@/lib/engines/tax-projection.engine';

// Full & final settlement (4.8 / F8): the statement as the exit window shows and prints it.

export interface SettlementView {
  id: string;
  status: SettlementStatus;
  lines: SettlementLine[];
  earnings: string;
  deductions: string;
  net: string;
  recovery: boolean;
  taxSheet: TaxSheet | null;
  preparedByName: string;
  preparedAt: string;
  approvedByName: string | null;
  approvedAt: string | null;
  paidByName: string | null;
  paidAt: string | null;
  paymentRef: string | null;
}

export interface SettlementData {
  settlement: SettlementView | null;
  policy: SettlementPolicy;
  /** Welfare-fund balances: paid under Funds, not part of this statement. */
  funds: { fund: string; employee: string; employer: string; total: string }[];
  permissions: { prepare: boolean; approve: boolean; pay: boolean; policy: boolean };
}
