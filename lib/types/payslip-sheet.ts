import type { Bilingual } from '@/lib/constants/payslip-labels';
import type { PayslipStatement } from '@/lib/engines/payslip-view.engine';

// Bilingual payslip (4.8 / F11): what one printed payslip shows.

export interface PayslipSheetData {
  slipId: string;
  header: {
    company: { name: string; address: string; pan: string };
    employee: { name: string; code: string; department: string; designation: string; pan: string | null };
    bank: { name: string; account: string };
    period: Bilingual;
    /** Off-cycle runs (F6) say what they pay. */
    runType: Bilingual | null;
    paidOn: { bs: string; ad: string } | null;
  };
  statement: PayslipStatement;
}
