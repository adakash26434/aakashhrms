// Statutory deposit files (4.8 / F9): revenue codes and file layouts.
//
// Revenue codes as applied to salary withholding (IRD revenue heads): the 1%
// social security tax on the first slab and the remuneration tax on the rest
// are deposited under separate codes, and an eTDS return lists each employee
// once per code. SSF contributors do not pay the 1% (it is in the SSF 31%).
// Verify these each fiscal year with the IRD circulars; change them here only.

export const REVENUE_CODE = {
  /** सामाजिक सुरक्षा कर — the 1% on the first slab (never for SSF contributors). */
  socialSecurityTax: "11211",
  /** पारिश्रमिक कर — the rest of the tax withheld on salary. */
  remunerationTax: "11112",
} as const;

export type RevenueCode = (typeof REVENUE_CODE)[keyof typeof REVENUE_CODE];

export const REVENUE_CODE_LABEL: Record<RevenueCode, { en: string; np: string }> = {
  "11211": { en: "Social security tax", np: "सामाजिक सुरक्षा कर" },
  "11112": { en: "Remuneration tax", np: "पारिश्रमिक कर" },
};

/** Contribution rates on the contribution base, as the payroll engine deducts them (see ssfContribution). */
export const SSF_RATE = { employee: 0.11, employer: 0.2 } as const;
export const PF_RATE = { employee: 0.1, employer: 0.1 } as const;

/** The four monthly files. */
export const STATUTORY_FILES = ["etds", "ssf", "pf", "cit"] as const;
export type StatutoryFile = (typeof STATUTORY_FILES)[number];

export const STATUTORY_FILE_LABEL: Record<StatutoryFile, { en: string; np: string; authority: string }> = {
  etds: { en: "TDS (eTDS)", np: "पारिश्रमिक कर", authority: "Inland Revenue Department" },
  ssf: { en: "SSF contributions", np: "सामाजिक सुरक्षा कोष", authority: "Social Security Fund" },
  pf: { en: "Provident Fund", np: "कर्मचारी सञ्चय कोष", authority: "Employees Provident Fund" },
  cit: { en: "CIT", np: "नागरिक लगानी कोष", authority: "Citizen Investment Trust" },
};
