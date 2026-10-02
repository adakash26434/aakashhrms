"use client";

import { useState } from "react";
import { Download, Filter, Plus, Printer, RefreshCw, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { NprText } from "@/components/ui/npr-text";
import { Progress } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Toggle } from "@/components/ui/toggle";

// Development-only gallery. Sample data only. Legacy screens are built from
// zinc / emerald / payroll-* classes, so this page deliberately uses them too:
// it shows how the Phase 1 remap renders the existing UI, next to the new
// semantic tokens (bg-surface, text-ink-muted, border-line, bg-brand).

const SAMPLE_ROWS = [
  { code: "EMP-0001", name: "Sita Sharma", dept: "Finance", basic: 85000, gross: 112500, net: 98240.5, status: "Active" },
  { code: "EMP-0002", name: "Ram Bahadur Thapa", dept: "Operations", basic: 52000, gross: 61800, net: 55012, status: "Active" },
  { code: "EMP-0003", name: "Anita Gurung", dept: "Human Resources", basic: 64000, gross: 76400, net: -1250, status: "On hold" },
  { code: "EMP-0004", name: "Bikash Karki", dept: "Sales", basic: 1450000, gross: 1725000, net: 1402300.75, status: "Draft" },
];

const RAMP = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">{title}</h2>
      {children}
    </section>
  );
}

