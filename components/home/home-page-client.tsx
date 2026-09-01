"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  ArrowRight,
  Wallet,
  Users,
  CalendarRange,
  Layers,
  Building2,
  Sparkles,
  CheckCircle2,
  Calculator,
  TrendingUp,
  FileSpreadsheet,
  Lock,
  BadgePercent,
  Clock,
  ArrowUpRight,
  Activity,
  ChevronRight,
  SlidersHorizontal,
  Globe2,
  Receipt,
  Landmark,
  Compass,
  FileText,
  UserCheck,
  Award,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HomePageClientProps {
  isLoggedIn: boolean;
  userScope?: string | null;
  userName?: string | null;
}

export function HomePageClient({
  isLoggedIn,
  userScope,
  userName,
}: HomePageClientProps) {
  const [activeTab, setActiveTab] = useState<
    "payroll" | "attendance" | "selfService" | "governance"
  >("payroll");

  const dashboardTarget = userScope === "SELF" ? "/self-service" : "/dashboard";
  const dashboardLabel =
    userScope === "SELF" ? "Go to Self-Service" : "Open Workspace Dashboard";

  return (
    <div className="min-h-screen bg-payroll-cream text-payroll-navy font-sans selection:bg-emerald-200 selection:text-payroll-navy">
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-50 border-b border-payroll-light/80 bg-white/80 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden shadow-sm border border-payroll-light/40 bg-white">
              <Image
                src="/AakashHrmsLogo.jpeg"
                alt="AakashHRMS Logo"
                width={40}
                height={40}
                className="object-cover h-full w-full"
                priority
                unoptimized
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-payroll-navy">
                  AakashHRMS
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Enterprise
                </span>
              </div>
              <span className="text-[11px] text-gray-500 font-medium">
                HR, Payroll & Statutory System
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-gray-600">
            <a
              href="#capabilities"
              className="hover:text-payroll-primary transition-colors"
            >
              Capabilities
            </a>
            <a
              href="#statutory"
              className="hover:text-payroll-primary transition-colors"
            >
              Statutory Engine
            </a>
            <a
              href="#workflow"
              className="hover:text-payroll-primary transition-colors"
            >
              Operational Flow
            </a>
            <a
              href="#governance"
              className="hover:text-payroll-primary transition-colors"
            >
              Security & RBAC
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                {userName && (
                  <span className="hidden text-xs font-semibold text-gray-600 sm:inline-block">
                    Hi,{" "}
                    <span className="text-payroll-navy font-bold">
                      {userName}
                    </span>
                  </span>
                )}
                <Link
                  href={dashboardTarget}
                  className="flex items-center gap-2 rounded-xl bg-payroll-primary px-4 py-2 text-xs font-semibold text-white shadow-md shadow-payroll-primary/25 hover:bg-payroll-primary-hover hover:shadow-lg transition-all active:scale-[0.98]"
                >
                  <span>{dashboardLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/platform/login"
                  className="hidden sm:flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
                  title="Super Admin Platform Access"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-payroll-primary" />
                  <span>Platform Control</span>
                </Link>
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-xl bg-payroll-primary px-4.5 py-2 text-xs font-semibold text-white shadow-md shadow-payroll-primary/25 hover:bg-payroll-primary-hover hover:shadow-lg transition-all active:scale-[0.98]"
                >
                  <span>Sign In</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
        {/* Subtle Background Glows */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 right-10 -z-10 h-72 w-72 rounded-full bg-payroll-light/50 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Statutory Nepal IRD & SSF Compliant Engine</span>
          </div>

          {/* Main Headline */}
          <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-payroll-navy max-w-4xl mx-auto leading-[1.15]">
            Next-Gen Workforce &{" "}
            <span className="bg-linear-to-r from-payroll-primary via-payroll-primary-hover to-payroll-primary bg-clip-text text-transparent">
              Automated Payroll
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed font-normal">
            A unified enterprise platform tailored for precision payroll
            computation, dual Bikram Sambat (BS) & Gregorian (AD) time tracking,
            loan amortization, and transparent employee self-service.
          </p>

          {/* Hero CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href={isLoggedIn ? dashboardTarget : "/login"}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-xl bg-payroll-primary px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-payroll-primary/25 hover:bg-payroll-primary-hover hover:shadow-xl transition-all active:scale-[0.98]"
            >
              <span>
                {isLoggedIn ? dashboardLabel : "Launch Workspace Portal"}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <a
              href="#capabilities"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
            >
              <span>Explore Capabilities</span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </a>
          </div>

          {/* Trust Badges */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs font-semibold text-gray-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Progressive IRD Tax Slabs (2081/82)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Social Security Fund (11% + 20% SSF)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Dual BS / AD Nepali Calendars</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Granular RBAC & Tenant Isolation</span>
            </div>
          </div>
        </div>

        {/* 3. Interactive Interactive Live Module Preview */}
        <div className="mx-auto mt-14 max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-payroll-light bg-white/90 shadow-xl shadow-gray-200/50 backdrop-blur-sm">
            {/* Window Topbar */}
            <div className="flex items-center justify-between border-b border-payroll-light bg-payroll-cream/70 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-rose-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <span className="ml-2 text-xs font-semibold text-gray-500">
                  AakashHRMS Enterprise Workspace · Live Simulation
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium text-gray-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Encrypted Tenant Context</span>
              </div>
            </div>

            {/* Interactive Module Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-payroll-light bg-gray-50/50 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("payroll")}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 px-2 border-b-2 transition-all cursor-pointer",
                  activeTab === "payroll"
                    ? "border-payroll-primary bg-white text-payroll-navy font-bold shadow-xs"
                    : "border-transparent text-gray-500 hover:text-gray-900",
                )}
              >
                <Calculator className="h-4 w-4 text-payroll-primary" />
                <span>Statutory Payroll</span>
              </button>

              <button
                onClick={() => setActiveTab("attendance")}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 px-2 border-b-2 transition-all cursor-pointer",
                  activeTab === "attendance"
                    ? "border-payroll-primary bg-white text-payroll-navy font-bold shadow-xs"
                    : "border-transparent text-gray-500 hover:text-gray-900",
                )}
              >
                <Clock className="h-4 w-4 text-blue-600" />
                <span>Time & BS Calendar</span>
              </button>

              <button
                onClick={() => setActiveTab("selfService")}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 px-2 border-b-2 transition-all cursor-pointer",
                  activeTab === "selfService"
                    ? "border-payroll-primary bg-white text-payroll-navy font-bold shadow-xs"
                    : "border-transparent text-gray-500 hover:text-gray-900",
                )}
              >
                <Wallet className="h-4 w-4 text-emerald-600" />
                <span>Employee Self-Service</span>
              </button>

              <button
                onClick={() => setActiveTab("governance")}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 px-2 border-b-2 transition-all cursor-pointer",
                  activeTab === "governance"
                    ? "border-payroll-primary bg-white text-payroll-navy font-bold shadow-xs"
                    : "border-transparent text-gray-500 hover:text-gray-900",
                )}
              >
                <Lock className="h-4 w-4 text-indigo-600" />
                <span>Roles & Security</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-6 md:p-8 bg-white">
              {activeTab === "payroll" && (
                <div className="space-y-5 animate-in fade-in-50 duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                    <div>
                      <h4 className="text-sm font-bold text-payroll-navy">
                        Automated Monthly Payroll Calculation (FY 2081/82)
                      </h4>
                      <p className="text-xs text-gray-500">
                        Automatic progressive tax brackets, SSF
                        employer/employee portions, and loan deductions.
                      </p>
                    </div>
                    <span className="self-start rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                      Status: Verified & Locked
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                      <p className="text-xs font-medium text-emerald-800">
                        Gross Earnings
                      </p>
                      <p className="mt-1 text-xl font-bold text-payroll-navy">
                        NPR 75,000.00
                      </p>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Basic (60%) + Dearness + Allowances
                      </p>
                    </div>

                    <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
                      <p className="text-xs font-medium text-rose-800">
                        Statutory Deductions
                      </p>
                      <p className="mt-1 text-xl font-bold text-rose-700">
                        - NPR 9,250.00
                      </p>
                      <p className="mt-1 text-[11px] text-gray-500">
                        11% SSF + IRD Tax Bracket + CIT
                      </p>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                      <p className="text-xs font-medium text-blue-800">
                        Net Take-Home Pay
                      </p>
                      <p className="mt-1 text-xl font-bold text-blue-900">
                        NPR 65,750.00
                      </p>
                      <p className="mt-1 text-[11px] text-gray-500">
                        1-Click Bank Transfer CSV Export
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs text-gray-600 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-payroll-primary" />
                      <span>
                        Direct payout export formatted for Standard Bank Switch
                        & ConnectIPS.
                      </span>
                    </div>
                    <span className="font-semibold text-payroll-primary">
                      100% Tax Compliant
                    </span>
                  </div>
                </div>
              )}

              {activeTab === "attendance" && (
                <div className="space-y-5 animate-in fade-in-50 duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                    <div>
                      <h4 className="text-sm font-bold text-payroll-navy">
                        Time, Attendance & Bikram Sambat (BS) Calendar Engine
                      </h4>
                      <p className="text-xs text-gray-500">
                        Dual calendar precision with automated overtime
                        evaluation and statutory holiday calendars.
                      </p>
                    </div>
                    <span className="self-start rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
                      Bhadra 2081 / August 2024
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                      <p className="text-xs text-gray-500">Present Days</p>
                      <p className="text-lg font-bold text-payroll-navy mt-1">
                        22 Days
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                      <p className="text-xs text-gray-500">Paid Leaves</p>
                      <p className="text-lg font-bold text-emerald-700 mt-1">
                        2 Days
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                      <p className="text-xs text-gray-500">Public Holidays</p>
                      <p className="text-lg font-bold text-purple-700 mt-1">
                        4 Days
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                      <p className="text-xs text-gray-500">Overtime Hours</p>
                      <p className="text-lg font-bold text-blue-700 mt-1">
                        12.5 hrs
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs text-gray-600 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarRange className="h-4 w-4 text-blue-600" />
                      <span>
                        Seamless BS/AD toggle available system-wide across all
                        views and date pickers.
                      </span>
                    </div>
                    <span className="font-semibold text-blue-600">
                      Dual-Engine Active
                    </span>
                  </div>
                </div>
              )}

              {activeTab === "selfService" && (
                <div className="space-y-5 animate-in fade-in-50 duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                    <div>
                      <h4 className="text-sm font-bold text-payroll-navy">
                        Employee Self-Service (ESS) Transparent Portal
                      </h4>
                      <p className="text-xs text-gray-500">
                        Dedicated role with restricted self-scope, instant
                        payslip downloads, and leave balance tracking.
                      </p>
                    </div>
                    <span className="self-start rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                      Scope: Individual Staff
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        <span>Monthly Payslips</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Itemized PDF payslips with tax breakdowns ready to
                        download.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1">
                        <CalendarRange className="h-4 w-4 text-blue-600" />
                        <span>Leave Applications</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Apply for annual/sick leaves with real-time approval
                        tracking.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1">
                        <Landmark className="h-4 w-4 text-purple-600" />
                        <span>Loan Amortization</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        View remaining loan balance and monthly salary deduction
                        schedule.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs text-gray-600 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                      <span>
                        Clean, modern mobile-friendly interface for all team
                        members.
                      </span>
                    </div>
                    <span className="font-semibold text-emerald-700">
                      Self-Scoped Security
                    </span>
                  </div>
                </div>
              )}

              {activeTab === "governance" && (
                <div className="space-y-5 animate-in fade-in-50 duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                    <div>
                      <h4 className="text-sm font-bold text-payroll-navy">
                        Granular RBAC Permission Matrix & Audit Log
                      </h4>
                      <p className="text-xs text-gray-500">
                        Multi-tenant company database isolation, module
                        permission controls, and audit verification.
                      </p>
                    </div>
                    <span className="self-start rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
                      Enterprise Tier
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50">
                      <p className="text-xs font-bold text-gray-800">
                        Module Access Control Matrix
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Configure exact CREATE, VIEW, EDIT, and DELETE rights
                        per role across 15 distinct functional modules.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50">
                      <p className="text-xs font-bold text-gray-800">
                        Immutable Audit Trail
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Every salary modification, attendance adjustment, and
                        permission change is timestamped and recorded.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs text-gray-600 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-indigo-600" />
                      <span>
                        Complete isolation between tenant databases and platform
                        control plane.
                      </span>
                    </div>
                    <span className="font-semibold text-indigo-600">
                      Zero Leakage Guarantee
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Capabilities Bento Grid */}
      <section
        id="capabilities"
        className="border-t border-payroll-light bg-white py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-wider text-payroll-primary">
              Core Capabilities
            </h2>
            <p className="mt-2 text-3xl font-extrabold text-payroll-navy tracking-tight sm:text-4xl">
              Everything Your Organization Needs to Operate Flawlessly
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Built ground-up to handle complex workforce structures, automated
              statutory deductions, and strict governance standards.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="group rounded-2xl border border-payroll-light bg-payroll-cream/50 p-6 hover:bg-white hover:border-payroll-primary/30 hover:shadow-lg transition-all">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-payroll-primary/10 text-payroll-primary group-hover:bg-payroll-primary group-hover:text-white transition-colors">
                <Calculator className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-base font-bold text-payroll-navy">
                Statutory Payroll Engine
              </h3>
              <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                Automated progressive IRD tax slabs (single & married), 11%
                employee + 20% employer SSF, CIT, and loan deductions.
              </p>
              <ul className="mt-4 space-y-1.5 text-[11px] text-gray-500 font-medium">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-payroll-primary" /> Tax
                  slab mapping
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-payroll-primary" /> Leave
                  salary encashment
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-payroll-primary" /> Bank
                  payment export
                </li>
              </ul>
            </div>

            {/* Card 2 */}
            <div className="group rounded-2xl border border-payroll-light bg-payroll-cream/50 p-6 hover:bg-white hover:border-payroll-primary/30 hover:shadow-lg transition-all">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <CalendarRange className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-base font-bold text-payroll-navy">
                Time & Dual Calendars
              </h3>
              <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                Seamless dual BS & AD calendar engine with automated overtime
                rules, multi-tier leave approval hierarchies, and public holiday
                syncing.
              </p>
              <ul className="mt-4 space-y-1.5 text-[11px] text-gray-500 font-medium">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-blue-600" /> Bikram Sambat
                  integration
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-blue-600" /> Overtime rule
                  multipliers
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-blue-600" /> Leave quota
                  management
                </li>
              </ul>
            </div>

            {/* Card 3 */}
            <div className="group rounded-2xl border border-payroll-light bg-payroll-cream/50 p-6 hover:bg-white hover:border-payroll-primary/30 hover:shadow-lg transition-all">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Wallet className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-base font-bold text-payroll-navy">
                Self-Service Portal
              </h3>
              <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                Dedicated portal for staff to view attendance logs, apply for
                leaves, download payslips, and check remaining loan balances.
              </p>
              <ul className="mt-4 space-y-1.5 text-[11px] text-gray-500 font-medium">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> PDF payslip
                  generation
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Self-scope
                  data isolation
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Mobile
                  friendly layout
                </li>
              </ul>
            </div>

            {/* Card 4 */}
            <div className="group rounded-2xl border border-payroll-light bg-payroll-cream/50 p-6 hover:bg-white hover:border-payroll-primary/30 hover:shadow-lg transition-all">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-base font-bold text-payroll-navy">
                Governance & Auditing
              </h3>
              <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                Granular RBAC matrix, immutable audit log trail, rate-limited
                authentication, and password policy enforcement.
              </p>
              <ul className="mt-4 space-y-1.5 text-[11px] text-gray-500 font-medium">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-purple-600" /> Granular
                  CRUD matrix
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-purple-600" /> Full audit
                  logs
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-purple-600" /> Multi-tenant
                  architecture
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Statutory Compliance Engine Deep Dive */}
      <section
        id="statutory"
        className="py-20 bg-payroll-cream/70 border-t border-payroll-light"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <BadgePercent className="h-3.5 w-3.5" />
                <span>Nepal Regulatory Compliance</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-payroll-navy tracking-tight">
                Designed specifically for Nepalese Tax & Labor Laws
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Forget generic spreadsheets and overseas HR software that fail
                at local regulations. AakashHRMS calculates progressive income
                tax, social security contributions, and statutory allowances
                out-of-the-box.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 rounded-xl border border-payroll-light bg-white p-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">
                    IRD
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-payroll-navy">
                      Progressive Annual Income Tax Slabs (FY 2081/82)
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Accurate marital status mapping (Single vs. Married
                      thresholds with 1%, 10%, 20%, 30%, and 36% top brackets).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-payroll-light bg-white p-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-800 font-bold text-xs">
                    SSF
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-payroll-navy">
                      Social Security Fund (SSF) Automation
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Automatic 11% employee contribution and 20% employer
                      contribution tracking on basic salary.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-payroll-light bg-white p-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-800 font-bold text-xs">
                    CIT
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-payroll-navy">
                      CIT, Provident Fund & Loan Installments
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Deduct recurring loan principal installments and approved
                      retirement fund contributions seamlessly.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Compliance Matrix */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-payroll-light bg-white p-6 shadow-md">
                <h3 className="text-xs font-bold uppercase tracking-wider text-payroll-primary mb-4 flex items-center justify-between">
                  <span>Standard Nepali Statutory Slabs (Single Status)</span>
                  <span className="text-gray-400 font-normal">
                    Active System Matrix
                  </span>
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="font-medium text-gray-700">
                      First NPR 5,00,000
                    </span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      1% Social Security Tax
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="font-medium text-gray-700">
                      Next NPR 2,00,000 (5L – 7L)
                    </span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      10% Income Tax
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="font-medium text-gray-700">
                      Next NPR 3,00,000 (7L – 10L)
                    </span>
                    <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      20% Income Tax
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="font-medium text-gray-700">
                      Next NPR 10,00,000 (10L – 20L)
                    </span>
                    <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      30% Income Tax
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="font-medium text-gray-700">
                      Above NPR 20,00,000
                    </span>
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                      36% Top Tax Bracket
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                  <span>* Configurable per fiscal year in System Settings</span>
                  <span className="font-semibold text-payroll-navy">
                    AakashHRMS v1.0
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Operational Flow */}
      <section
        id="workflow"
        className="py-20 bg-white border-t border-payroll-light"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-wider text-payroll-primary">
              Operational Workflow
            </h2>
            <p className="mt-2 text-3xl font-extrabold text-payroll-navy tracking-tight sm:text-4xl">
              From Master Setup to Payout in 4 Simple Steps
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="relative rounded-2xl border border-payroll-light bg-payroll-cream/40 p-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-extrabold text-payroll-primary">
                  STEP 01
                </span>
                <h3 className="mt-2 text-base font-bold text-payroll-navy">
                  Setup & Mapping
                </h3>
                <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                  Configure fiscal years, tax slabs, pay heads, departments, and
                  map staff salary structures.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-[11px] font-semibold text-payroll-primary">
                <span>Setup Module</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            <div className="relative rounded-2xl border border-payroll-light bg-payroll-cream/40 p-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-extrabold text-blue-600">
                  STEP 02
                </span>
                <h3 className="mt-2 text-base font-bold text-payroll-navy">
                  Attendance & Leave
                </h3>
                <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                  Import attendance records, calculate overtime hours, and
                  approve leave requests.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                <span>Time & Leave Module</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            <div className="relative rounded-2xl border border-payroll-light bg-payroll-cream/40 p-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-extrabold text-emerald-600">
                  STEP 03
                </span>
                <h3 className="mt-2 text-base font-bold text-payroll-navy">
                  Payroll Execution
                </h3>
                <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                  Generate monthly payroll in 1-click. Audit earnings,
                  deductions, and tax computations.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <span>Payroll Module</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            <div className="relative rounded-2xl border border-payroll-light bg-payroll-cream/40 p-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-extrabold text-purple-600">
                  STEP 04
                </span>
                <h3 className="mt-2 text-base font-bold text-payroll-navy">
                  Disbursement & ESS
                </h3>
                <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                  Export bank payout file, lock the run, and instantly publish
                  payslips to the employee portal.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-[11px] font-semibold text-purple-600">
                <span>Self-Service Module</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Security & Governance */}
      <section
        id="governance"
        className="py-16 bg-payroll-cream border-t border-payroll-light"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-payroll-navy p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
            <div className="pointer-events-none absolute -right-10 -bottom-10 h-72 w-72 rounded-full bg-payroll-primary/20 blur-2xl" />

            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-300 border border-white/10">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Enterprise Architecture & Isolation</span>
              </div>
              <h2 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
                Secure Multi-Tenant Engine with Immutable Audit Records
              </h2>
              <p className="mt-4 text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
                Every tenant is hosted with database isolation. Super
                Administrators supervise system health from the Control Plane
                without mixing tenant credentials or business data.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href={isLoggedIn ? dashboardTarget : "/login"}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-xs font-bold text-white hover:bg-emerald-600 transition-all shadow-md active:scale-95"
                >
                  <span>Sign In to Your Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/platform/login"
                  className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-xs font-medium text-white hover:bg-white/10 transition-all"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Platform Control Plane</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="border-t border-payroll-light bg-white py-12 text-xs text-gray-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden border border-payroll-light/60 bg-white">
                <Image
                  src="/AakashHrmsLogo.jpeg"
                  alt="AakashHRMS"
                  width={32}
                  height={32}
                  className="object-cover h-full w-full"
                  unoptimized
                />
              </div>
              <span className="font-bold text-payroll-navy">AakashHRMS</span>
              <span className="text-gray-300">|</span>
              <span>Next-Gen Workforce & Statutory Payroll Engine</span>
            </div>

            <div className="flex items-center gap-6 text-xs">
              <Link
                href="/login"
                className="hover:text-payroll-navy transition-colors"
              >
                Company Login
              </Link>
              <Link
                href="/self-service"
                className="hover:text-payroll-navy transition-colors"
              >
                Self-Service Portal
              </Link>
              <Link
                href="/platform/login"
                className="hover:text-payroll-navy transition-colors"
              >
                Control Plane
              </Link>
            </div>
          </div>

          <div className="mt-8 border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-gray-400">
            <p>© {new Date().getFullYear()} AakashHRMS. All rights reserved.</p>
            <p>Engineered for Nepal Statutory Compliance & Enterprise Scale.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
