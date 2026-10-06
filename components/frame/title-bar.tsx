"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, HelpCircle, Menu, Search } from "lucide-react";
import { DateFormatMenu } from "@/components/ui/date-format-menu";
import type { WorkspaceContext } from "@/lib/services/workspace-context.service";
import { useFrame } from "./frame-context";
import { ClockButton } from "./clock-button";
import { UserMenu } from "./user-menu";

/** Title bar (2.2): brand, command trigger, calendar, fiscal year, alerts, account. */
export function TitleBar({ context }: { context?: WorkspaceContext }) {
  const { setDrawerOpen, setPaletteOpen, setHelpOpen } = useFrame();
  const pending = context?.pendingApprovalsCount ?? 0;
  const canSeeApprovals =
    Boolean(context?.isImpersonating) || Boolean(context?.allowedModules.includes("LEAVE_APPROVALS"));
  const salaryPending = context?.pendingSalaryApprovalsCount ?? 0;
  const canSeeSalary = !context?.isImpersonating && Boolean(context?.allowedModules.includes("SALARY_MAPPING"));
  const attendancePending = context?.pendingAttendanceCount ?? 0;
  const canSeeAttendance = !context?.isImpersonating && Boolean(context?.allowedModules.includes("ATTENDANCE"));
  const policyPending = context?.pendingLeavePolicyCount ?? 0;
  // Staff who are also employees clock in here too (never platform support).
  const canClock = !context?.isImpersonating && Boolean(context?.myEmployeeId);

  return (
    <header className="relative z-30 shrink-0 bg-chrome print:hidden">
      {/* Brand strip: the logo's green → red underline */}
      <div aria-hidden className="h-0.5 bg-[linear-gradient(90deg,var(--brand)_0_68%,var(--brand-red)_68%_100%)]" />
      <div className="flex h-11 items-center gap-2 border-b border-line px-2 sm:px-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken lg:hidden cursor-pointer"
          aria-label="Open navigation"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1" aria-label="AakashHRMS home">
          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md border border-line bg-white">
            <Image src="/AakashHrmsLogo.jpeg" alt="" width={28} height={28} className="h-full w-full object-cover" priority unoptimized />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight text-ink sm:inline">
            Aakash<span className="text-brand-red">HRMS</span>
          </span>
        </Link>

        {context?.company.name && (
          <>
            <span aria-hidden className="hidden h-5 w-px bg-line md:block" />
            <span className="hidden min-w-0 max-w-56 truncate text-xs font-medium text-ink-muted md:block" title={`${context.company.name} (${context.company.code})`}>
              {context.company.name}
            </span>
          </>
        )}

        {/* Command palette trigger */}
        <div className="flex flex-1 justify-center px-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-8 w-full max-w-md items-center gap-2 rounded-md border border-line bg-surface-sunken px-2.5 text-left text-xs text-ink-faint hover:border-line-strong hover:bg-white md:flex cursor-pointer"
            aria-label="Search or run a command (Ctrl K)"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 truncate">Search pages, employees, commands…</span>
            <kbd className="rounded border border-line bg-white px-1.5 py-px text-3xs font-medium text-ink-faint">Ctrl K</kbd>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken md:hidden cursor-pointer"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          <DateFormatMenu size="sm" />

          <Link
            href="/setup/company-setup?section=payroll_rules&tab=fiscal-year"
            title="Active fiscal year"
            className="hidden h-8 items-center gap-1.5 rounded-md border border-line px-2 text-xs font-medium text-ink hover:bg-surface-sunken lg:flex"
          >
            <CalendarDays className="h-3.5 w-3.5 text-brand" />
            {context?.activeFiscalYear.name}
          </Link>

          {canClock && <ClockButton />}

          {(canSeeApprovals || canSeeSalary || canSeeAttendance) && (
            <ApprovalsBell leave={canSeeApprovals ? pending : null} salary={canSeeSalary ? salaryPending : null} attendance={canSeeAttendance ? attendancePending : null} policy={policyPending > 0 ? policyPending : null} />
          )}

          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="hidden h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken sm:flex cursor-pointer"
            aria-label="Keyboard shortcuts (?)"
            title="Keyboard shortcuts (?)"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          <span aria-hidden className="mx-0.5 hidden h-5 w-px bg-line sm:block" />
          <UserMenu context={context} />
        </div>
      </div>
    </header>
  );
}

/**
 * Alerts bell: requests waiting for this user. Leave requests (approvers),
 * salary changes they can act on now (4.4 approvals), and attendance
 * adjustments and remote clock-ins (4.5), and leave policy changes to approve
 * (4.6c, shown only when there are some). One kind links straight to it;
 * more open a small menu.
 */
function ApprovalsBell({ leave, salary, attendance, policy }: { leave: number | null; salary: number | null; attendance: number | null; policy: number | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const total = (leave ?? 0) + (salary ?? 0) + (attendance ?? 0) + (policy ?? 0);
  const label = total > 0 ? `${total} request${total === 1 ? "" : "s"} waiting for you` : "Nothing waiting for you";
  const items = [
    leave !== null ? { href: "/timeAndLeave/leaves?tab=requests", label: "Leave requests", count: leave } : null,
    salary !== null ? { href: "/workforce/salary-mapping?tab=approvals", label: "Salary changes", count: salary } : null,
    attendance !== null ? { href: "/timeAndLeave/attendance?tab=adjustments", label: "Attendance adjustments", count: attendance } : null,
    policy !== null ? { href: "/timeAndLeave/policies?tab=types", label: "Leave policies", count: policy } : null,
  ].filter((x): x is { href: string; label: string; count: number } => !!x);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const badge = total > 0 && (
    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-3xs font-semibold text-white tabular-nums">
      {total > 99 ? "99+" : total}
    </span>
  );
  const buttonClass = "relative flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken";
  if (items.length === 1) {
    return (
      <Link href={items[0].href} className={buttonClass} aria-label={label} title={label}>
        <Bell className="h-4 w-4" />
        {badge}
      </Link>
    );
  }
  return (
    <div ref={ref} className="relative">
      <button type="button" className={buttonClass} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell className="h-4 w-4" />
        {badge}
      </button>
      {open && (
        <div role="menu" aria-label="Waiting for you" className="absolute right-0 top-full z-40 mt-1 w-56 rounded-md border border-line bg-surface py-1 text-sm shadow-lg">
          {items.map((i) => (
            <Link key={i.href} role="menuitem" href={i.href} onClick={() => setOpen(false)} className="flex items-center justify-between px-3 py-1.5 text-ink hover:bg-surface-sunken">
              {i.label}
              <span className={i.count ? "rounded-full bg-brand-red px-1.5 text-3xs font-semibold text-white tabular-nums" : "text-2xs text-ink-faint"}>{i.count}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
