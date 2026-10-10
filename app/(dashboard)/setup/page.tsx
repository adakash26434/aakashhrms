export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, Building2, CalendarDays, CalendarRange, ChevronRight, Clock, Coins, Network, Percent, ScrollText, Shield, ShieldCheck, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { ensureTenantContext } from "@/lib/db";
import { hasPermission, requireAuthenticatedUser } from "@/lib/auth/check-permission";
import { setupFacts, type SetupEntryId } from "@/lib/services/setup-overview.service";
import { PageBar } from "@/components/frame/page-bar";
import { Panel } from "@/components/kit/panel";
import { EmptyState } from "@/components/kit/empty-state";

export const metadata: Metadata = {
  title: "Setup | AakashHRMS",
  description: "Company details, payroll settings and the calendar, with what each still needs.",
};

type Module = Parameters<typeof hasPermission>[1];

interface Entry {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** View on any of these opens it. */
  modules: Module[];
  fact?: SetupEntryId;
}

// The settings this person can open (View on each one's module); the pages check again.
const GROUPS: { title: string; entries: Entry[] }[] = [
  {
    title: "Company",
    entries: [
      { title: "Company setup", description: "The legal registration, contacts, the signatories on letters and reports, the work schedule.", href: "/setup/company-setup", icon: Building2, modules: ["ORG_STRUCTURE"], fact: "company" },
      { title: "Organization", description: "Branches, departments, designations, levels and employment types.", href: "/workforce/organization", icon: Network, modules: ["ORG_STRUCTURE"], fact: "organization" },
    ],
  },
  {
    title: "Payroll",
    entries: [
      { title: "Pay heads", description: "Allowances and deductions: what each is, its amount and who it is for.", href: "/setup/pay-heads", icon: Coins, modules: ["PAY_HEADS"], fact: "payHeads" },
      { title: "Rules & controls", description: "Tax deduction limits, SSF, overtime and the grade policy.", href: "/setup/system-control", icon: SlidersHorizontal, modules: ["SYSTEM_CONTROL"], fact: "rules" },
      { title: "Fiscal years", description: "Shrawan to Asar: the current year, closing and reopening.", href: "/setup/fiscal-year", icon: CalendarRange, modules: ["FISCAL_YEAR"], fact: "fiscalYears" },
      { title: "Tax slabs", description: "Income tax bands for each fiscal year.", href: "/setup/tax-rates", icon: Percent, modules: ["TAX_RATES"], fact: "taxSlabs" },
      { title: "Approvals", description: "Who approves salary changes and loans, with custom rules for salary changes.", href: "/setup/approvals", icon: ShieldCheck, modules: ["SALARY_MAPPING", "LOANS"] },
      { title: "Payroll controls", description: "Maker-checker for pay runs, the variance threshold and the attendance rule.", href: "/payroll/controls", icon: Shield, modules: ["SYSTEM_CONTROL"] },
    ],
  },
  {
    title: "Time and leave",
    entries: [
      { title: "Holiday calendar", description: "Public and company holidays, by branch.", href: "/setup/holidays", icon: CalendarDays, modules: ["HOLIDAYS"], fact: "holidays" },
      { title: "Shifts and attendance rules", description: "Working hours per shift, weekly offs, grace and half day.", href: "/timeAndLeave/attendance?tab=shifts", icon: Clock, modules: ["ATTENDANCE"] },
      { title: "Leave and overtime policies", description: "Leave types and overtime rules.", href: "/timeAndLeave/policies", icon: ScrollText, modules: ["LEAVE_TYPES", "OT_RULES"] },
    ],
  },
];

export default async function SetupPage() {
  await ensureTenantContext();
  await requireAuthenticatedUser();
  const modules = [...new Set(GROUPS.flatMap((g) => g.entries.flatMap((e) => e.modules)))];
  const allowed = new Map(await Promise.all(modules.map(async (m) => [m, await hasPermission("VIEW", m)] as const)));
  const groups = GROUPS.map((g) => ({ ...g, entries: g.entries.filter((e) => e.modules.some((m) => allowed.get(m))) })).filter((g) => g.entries.length > 0);
  const facts = await setupFacts(groups.flatMap((g) => g.entries.flatMap((e) => (e.fact ? [e.fact] : []))));

  return (
    <div>
      <PageBar title="Setup" description="Company details, payroll settings and the calendar, with what each still needs" />
      {groups.length === 0 ? (
        <EmptyState title="No settings for your role" description="Ask an administrator for the permissions you need." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <Panel key={g.title} title={g.title} count={g.entries.length}>
              <ul className="divide-y divide-line">
                {g.entries.map((e) => {
                  const fact = e.fact ? facts[e.fact] : undefined;
                  return (
                    <li key={e.href}>
                      <Link href={e.href} className="group flex items-start gap-3 px-4 py-3 hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand-strong">
                          <e.icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink group-hover:underline">{e.title}</span>
                          <span className="block text-xs text-ink-muted">{e.description}</span>
                          {fact && (
                            <span className={fact.warning ? "mt-1 flex items-center gap-1 text-xs font-medium text-warning" : "mt-1 block text-xs text-ink"}>
                              {fact.warning && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-label="Needs attention" />}
                              {fact.text}
                            </span>
                          )}
                        </span>
                        <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