export function KitGallery() {
  const [segment, setSegment] = useState<"all" | "active" | "inactive">("all");
  const [toggle, setToggle] = useState(true);
  const [checked, setChecked] = useState(true);

  return (
    <div className="min-h-screen bg-canvas">
      <div className="h-0.5 bg-[linear-gradient(90deg,var(--brand)_68%,var(--brand-red)_68%)]" />
      <header className="flex h-11 items-center gap-3 border-b border-line bg-chrome px-4">
        <span className="text-sm font-semibold text-ink">
          Aakash<span className="text-brand-red">HRMS</span>
        </span>
        <span className="text-xs text-ink-faint">Component gallery · development only</span>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 p-6">
        <Section title="Colour ramps (logo forest green · green-tinted neutrals)">
          <div className="space-y-2">
            {(["forest", "neutral"] as const).map((ramp) => (
              <div key={ramp} className="grid grid-cols-11 overflow-hidden rounded-lg border border-line">
                {RAMP.map((step) => (
                  <div key={step} className="h-12 p-1.5 text-3xs" style={{ background: `var(--${ramp}-${step})`, color: step >= 500 ? "#fff" : "var(--text)" }}>
                    {step}
                  </div>
                ))}
              </div>
            ))}
            <div className="flex flex-wrap gap-2 text-xs">
              {["success", "warning", "danger", "info"].map((tone) => (
                <span key={tone} className="rounded-md border border-line px-2 py-1" style={{ background: `var(--${tone}-subtle)`, color: `var(--${tone})` }}>
                  {tone}
                </span>
              ))}
              <span className="rounded-md px-2 py-1 text-white bg-brand-red">brand red (wordmark only)</span>
            </div>
          </div>
        </Section>

        <Section title="Type scale (Inter, 13px body)">
          <div className="space-y-1 rounded-lg border border-line bg-surface p-4">
            <p className="text-base font-semibold text-ink">Page title 16 — Payroll › Generate</p>
            <p className="text-sm font-semibold text-ink">Section 14/13 semibold — Earnings</p>
            <p className="text-sm text-ink">Body 13 — End-to-end payroll for FY 2082/83 with SSF 31% (11% + 20%).</p>
            <p className="text-xs text-ink-muted">Secondary 12 — Last calculated 2082-06-16 BS · 2 Oct 2026</p>
            <p className="text-2xs text-ink-faint">Caption 11 — Pay heads are applied in display order.</p>
            <p className="font-mono text-xs text-ink-muted">font-mono (figures, codes) — EMP-0001 · 2083/84 · 0O0O</p>
            <p className="font-code text-xs text-ink-muted">font-code (true monospace) — PAN 601234567 · A/C 0010012345678</p>
          </div>
        </Section>

        <Section title="Buttons & controls">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-4">
            <Button><Plus className="h-4 w-4" />New run</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline"><Printer className="h-4 w-4" />Print</Button>
            <Button variant="ghost"><RefreshCw className="h-4 w-4" />Refresh</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="danger">Delete</Button>
            <Button size="sm" isLoading>Saving</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-medium text-zinc-700">
              Employee name
              <input className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900" placeholder="Search by name or code" />
            </label>
            <label className="space-y-1 text-xs font-medium text-zinc-700">
              Department
              <select className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900" defaultValue="Finance">
                <option>Finance</option>
                <option>Operations</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-zinc-700">
              Basic salary
              <input className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-right text-sm text-zinc-900" defaultValue="4,52,300.00" />
            </label>
            <div className="flex items-center gap-4">
              <Checkbox checked={checked} onCheckedChange={setChecked} id="kit-check" />
              <label htmlFor="kit-check" className="text-sm text-ink">Include inactive</label>
              <Toggle checked={toggle} onChange={setToggle} label="Auto-save" />
            </div>
            <SegmentedControl
              size="sm"
              value={segment}
              onChange={setSegment}
              options={[
                { id: "all", label: "All", count: 128 },
                { id: "active", label: "Active", count: 121 },
                { id: "inactive", label: "Inactive", count: 7 },
              ]}
            />
            <Progress value={68} />
          </div>
        </Section>

        <Section title="Badges & banners">
          <div className="flex flex-wrap gap-2">
            {(["default", "success", "warning", "info", "danger", "pending", "draft", "critical"] as const).map((v) => (
              <Badge key={v} variant={v}>{v}</Badge>
            ))}
          </div>
          <ErrorBanner variant="warning" title="3 employees have no bank account" message="They will be skipped in the bank transfer file." />
          <ErrorBanner variant="error" message="Payroll for Ashwin 2082 is locked. Unlock it from Fiscal Year to make changes." />
        </Section>

        <Section title="Register (legacy markup, remapped)">
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xs">
            <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input className="h-7 w-56 rounded-md border border-zinc-200 bg-white pl-7 pr-2 text-xs" placeholder="Search employees" />
              </div>
              <Button size="xs" variant="outline"><Filter className="h-3.5 w-3.5" />Filters</Button>
              <span className="ml-auto text-2xs text-zinc-500">4 of 128 employees</span>
              <Button size="xs" variant="outline"><Download className="h-3.5 w-3.5" />Export</Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left uppercase">Code</th>
                  <th className="px-3 py-2 text-left uppercase">Employee</th>
                  <th className="px-3 py-2 text-left uppercase">Department</th>
                  <th className="px-3 py-2 text-right uppercase">Basic</th>
                  <th className="px-3 py-2 text-right uppercase">Gross</th>
                  <th className="px-3 py-2 text-right uppercase">Net pay</th>
                  <th className="px-3 py-2 text-left uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_ROWS.map((row, i) => (
                  <tr key={row.code} className={i === 1 ? "bg-emerald-50" : "hover:bg-zinc-50"}>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">{row.code}</td>
                    <td className="px-3 py-2 font-medium text-zinc-900">{row.name}</td>
                    <td className="px-3 py-2 text-zinc-600">{row.dept}</td>
                    <td className="px-3 py-2 text-right"><NprText value={row.basic} /></td>
                    <td className="px-3 py-2 text-right"><NprText value={row.gross} /></td>
                    <td className="px-3 py-2 text-right"><NprText value={row.net} type={row.net < 0 ? "negative" : "neutral"} /></td>
                    <td className="px-3 py-2">
                      <Badge variant={row.status === "Active" ? "success" : row.status === "Draft" ? "draft" : "warning"}>{row.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-300 bg-zinc-50 font-semibold">
                  <td className="px-3 py-2 text-xs text-zinc-600" colSpan={3}>Totals</td>
                  <td className="px-3 py-2 text-right"><NprText value={1651000} showPrefix /></td>
                  <td className="px-3 py-2 text-right"><NprText value={1975700} showPrefix /></td>
                  <td className="px-3 py-2 text-right"><NprText value={1554303.25} showPrefix /></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>

        <Section title="Cards & empty state">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Net payout</CardTitle>
                <CardDescription>Ashwin 2082</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold text-ink tabular"><NprText value={4523000} showPrefix /></p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pending approvals</CardTitle>
                <CardDescription>Leave and payroll</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold text-emerald-700">12</p>
              </CardContent>
            </Card>
            <EmptyState compact icon={<Users className="h-5 w-5" />} title="No employees match" description="Clear the filters to see everyone." />
          </div>
        </Section>
      </main>
    </div>
  );
}
