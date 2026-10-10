import type { CertificateLine, CertificateTotals, CitSchedule, EtdsLine, FundSchedule, TdsRow, VoucherLine } from '@/lib/engines/statutory-returns.engine';
import type { RevenueCode } from '@/lib/constants/statutory-returns';

// Statutory deposit files and the annual tax certificate (4.8 / F9).

export interface PayPeriodOption {
  /** "YYYY-MM" (BS). */
  value: string;
  label: string;
  finalRuns: number;
  lockedRuns: number;
  openRuns: number;
}

export interface StatutoryMonthData {
  periods: PayPeriodOption[];
  /** The month shown; null when no run has been approved yet. */
  period: {
    value: string;
    year: number;
    month: number;
    label: string;
    fiscalYearLabel: string;
    /** BS due dates (SSF 15 days, TDS 25 days after the month ends). */
    due: { tds: string; ssf: string };
    finalRuns: number;
    lockedRuns: number;
    openRuns: number;
  } | null;
  /** The viewer's scope is not the whole company: the files hold only their employees. */
  partialScope: boolean;
  etds: {
    rows: TdsRow[];
    lines: EtdsLine[];
    vouchers: VoucherLine[];
    totals: { gross: string; sst: string; remuneration: string; tds: string };
    /** Payees with TDS but no PAN on the record. */
    withoutPan: number;
    /** Payees in the month's slips with no tax withheld. */
    nilPayees: number;
  };
  ssf: FundSchedule;
  pf: FundSchedule;
  cit: CitSchedule;
  permissions: { export: boolean };
}

export interface CertificateListRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  pan: string | null;
  months: number;
  gross: string;
  taxable: string;
  tds: string;
}

export interface CertificateListData {
  fiscalYears: { id: string; label: string }[];
  fiscalYearId: string | null;
  rows: CertificateListRow[];
  partialScope: boolean;
}

export interface TaxCertificateData {
  fiscalYearId: string;
  fiscalYearLabel: string;
  employee: { id: string; code: string; name: string; pan: string | null; taxStatus: string; ssf: boolean };
  lines: CertificateLine[];
  totals: CertificateTotals;
  /** Tax withheld under each revenue code over the year. */
  revenue: { code: RevenueCode; en: string; np: string; amount: string }[];
  /** Months still not final (draft / under review) are not on the certificate. */
  issuedOnBs: string;
  issuedOnAd: string;
}
