// Old links into Company setup (?section=…&tab=…) for what has its own page now: organization
// units (4.3, Workforce → Organization) and the payroll settings (4.12, Setup). Bookmarks and
// links in old e-mails still land on the right page.

const ORGANIZATION_TAB: Readonly<Record<string, string>> = {
  organization: "structure",
  branches: "branches",
  departments: "departments",
  designations: "designations",
  shreni: "levels",
  employment_types: "types",
};

const SETUP_PAGE: Readonly<Record<string, string>> = {
  fiscal_year: "/setup/fiscal-year",
  fiscalyear: "/setup/fiscal-year",
  fy: "/setup/fiscal-year",
  tax_rates: "/setup/tax-rates",
  taxrates: "/setup/tax-rates",
  tax: "/setup/tax-rates",
  pay_heads: "/setup/pay-heads",
  payheads: "/setup/pay-heads",
  system_control: "/setup/system-control",
  systemcontrol: "/setup/system-control",
  rules_defaults: "/setup/system-control",
  rules: "/setup/system-control",
  defaults: "/setup/system-control",
  holidays: "/setup/holidays",
};

const key = (v: string | null | undefined) => (v ?? "").trim().toLowerCase().replace(/[- ]/g, "_");

/** Where an old Company setup link goes now (null: it stays on Company setup). */
export function setupLegacyRoute(section?: string | null, tab?: string | null): string | null {
  for (const k of [key(section), key(tab)]) {
    if (ORGANIZATION_TAB[k]) return `/workforce/organization?tab=${ORGANIZATION_TAB[k]}`;
    if (SETUP_PAGE[k]) return SETUP_PAGE[k];
  }
  // The old "Payroll rules" section opened on fiscal years.
  if (key(section) === "payroll_rules" || key(section) === "payroll") return "/setup/fiscal-year";
  return null;
}
