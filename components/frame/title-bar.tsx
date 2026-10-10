"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarDays, HelpCircle, Menu, Search } from "lucide-react";
import { DateFormatMenu } from "@/components/ui/date-format-menu";
import type { WorkspaceContext } from "@/lib/services/workspace-context.service";
import { useFrame } from "./frame-context";
import { ClockButton } from "./clock-button";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { WorkingPeriodPill } from "./working-period-pill";

/** Title bar (2.2): brand, command trigger, calendar, fiscal year, alerts, account. */
export function TitleBar({ context }: { context?: WorkspaceContext }) {
  const { setDrawerOpen, setPaletteOpen, setHelpOpen } = useFrame();
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

          {!context?.isImpersonating && <WorkingPeriodPill period={context?.workingPeriod ?? null} calendar={context?.payCalendar ?? "BS"} />}

          <Link
            href="/setup/fiscal-year"
            title="Current fiscal year"
            className="hidden h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-line px-2 text-xs font-medium text-ink hover:bg-surface-sunken lg:flex"
          >
            <CalendarDays className="h-3.5 w-3.5 text-brand" />
            {context?.activeFiscalYear.name}
          </Link>

          {canClock && <ClockButton />}

          {context?.notifications.enabled && <NotificationBell initial={context.notifications} />}

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
