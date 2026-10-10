import Decimal from "decimal.js";
import { PAYSLIP_TEXT, type Bilingual } from "@/lib/constants/payslip-labels";

// Payslip statement (4.8 / F11): turns a stored payslip and its head lines into the two columns a
// payslip prints, in the order people read them, with bilingual labels. Pure. The figures are the
// stored ones; the statement only arranges them so the columns add up to the stored totals:
//   earnings   = basic + grade + allowance lines (SSF employer 20% among them) + OT − unpaid absence = gross
//   deductions = SSF (31%) + PF + CIT + other deduction lines + loan + TDS                          = total
//   net        = gross − deductions

export type HeadRole = "tds" | "pf" | "ssf" | "ssfEmployer" | "cit" | null;

export interface SlipFigures {
  basicSalary: Decimal.Value;
  gradeAmount: Decimal.Value;
  otAmount: Decimal.Value;
  absentDeduction: Decimal.Value;
  loanDeduction: Decimal.Value;
  grossEarnings: Decimal.Value;
  totalDeductions: Decimal.Value;
  netPayable: Decimal.Value;
  pfEmployer: Decimal.Value;
}

export interface HeadFigures {
  payHeadId: string;
  payHeadName: string;
  /** The head's Nepali name (Setup → Pay heads), when it has one. */
  nameNp?: string | null;
  headType: string;
  amount: Decimal.Value;
  calculatedAmount: Decimal.Value;
  isManualOverride: boolean;
  role: HeadRole;
}

export interface PayslipLine {
  key: string;
  label: Bilingual;
  amount: string;
  note?: Bilingual;
  adjusted?: boolean;
}

export interface PayslipStatement {
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  gross: string;
  totalDeductions: string;
  net: string;
  /** Employer's PF contribution: deposited for the employee but not part of the gross. */
  employerPf: string | null;
  /** The columns add up to the stored totals (to the paisa). */
  balanced: boolean;
}

const dec = (v: Decimal.Value | null | undefined) => {
  try {
    return new Decimal(v || 0);
  } catch {
    return new Decimal(0);
  }
};
const money = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

/** What a statutory head is, from its pay-head flags. */
export function headRole(flags: { isTdsHead?: boolean; isPfHead?: boolean; isSsfHead?: boolean; isSsfEmployerHead?: boolean; isCitHead?: boolean } | null | undefined): HeadRole {
  if (!flags) return null;
  if (flags.isTdsHead) return "tds";
  if (flags.isSsfEmployerHead) return "ssfEmployer";
  if (flags.isSsfHead) return "ssf";
  if (flags.isPfHead) return "pf";
  if (flags.isCitHead) return "cit";
  return null;
}

/** The amount a head line was paid at: a typed override wins over the calculation. */
export const lineAmount = (h: Pick<HeadFigures, "amount" | "calculatedAmount" | "isManualOverride">): Decimal =>
  h.isManualOverride ? dec(h.amount) : dec(h.calculatedAmount).isZero() ? dec(h.amount) : dec(h.calculatedAmount);

const ROLE_LABEL: Record<Exclude<HeadRole, null>, Bilingual> = {
  tds: PAYSLIP_TEXT.tds,
  pf: PAYSLIP_TEXT.pf,
  ssf: PAYSLIP_TEXT.ssf,
  ssfEmployer: PAYSLIP_TEXT.ssfEmployer,
  cit: PAYSLIP_TEXT.cit,
};

const DEDUCTION_ORDER: Record<string, number> = { ssf: 0, pf: 1, cit: 2, other: 3, loan: 4, tds: 5 };

export function payslipStatement(slip: SlipFigures, heads: readonly HeadFigures[]): PayslipStatement {
  const earnings: PayslipLine[] = [];
  const deductions: (PayslipLine & { order: number })[] = [];
  const push = (list: PayslipLine[], line: PayslipLine) => {
    if (!dec(line.amount).isZero()) list.push(line);
  };

  push(earnings, { key: "basic", label: PAYSLIP_TEXT.basic, amount: money(dec(slip.basicSalary)) });
  push(earnings, { key: "grade", label: PAYSLIP_TEXT.grade, amount: money(dec(slip.gradeAmount)) });

  const allowances = heads.filter((h) => h.headType === "allowance");
  // The SSF employer contribution reads best after the agreed allowances.
  for (const h of [...allowances.filter((x) => x.role !== "ssfEmployer"), ...allowances.filter((x) => x.role === "ssfEmployer")]) {
    const label = h.role ? ROLE_LABEL[h.role] : { en: h.payHeadName, np: h.nameNp?.trim() || h.payHeadName };
    push(earnings, { key: `head:${h.payHeadId}`, label, amount: money(lineAmount(h)), adjusted: h.isManualOverride || undefined });
  }
  push(earnings, { key: "ot", label: PAYSLIP_TEXT.overtime, amount: money(dec(slip.otAmount)) });
  push(earnings, { key: "absence", label: PAYSLIP_TEXT.absence, amount: money(dec(slip.absentDeduction).negated()) });

  for (const h of heads.filter((x) => x.headType === "deduction")) {
    const label = h.role ? ROLE_LABEL[h.role] : { en: h.payHeadName, np: h.nameNp?.trim() || h.payHeadName };
    const amount = money(lineAmount(h));
    if (dec(amount).isZero()) continue;
    deductions.push({ key: `head:${h.payHeadId}`, label, amount, note: h.role === "ssf" ? PAYSLIP_TEXT.ssfNote : undefined, adjusted: h.isManualOverride || undefined, order: DEDUCTION_ORDER[h.role ?? "other"] ?? 3 });
  }
  if (!dec(slip.loanDeduction).isZero()) deductions.push({ key: "loan", label: PAYSLIP_TEXT.loan, amount: money(dec(slip.loanDeduction)), order: DEDUCTION_ORDER.loan });
  deductions.sort((a, b) => a.order - b.order);

  const gross = dec(slip.grossEarnings);
  const total = dec(slip.totalDeductions);
  const net = dec(slip.netPayable);
  const sum = (lines: readonly PayslipLine[]) => lines.reduce((s, l) => s.plus(l.amount), new Decimal(0));
  const close = (a: Decimal, b: Decimal) => a.minus(b).abs().lte(0.01);
  const employerPf = dec(slip.pfEmployer);

  return {
    earnings,
    deductions: deductions.map((d) => ({ key: d.key, label: d.label, amount: d.amount, note: d.note, adjusted: d.adjusted })),
    gross: money(gross),
    totalDeductions: money(total),
    net: money(net),
    employerPf: employerPf.gt(0) ? money(employerPf) : null,
    balanced: close(sum(earnings), gross) && close(sum(deductions), total) && close(gross.minus(total), net),
  };
}
