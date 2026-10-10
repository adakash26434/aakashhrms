// Payslip wording (4.8 / F11), English and Nepali. The payslip sheet prints either language or
// both; custom pay heads use the head's own Nepali name (Setup → Pay heads) when it has one.

export type PayslipLanguage = "en" | "np" | "both";
export const PAYSLIP_LANGUAGES: readonly PayslipLanguage[] = ["en", "np", "both"];
export const asPayslipLanguage = (v: unknown): PayslipLanguage => (PAYSLIP_LANGUAGES.includes(v as PayslipLanguage) ? (v as PayslipLanguage) : "both");

export interface Bilingual {
  en: string;
  np: string;
}

export const PAYSLIP_TEXT = {
  title: { en: "Payslip", np: "तलब भुक्तानी विवरण" },
  confidential: { en: "Confidential", np: "गोप्य" },
  period: { en: "Pay period", np: "तलब अवधि" },
  paidOn: { en: "Paid on", np: "भुक्तानी मिति" },
  employee: { en: "Employee", np: "कर्मचारी" },
  code: { en: "Employee code", np: "कर्मचारी कोड" },
  department: { en: "Department", np: "विभाग" },
  designation: { en: "Designation", np: "पद" },
  pan: { en: "PAN", np: "स्थायी लेखा नम्बर" },
  bank: { en: "Bank", np: "बैंक" },
  account: { en: "Account", np: "खाता नम्बर" },
  earnings: { en: "Earnings", np: "आम्दानी" },
  deductions: { en: "Deductions", np: "कट्टी" },
  gross: { en: "Gross earnings", np: "कुल आम्दानी" },
  totalDeductions: { en: "Total deductions", np: "कुल कट्टी" },
  net: { en: "Net pay", np: "खुद भुक्तानी" },
  basic: { en: "Basic salary", np: "आधारभूत तलब" },
  grade: { en: "Grade", np: "ग्रेड" },
  overtime: { en: "Overtime", np: "अतिरिक्त समय (ओभरटाइम)" },
  absence: { en: "Less: unpaid absence", np: "घटाउने: बेतलबी अनुपस्थिति" },
  loan: { en: "Loan installment", np: "ऋण किस्ता" },
  tds: { en: "Income tax (TDS)", np: "आयकर (स्रोतमा कट्टी)" },
  ssf: { en: "Social Security Fund", np: "सामाजिक सुरक्षा कोष" },
  ssfNote: { en: "11% yours + 20% employer's", np: "११% तपाईंको + २०% रोजगारदाताको" },
  ssfEmployer: { en: "SSF employer contribution (20%)", np: "सामाजिक सुरक्षा कोष (रोजगारदाता २०%)" },
  pf: { en: "Provident Fund", np: "कर्मचारी सञ्चय कोष" },
  cit: { en: "Citizen Investment Trust", np: "नागरिक लगानी कोष" },
  employerPf: { en: "Employer's PF contribution (not in gross)", np: "सञ्चय कोषमा रोजगारदाताको योगदान (कुल आम्दानीमा छैन)" },
  adjusted: { en: "adjusted", np: "समायोजित" },
  preparedBy: { en: "Prepared by", np: "तयार गर्ने" },
  approvedBy: { en: "Authorised signatory", np: "स्वीकृत गर्ने" },
  figuresNote: { en: "The lines do not add up to the stored totals; the totals are as paid.", np: "विवरणको जोड र भुक्तानी भएको जम्मा फरक छ; जम्मा रकम भुक्तानी भए अनुसार हो।" },
} as const satisfies Record<string, Bilingual>;
