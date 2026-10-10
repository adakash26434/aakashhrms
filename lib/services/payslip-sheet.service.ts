import type { SQL } from 'drizzle-orm';
import * as repo from '@/lib/repositories/payslip-sheet.repository';
import { getCompanyProfileSetup } from '@/lib/repositories/company-setup.repository';
import { addressLine } from '@/lib/constants/nepal-locations';
import { headRole, payslipStatement, type HeadFigures } from '@/lib/engines/payslip-view.engine';
import { isSsfDeductionHead, isSsfEmployerHead } from '@/lib/engines/payroll.engine';
import { maskAccountNumber } from '@/lib/engines/report.engine';
import { asRunType, isOffCycle, RUN_TYPE_LABEL } from '@/lib/constants/run-types';
import { adToBSString, BS_MONTHS_EN, BS_MONTHS_NP } from '@/lib/utils/bs-calendar';
import { toNepaliNumerals } from '@/lib/utils/date-input-formatter';

/** Gregorian month names in Nepali, for payslips of a company paying in AD months (4.8b). */
const AD_MONTHS_NP = ['', 'जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन', 'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर'];
const AD_MONTHS_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The pay month in the run's own calendar, in both languages. */
function periodText(run: { calendar: string; payPeriodYear: number; payPeriodMonth: number }) {
  const ad = run.calendar === 'AD';
  const en = (ad ? AD_MONTHS_EN : BS_MONTHS_EN)[run.payPeriodMonth] ?? String(run.payPeriodMonth);
  const np = (ad ? AD_MONTHS_NP : BS_MONTHS_NP)[run.payPeriodMonth] ?? String(run.payPeriodMonth);
  return { en: `${en} ${run.payPeriodYear}`, np: `${np} ${toNepaliNumerals(run.payPeriodYear)}` };
}
import type { PayrollSlip, PayrollSlipHead } from '@/lib/types/payroll';
import type { PayslipSheetData } from '@/lib/types/payslip-sheet';

export type { PayslipSheetData };

// Bilingual payslip (4.8 / F11): the printable payslip for the office (Reports → Payslips, locked
// runs, the viewer's employee scope) and for the employee (self-service, released payslips only —
// the caller passes the portal's visibility rule). The statement comes from payslip-view.engine.

export interface SheetItem {
  slip: PayrollSlip;
  heads: PayrollSlipHead[];
  sheet: PayslipSheetData;
}

async function company() {
  const profile = await getCompanyProfileSetup().catch(() => null);
  return { name: profile?.displayName || profile?.legalName || '', address: addressLine(profile?.headOfficeAddress) ?? '', pan: profile?.panVatNumber ?? '' };
}

/**
 * A payslip's head lines as the statement reads them, each with its statutory role. The salary
 * sheet (Reports, 4.11) uses this too, so a sheet row and the payslip always agree.
 */
export function headFigures(lines: readonly repo.SheetHeadRow[]): HeadFigures[] {
  return lines.map(({ head, master }) => {
    // The same heuristics the payroll engine uses to recognise SSF heads (code / name conventions).
    const probe = master ? { code: master.code, name: master.name, type: master.type, isSsfHead: master.isSsfHead, isSsfEmployerHead: master.isSsfEmployerHead } : null;
    return {
      payHeadId: head.payHeadId,
      payHeadName: head.payHeadName,
      nameNp: master?.nameNp ?? null,
      headType: head.headType,
      amount: head.amount,
      calculatedAmount: head.calculatedAmount,
      isManualOverride: head.isManualOverride,
      role: headRole(
        master && {
          isTdsHead: master.isTdsHead,
          isPfHead: master.isPfHead,
          isCitHead: master.isCitHead,
          isSsfEmployerHead: !!probe && isSsfEmployerHead(probe),
          isSsfHead: !!probe && isSsfDeductionHead(probe),
        },
      ),
    };
  });
}

function toItems(slips: repo.SheetSlipRow[], heads: repo.SheetHeadRow[], firm: PayslipSheetData['header']['company']): SheetItem[] {
  const bySlip = new Map<string, repo.SheetHeadRow[]>();
  for (const h of heads) bySlip.set(h.head.payrollSlipId, [...(bySlip.get(h.head.payrollSlipId) ?? []), h]);
  return slips.map(({ slip, run, pan }) => {
    const lines = bySlip.get(slip.id) ?? [];
    const figures = headFigures(lines);
    const type = asRunType(run.runType);
    const paidAd = slip.payslipDate && /^\d{4}-\d{2}-\d{2}$/.test(slip.payslipDate) ? slip.payslipDate : null;
    return {
      slip: slip as unknown as PayrollSlip,
      heads: lines.map((l) => l.head as PayrollSlipHead),
      sheet: {
        slipId: slip.id,
        header: {
          company: firm,
          employee: { name: slip.employeeName, code: slip.employeeCode, department: slip.departmentName, designation: slip.designationName, pan: pan?.trim() || null },
          bank: { name: slip.bankName, account: maskAccountNumber(slip.bankAccountNumber) },
          period: periodText(run),
          runType: isOffCycle(type) ? { en: RUN_TYPE_LABEL[type].en, np: RUN_TYPE_LABEL[type].np } : null,
          paidOn: paidAd ? { ad: paidAd, bs: adToBSString(new Date(`${paidAd}T00:00:00`)) } : null,
        },
        statement: payslipStatement(slip, figures),
      },
    };
  });
}

/** The payslips of one locked run within the viewer's scope (optionally one employee's, or a branch's / department's). */
export async function sheetsForRun(runId: string, opts: { scope?: SQL; employeeId?: string; extra?: SQL[] }): Promise<{ status: string | null; items: SheetItem[] }> {
  const slips = await repo.sheetSlips({ runId, employeeId: opts.employeeId, scope: opts.scope, extra: opts.extra });
  if (!slips.length) return { status: null, items: [] };
  const status = slips[0].run.status;
  // Payslips are handed out from locked runs only (the figures can still change before).
  if (status !== 'LOCKED') return { status, items: [] };
  const [heads, firm] = await Promise.all([repo.sheetHeads(slips.map((s) => s.slip.id)), company()]);
  return { status, items: toItems(slips, heads, firm) };
}

/** The employee's own payslip; `visibleSlip` is the portal's rule (locked, published, not held). */
export async function ownSheet(employeeId: string, slipId: string, visibleSlip: SQL[]): Promise<PayslipSheetData | null> {
  const slips = await repo.sheetSlips({ slipId, employeeId, extra: visibleSlip });
  if (!slips.length) return null;
  const [heads, firm] = await Promise.all([repo.sheetHeads([slipId]), company()]);
  return toItems(slips, heads, firm)[0]?.sheet ?? null;
}
