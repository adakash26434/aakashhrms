"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Wallet,
  Users,
  CalendarRange,
  Sparkles,
  CheckCircle2,
  Calculator,
  FileSpreadsheet,
  Lock,
  BadgePercent,
  Activity,
  ChevronRight,
  SlidersHorizontal,
  Landmark,
  FileText,
  UserCheck,
  Check,
  Globe,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { submitDemoRequestAction } from "@/app/actions/contact.actions";
import { validatePhoneNumber } from "@/lib/utils/phone";
import { PhoneInput } from "@/components/ui/phone-input";

// Contact & Demo Form Recipient - easily updated or toggled
const CONTACT_EMAIL = "info@aakashhrms.com";

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
  const [demoForm, setDemoForm] = useState({
    fullName: "",
    email: "",
    companyName: "",
    teamSize: "",
    phone: "",
    message: "",
  });
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [demoResponse, setDemoResponse] = useState<{
    emailSent: boolean;
    message: string;
    mailtoUrl?: string;
  } | null>(null);

  // Anti-bot & security state
  const [honeypot, setHoneypot] = useState("");
  const [formLoadedAt, setFormLoadedAt] = useState<number>(0);
  const [captcha, setCaptcha] = useState<{ num1: number; num2: number }>({
    num1: 3,
    num2: 4,
  });
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 8) + 1; // 1 to 8
    const n2 = Math.floor(Math.random() * 6) + 1; // 1 to 6
    setCaptcha({ num1: n1, num2: n2 });
    setCaptchaAnswer("");
  };

  useEffect(() => {
    setFormLoadedAt(Date.now());
    generateCaptcha();
  }, []);

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!demoForm.fullName.trim() || demoForm.fullName.trim().length < 2) {
      errs.fullName = "Please enter your full name (at least 2 characters).";
    }

    const trimmedEmail = demoForm.email.trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!trimmedEmail) {
      errs.email = "Work email is required.";
    } else if (!emailRegex.test(trimmedEmail)) {
      errs.email = "Please enter a valid work email (e.g. name@company.com).";
    }

    if (
      !demoForm.companyName.trim() ||
      demoForm.companyName.trim().length < 2
    ) {
      errs.companyName = "Please enter your company or organization name.";
    }

    const cleanPhone = demoForm.phone.trim();
    if (!cleanPhone) {
      errs.phone = "Phone number is required.";
    } else {
      const phoneCheck = validatePhoneNumber(cleanPhone, true, "NP");
      if (!phoneCheck.isValid) {
        errs.phone =
          phoneCheck.error ||
          "Please enter a valid phone number (e.g. +977 9800000000 or 01-4XXXXXX).";
      }
    }

    // Anti-malware & script injection check
    const maliciousPattern =
      /<script|javascript:|data:text\/html|onclick|onload|onerror|<iframe|UNION\s+SELECT|DROP\s+TABLE/i;
    const combinedText = `${demoForm.fullName} ${demoForm.email} ${demoForm.companyName} ${demoForm.phone} ${demoForm.message}`;
    if (maliciousPattern.test(combinedText)) {
      errs.fullName = "Suspicious code or HTML tags are not permitted.";
    }

    // Math human-verification check
    const parsedAnswer = parseInt(captchaAnswer.trim(), 10);
    if (
      !captchaAnswer.trim() ||
      isNaN(parsedAnswer) ||
      parsedAnswer !== captcha.num1 + captcha.num2
    ) {
      errs.captchaAnswer = `Please solve the verification: ${captcha.num1} + ${captcha.num2} = ?`;
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    setIsSubmittingDemo(true);
    setFormErrors({});
    try {
      const res = await submitDemoRequestAction({
        ...demoForm,
        botHoneypot: honeypot,
        formLoadedAt,
        captchaNum1: captcha.num1,
        captchaNum2: captcha.num2,
        captchaAnswer,
      });
      if (!res.success && res.errors) {
        setFormErrors(res.errors);
        generateCaptcha();
        return;
      }
      setDemoResponse(res);
      setDemoSubmitted(true);
      if (res.mailtoUrl && !res.emailSent) {
        window.location.href = res.mailtoUrl;
      }
    } catch (err) {
      console.error("Failed to submit demo request:", err);
      const fallbackMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
        `Demo Request: ${demoForm.companyName} (${demoForm.fullName})`,
      )}&body=${encodeURIComponent(
        `Name: ${demoForm.fullName}\nEmail: ${demoForm.email}\nCompany: ${demoForm.companyName}\nTeam Size: ${demoForm.teamSize}\nPhone: ${demoForm.phone}\n\nNotes:\n${demoForm.message}`,
      )}`;
      setDemoResponse({
        emailSent: false,
        message: `Demo request recorded. Open email client to send directly to ${CONTACT_EMAIL}.`,
        mailtoUrl: fallbackMailto,
      });
      setDemoSubmitted(true);
      window.location.href = fallbackMailto;
    } finally {
      setIsSubmittingDemo(false);
    }
  };

  const dashboardTarget = userScope === "SELF" ? "/self-service" : "/dashboard";
  const dashboardLabel =
    userScope === "SELF" ? "Go to Self-Service" : "Open Workspace Dashboard";

  return (
    <div className="min-h-screen bg-[#fcfdfc] text-payroll-navy font-sans selection:bg-emerald-200 selection:text-payroll-navy">
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-50 border-b border-payroll-light/80 bg-white/85 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Identity */}
          <Link href="/" className="flex items-center group focus:outline-none">
            <Image
              src="/AakashHrmsLogo.png"
              alt="Aakash HRMS - Smart People, Strong Organization"
              width={200}
              height={64}
              className="h-11 sm:h-22 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              priority
            />
          </Link>

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
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-gray-700 hover:text-payroll-primary transition-colors px-2 py-1"
                >
                  Sign In
                </Link>
                <a
                  href="#demo"
                  className="flex items-center gap-2 rounded-xl bg-payroll-primary px-4.5 py-2 text-xs font-semibold text-white shadow-md shadow-payroll-primary/25 hover:bg-payroll-primary-hover hover:shadow-lg transition-all active:scale-[0.98]"
                >
                  <span>Request a demo</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section: Light Minimal Backdrop with Soft Green Glow */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-32 bg-linear-to-b from-[#eef7f1] via-[#f7faf8] to-[#fbfdfb]">
        {/* Soft Ambient Radial Aura */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(195,237,208,0.55),rgba(240,249,243,0.3)_45%,transparent_80%)]" />

        {/* Soft Ambient Glows */}
        <div className="pointer-events-none absolute -top-48 left-1/2 -z-10 h-140 w-240 -translate-x-1/2 rounded-full bg-linear-to-b from-emerald-200/50 via-teal-100/35 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute top-16 -right-10 -z-10 h-112 w-md rounded-full bg-emerald-100/40 blur-3xl" />
        <div className="pointer-events-none absolute top-28 -left-10 -z-10 h-104 w-104 rounded-full bg-teal-100/35 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/90 px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-xs backdrop-blur-xs">
            <span className="h-2 w-2 rounded-full bg-[#1e7e47]" />
            <span>Nepal-compliant payroll & workforce management</span>
          </div>

          {/* Main Headline */}
          <h1 className="mt-8 text-4xl sm:text-5xl md:text-[62px] font-bold tracking-[-0.035em] text-[#111827] max-w-4xl mx-auto leading-[1.12]">
            Payroll, people & compliance —{" "}
            <span className="text-[#1e6f42]">in</span>
            <span className="block text-[#1e6f42]">one calm place</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal tracking-[-0.01em]">
            Aakash HRMS runs the full employee lifecycle — attendance, leave,
            loans, PF, SSF, CIT, TDS and IRD-ready reporting — with a
            multi-stage approval workflow built for Nepal.
          </p>

          {/* Hero CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <a
              href="#demo"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-[#1e7e47] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#166534] transition-all active:scale-[0.98]"
            >
              Request a demo
            </a>
            <a
              href="#capabilities"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs"
            >
              Explore features
            </a>
          </div>

          {/* Feature Highlight Pills */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/80 px-3.5 py-1 backdrop-blur-xs shadow-xs">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              Bikram Sambat aware
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/80 px-3.5 py-1 backdrop-blur-xs shadow-xs">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              PF · SSF · CIT · TDS
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/80 px-3.5 py-1 backdrop-blur-xs shadow-xs">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              IRD-ready reports
            </span>
          </div>
        </div>

        {/* 3. Live Dashboard Mockup in macOS Browser Frame */}
        <div className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-200/80">
            {/* Browser Window Chrome */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-[#fbfdfb] px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#ec6a5e]" />
                <div className="h-3 w-3 rounded-full bg-[#f4bf4f]" />
                <div className="h-3 w-3 rounded-full bg-[#61c554]" />
              </div>
              <div className="flex items-center gap-1.5 rounded-md bg-slate-100/90 px-6 py-1 text-xs text-slate-500 font-mono border border-slate-200/60">
                <Lock className="h-3 w-3 text-slate-400" />
                <span>app.aakashhrms.com/dashboard</span>
              </div>
              <div className="w-10" />
            </div>

            {/* Dashboard Workspace */}
            <div className="flex bg-[#fcfdfc]">
              {/* Left Slim Sidebar */}
              <div className="w-14 shrink-0 border-r border-slate-100 bg-white p-3 flex flex-col items-center gap-5">
                <div className="h-9 w-9 rounded-xl bg-[#1e7e47] flex items-center justify-center text-white shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <div className="p-2 rounded-lg bg-emerald-50 text-[#1e7e47]">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="p-2 rounded-lg hover:bg-slate-50 hover:text-slate-600">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="p-2 rounded-lg hover:bg-slate-50 hover:text-slate-600">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="p-2 rounded-lg hover:bg-slate-50 hover:text-slate-600">
                    <CalendarRange className="h-4 w-4" />
                  </div>
                  <div className="p-2 rounded-lg hover:bg-slate-50 hover:text-slate-600">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div className="p-2 rounded-lg hover:bg-slate-50 hover:text-slate-600">
                    <SlidersHorizontal className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 p-5 sm:p-7 space-y-6">
                {/* Dashboard Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                      Dashboard
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Mangsir 2081 · Nov 16 - Dec 15
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs">
                      <span>▾ This month</span>
                    </div>
                    <button className="flex items-center gap-1 rounded-lg bg-[#1e7e47] hover:bg-[#166534] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors">
                      <span>+ Generate payslip</span>
                    </button>
                  </div>
                </div>

                {/* 4 Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Card 1 */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4 text-center">
                    <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      TOTAL EMPLOYEES
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
                      1,284
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <span>↑ +18 this month</span>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4 text-center">
                    <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      PAYROLL LIABILITY
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
                      NPR 8.42 Cr
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <span>↑ +2.1% vs Kartik</span>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4 text-center">
                    <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      COMPLIANCE HEALTH
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
                      96.4%
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <span>↑ +1.2 pts MoM</span>
                    </div>
                  </div>

                  {/* Card 4 */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4 text-center">
                    <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      PENDING APPROVALS
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
                      27
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      <span>↑ 9 high priority</span>
                    </div>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left Area Chart: Monthly payroll trend */}
                  <div className="lg:col-span-7 rounded-xl border border-slate-200/80 bg-white p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                          Monthly payroll trend
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Gross vs Net (NPR Crore)
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-medium">
                        <span className="flex items-center gap-1 text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-payroll-primary-hover" />
                          Gross
                        </span>
                        <span className="flex items-center gap-1 text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-[#66bb6a]" />
                          Net
                        </span>
                      </div>
                    </div>

                    {/* SVG Area Chart */}
                    <div className="mt-4 w-full h-40">
                      <svg
                        viewBox="0 0 420 140"
                        className="w-full h-full overflow-visible"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient
                            id="grossGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#2e7d32"
                              stopOpacity="0.25"
                            />
                            <stop
                              offset="100%"
                              stopColor="#2e7d32"
                              stopOpacity="0.01"
                            />
                          </linearGradient>
                        </defs>
                        {/* Y-axis grid lines */}
                        <line
                          x1="28"
                          y1="15"
                          x2="410"
                          y2="15"
                          stroke="#f1f5f9"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1="28"
                          y1="65"
                          x2="410"
                          y2="65"
                          stroke="#f1f5f9"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1="28"
                          y1="115"
                          x2="410"
                          y2="115"
                          stroke="#f1f5f9"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />

                        {/* Y-axis labels */}
                        <text
                          x="18"
                          y="18"
                          fontSize="9"
                          fill="#94a3b8"
                          textAnchor="end"
                        >
                          100
                        </text>
                        <text
                          x="18"
                          y="68"
                          fontSize="9"
                          fill="#94a3b8"
                          textAnchor="end"
                        >
                          50
                        </text>
                        <text
                          x="18"
                          y="118"
                          fontSize="9"
                          fill="#94a3b8"
                          textAnchor="end"
                        >
                          0
                        </text>

                        {/* Shaded Area under Gross */}
                        <path
                          d="M 35,58 C 110,56 180,54 260,50 C 330,48 370,44 410,42 L 410,115 L 35,115 Z"
                          fill="url(#grossGradient)"
                        />
                        {/* Gross Line (Dark Green) */}
                        <path
                          d="M 35,58 C 110,56 180,54 260,50 C 330,48 370,44 410,42"
                          fill="none"
                          stroke="#1b5e20"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        {/* Net Line (Lighter Green) */}
                        <path
                          d="M 35,72 C 110,70 180,68 260,65 C 330,62 370,59 410,57"
                          fill="none"
                          stroke="#66bb6a"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      {/* X-axis labels */}
                      <div className="flex justify-between text-[10px] font-medium text-slate-400 px-3 mt-1">
                        <span>Shrawan</span>
                        <span>Bhadra</span>
                        <span>Ashoj</span>
                        <span>Kartik</span>
                        <span>Mangsir</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Donut Chart: Headcount by department */}
                  <div className="lg:col-span-5 rounded-xl border border-slate-200/80 bg-white p-5 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                        Headcount by department
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        1,284 active employees
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-5 my-2">
                      {/* Donut SVG */}
                      <div className="relative w-28 h-28 shrink-0">
                        <svg
                          viewBox="0 0 36 36"
                          className="w-full h-full -rotate-90"
                        >
                          {/* Background circle */}
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#f1f5f9"
                            strokeWidth="4"
                          />
                          {/* Engineering segment: ~35% */}
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#1e7e47"
                            strokeWidth="4"
                            strokeDasharray="31 88"
                            strokeDashoffset="0"
                          />
                          {/* Operations segment: ~28% */}
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#34a853"
                            strokeWidth="4"
                            strokeDasharray="25 88"
                            strokeDashoffset="-32"
                          />
                          {/* Field Sales segment: ~23% */}
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#66bb6a"
                            strokeWidth="4"
                            strokeDasharray="20 88"
                            strokeDashoffset="-58"
                          />
                          {/* Finance segment: ~14% */}
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#a5d6a7"
                            strokeWidth="4"
                            strokeDasharray="12 88"
                            strokeDashoffset="-79"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-xs font-bold text-slate-900">
                            1,284
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium -mt-0.5">
                            Active
                          </span>
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <span className="h-2 w-2 rounded-full bg-[#1e7e47]" />
                            Engineering
                          </span>
                          <span className="font-bold text-slate-800">312</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <span className="h-2 w-2 rounded-full bg-[#34a853]" />
                            Operations
                          </span>
                          <span className="font-bold text-slate-800">268</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <span className="h-2 w-2 rounded-full bg-[#66bb6a]" />
                            Field Sales
                          </span>
                          <span className="font-bold text-slate-800">224</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <span className="h-2 w-2 rounded-full bg-[#a5d6a7]" />
                            Finance
                          </span>
                          <span className="font-bold text-slate-800">96</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Card: Payroll Approval Pipeline */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-5">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      Payroll approval pipeline
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      Mangsir cycle · In review
                    </span>
                  </div>

                  {/* 5-Step Stepper */}
                  <div className="flex items-center justify-between max-w-2xl mx-auto relative px-2">
                    {/* Step 1 */}
                    <div className="flex flex-col items-center gap-1.5 relative z-10">
                      <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[11px] font-medium text-slate-700">
                        Draft
                      </span>
                    </div>
                    {/* Connecting Line 1-2 */}
                    <div className="flex-1 h-0.5 bg-emerald-200 -mt-5" />

                    {/* Step 2 */}
                    <div className="flex flex-col items-center gap-1.5 relative z-10">
                      <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[11px] font-medium text-slate-700">
                        Validation
                      </span>
                    </div>
                    {/* Connecting Line 2-3 */}
                    <div className="flex-1 h-0.5 bg-emerald-200 -mt-5" />

                    {/* Step 3 */}
                    <div className="flex flex-col items-center gap-1.5 relative z-10">
                      <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[11px] font-medium text-slate-700">
                        HR Review
                      </span>
                    </div>
                    {/* Connecting Line 3-4 */}
                    <div className="flex-1 h-0.5 bg-emerald-200 -mt-5" />

                    {/* Step 4 (Active Stage) */}
                    <div className="flex flex-col items-center gap-1.5 relative z-10">
                      <div className="h-7 w-7 rounded-full bg-payroll-primary-hover text-white flex items-center justify-center text-xs font-bold shadow-xs">
                        4
                      </div>
                      <span className="text-[11px] font-bold text-payroll-primary-hover">
                        Finance
                      </span>
                    </div>
                    {/* Connecting Line 4-5 */}
                    <div className="flex-1 h-0.5 bg-slate-200 -mt-5" />

                    {/* Step 5 */}
                    <div className="flex flex-col items-center gap-1.5 relative z-10">
                      <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-400">
                        5
                      </div>
                      <span className="text-[11px] font-medium text-slate-400">
                        Locked
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Capabilities Bento Grid */}
      <section
        id="capabilities"
        className="border-t border-payroll-light bg-white py-20 scroll-mt-12"
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
                <Lock className="h-5 w-5" />
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
                  <Check className="h-3.5 w-3.5 text-purple-600" /> Secure
                  database isolation
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Statutory Compliance Engine Deep Dive */}
      <section
        id="statutory"
        className="py-20 bg-payroll-cream/70 border-t border-payroll-light scroll-mt-12"
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
                at local regulations. Aakash HRMS calculates progressive income
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
                    Aakash HRMS v1.0
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
        className="py-20 bg-white border-t border-payroll-light scroll-mt-12"
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

      {/* 7. Demo Contact Form Section (Immediately Before Footer) */}
      <section
        id="demo"
        className="pt-12 pb-10 sm:pt-14 sm:pb-12 bg-white border-t border-slate-200/80 scroll-mt-12"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left Column: Heading & Value Props */}
            <div className="lg:col-span-5 space-y-5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1e7e47]">
                GET STARTED
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                See Aakash HRMS in action
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                Book a short walkthrough and we&apos;ll show you how payroll,
                compliance and self-service fit your organization — tailored to
                Nepal&apos;s rules.
              </p>

              <div className="pt-3 space-y-3.5">
                <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 font-medium">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-600 text-emerald-600">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>A 30-minute, no-pressure product tour</span>
                </div>

                <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 font-medium">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-600 text-emerald-600">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>Nepal-specific statutory walkthrough</span>
                </div>

                <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 font-medium">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-600 text-emerald-600">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>Answers from our payroll specialists</span>
                </div>
              </div>
            </div>

            {/* Right Column: Contact Form Card */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
                {demoSubmitted ? (
                  <div className="p-6 sm:p-8 text-center space-y-4">
                    {demoResponse?.emailSent ? (
                      <>
                        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shadow-xs">
                          <Check className="h-7 w-7 stroke-[2.5]" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                          Walkthrough Request Received!
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                          Thank you,{" "}
                          <span className="font-semibold text-slate-900">
                            {demoForm.fullName || "there"}
                          </span>
                          ! Your demo inquiry has been dispatched to our product
                          team. A Nepal statutory payroll specialist will reach
                          out to you shortly.
                        </p>

                        <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 text-left max-w-md mx-auto space-y-2.5 text-xs">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                            <span className="font-medium text-slate-500">
                              Delivery Status
                            </span>
                            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full text-[11px]">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                              Dispatched to Team
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2.5 pt-1 text-slate-700">
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                                Organization
                              </span>
                              <span className="font-semibold text-slate-900 truncate block mt-0.5">
                                {demoForm.companyName}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                                Work Email
                              </span>
                              <span className="font-semibold text-slate-900 truncate block mt-0.5">
                                {demoForm.email}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                                Phone
                              </span>
                              <span className="font-semibold text-slate-900 truncate block mt-0.5">
                                {demoForm.phone}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                                Team Size
                              </span>
                              <span className="font-semibold text-slate-900 truncate block mt-0.5">
                                {demoForm.teamSize || "Not specified"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setDemoSubmitted(false);
                              setDemoResponse(null);
                              setDemoForm({
                                fullName: "",
                                email: "",
                                companyName: "",
                                teamSize: "",
                                phone: "",
                                message: "",
                              });
                              setHoneypot("");
                              setFormLoadedAt(Date.now());
                              generateCaptcha();
                            }}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer"
                          >
                            Submit another request
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mx-auto h-14 w-14 rounded-full bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-xs">
                          <Mail className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                          Walkthrough Request Ready!
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                          Thank you,{" "}
                          <span className="font-semibold text-slate-900">
                            {demoForm.fullName || "there"}
                          </span>
                          ! Your inquiry for{" "}
                          <span className="font-semibold text-slate-900">
                            {demoForm.companyName || "your organization"}
                          </span>{" "}
                          is formatted. Click below to dispatch it via your mail
                          client:
                        </p>
                        {demoResponse?.mailtoUrl && (
                          <div className="pt-2 max-w-md mx-auto">
                            <a
                              href={demoResponse.mailtoUrl}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1e7e47] hover:bg-[#166534] px-5 py-3 text-xs font-semibold text-white shadow-xs transition-colors w-full"
                            >
                              <Mail className="h-4 w-4" />
                              <span>
                                Send via Email Client ({CONTACT_EMAIL})
                              </span>
                            </a>
                          </div>
                        )}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDemoSubmitted(false);
                              setDemoResponse(null);
                              setDemoForm({
                                fullName: "",
                                email: "",
                                companyName: "",
                                teamSize: "",
                                phone: "",
                                message: "",
                              });
                              setHoneypot("");
                              setFormLoadedAt(Date.now());
                              generateCaptcha();
                            }}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                          >
                            Submit another request
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleDemoSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Full name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Your name"
                          value={demoForm.fullName}
                          onChange={(e) => {
                            setDemoForm({
                              ...demoForm,
                              fullName: e.target.value,
                            });
                            if (formErrors.fullName) {
                              setFormErrors({ ...formErrors, fullName: "" });
                            }
                          }}
                          className={cn(
                            "w-full rounded-lg border px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all",
                            formErrors.fullName
                              ? "border-rose-400 bg-rose-50/20 focus:ring-1 focus:ring-rose-400"
                              : "border-slate-200 focus:border-[#1e7e47] focus:ring-1 focus:ring-[#1e7e47]",
                          )}
                        />
                        {formErrors.fullName && (
                          <p className="mt-1 text-[11px] font-medium text-rose-600">
                            {formErrors.fullName}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Work email <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          placeholder="you@company.com"
                          value={demoForm.email}
                          onChange={(e) => {
                            setDemoForm({ ...demoForm, email: e.target.value });
                            if (formErrors.email) {
                              setFormErrors({ ...formErrors, email: "" });
                            }
                          }}
                          className={cn(
                            "w-full rounded-lg border px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all",
                            formErrors.email
                              ? "border-rose-400 bg-rose-50/20 focus:ring-1 focus:ring-rose-400"
                              : "border-slate-200 focus:border-[#1e7e47] focus:ring-1 focus:ring-[#1e7e47]",
                          )}
                        />
                        {formErrors.email && (
                          <p className="mt-1 text-[11px] font-medium text-rose-600">
                            {formErrors.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Company name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Your organization"
                        value={demoForm.companyName}
                        onChange={(e) => {
                          setDemoForm({
                            ...demoForm,
                            companyName: e.target.value,
                          });
                          if (formErrors.companyName) {
                            setFormErrors({ ...formErrors, companyName: "" });
                          }
                        }}
                        className={cn(
                          "w-full rounded-lg border px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all",
                          formErrors.companyName
                            ? "border-rose-400 bg-rose-50/20 focus:ring-1 focus:ring-rose-400"
                            : "border-slate-200 focus:border-[#1e7e47] focus:ring-1 focus:ring-[#1e7e47]",
                        )}
                      />
                      {formErrors.companyName && (
                        <p className="mt-1 text-[11px] font-medium text-rose-600">
                          {formErrors.companyName}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Team size
                        </label>
                        <select
                          value={demoForm.teamSize}
                          onChange={(e) =>
                            setDemoForm({
                              ...demoForm,
                              teamSize: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-[#1e7e47] focus:ring-1 focus:ring-[#1e7e47] focus:outline-none transition-all cursor-pointer"
                        >
                          <option value="">Select size</option>
                          <option value="1-20">1 – 20 employees</option>
                          <option value="21-100">21 – 100 employees</option>
                          <option value="101-500">101 – 500 employees</option>
                          <option value="500+">500+ employees</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Phone <span className="text-rose-500">*</span>
                        </label>
                        <PhoneInput
                          value={demoForm.phone}
                          onChange={(val) => {
                            setDemoForm({ ...demoForm, phone: val });
                            if (formErrors.phone) {
                              setFormErrors({ ...formErrors, phone: "" });
                            }
                          }}
                          hasError={!!formErrors.phone}
                          placeholder="98XXXXXXXX"
                          className="h-10 rounded-lg border-slate-200 bg-white text-xs text-slate-900 focus:ring-1 focus:ring-[#1e7e47] focus:border-[#1e7e47]"
                          selectClassName="h-10 rounded-lg border-slate-200 bg-white text-xs font-medium text-slate-800 focus:ring-1 focus:ring-[#1e7e47] focus:border-[#1e7e47]"
                        />
                        {formErrors.phone && (
                          <p className="mt-1 text-[11px] font-medium text-rose-600">
                            {formErrors.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        What would you like to explore?
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Tell us a little about your current payroll setup..."
                        value={demoForm.message}
                        onChange={(e) =>
                          setDemoForm({ ...demoForm, message: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1e7e47] focus:ring-1 focus:ring-[#1e7e47] focus:outline-none transition-all resize-none"
                      />
                    </div>

                    {/* Security Verification (Anti-Bot & Anti-Malware Protection) */}
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <ShieldCheck className="h-4 w-4 text-[#1e7e47]" />
                          <span>Security Check</span>
                          <span className="text-[10px] font-normal text-slate-500">
                            (Anti-bot verification)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={generateCaptcha}
                          className="text-[11px] text-slate-500 hover:text-[#1e7e47] flex items-center gap-1 transition-colors cursor-pointer"
                          title="Generate new question"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>New question</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 tracking-wider shadow-2xs select-none min-w-[90px] text-center">
                          {captcha.num1} + {captcha.num2} = ?
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Enter answer"
                            value={captchaAnswer}
                            onChange={(e) => {
                              setCaptchaAnswer(e.target.value);
                              if (formErrors.captchaAnswer) {
                                setFormErrors({
                                  ...formErrors,
                                  captchaAnswer: "",
                                });
                              }
                            }}
                            className={cn(
                              "w-full rounded-lg border px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all",
                              formErrors.captchaAnswer
                                ? "border-rose-400 bg-rose-50/20 focus:ring-1 focus:ring-rose-400"
                                : "border-slate-200 bg-white focus:border-[#1e7e47] focus:ring-1 focus:ring-[#1e7e47]",
                            )}
                          />
                        </div>
                      </div>
                      {formErrors.captchaAnswer && (
                        <p className="text-[11px] font-medium text-rose-600">
                          {formErrors.captchaAnswer}
                        </p>
                      )}
                    </div>

                    {/* Hidden Honeypot to trap spam bots */}
                    <div
                      className="hidden pointer-events-none opacity-0 h-0 w-0 overflow-hidden"
                      aria-hidden="true"
                    >
                      <label htmlFor="company_fax_website">Leave empty</label>
                      <input
                        type="text"
                        id="company_fax_website"
                        name="company_fax_website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingDemo}
                      className="w-full rounded-xl bg-[#1e7e47] hover:bg-[#166534] disabled:opacity-60 text-white py-3.5 text-sm font-semibold shadow-sm transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSubmittingDemo ? (
                        <span>Sending request to {CONTACT_EMAIL}...</span>
                      ) : (
                        <span>Request my demo</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Enterprise Forest Green Footer */}
      <footer className="bg-[#102214] text-white pt-9 pb-7 sm:pt-10 sm:pb-8 text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-7 lg:gap-8">
            {/* Brand Column */}
            <div className="sm:col-span-2 md:col-span-4 space-y-2.5">
              <Link
                href="/"
                className="inline-flex items-center group focus:outline-none"
              >
                <Image
                  src="/AakashHrmsLogo.png"
                  alt="Aakash HRMS - Smart People, Strong Organization"
                  width={160}
                  height={50}
                  className="h-8.5 sm:h-9 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                />
              </Link>
              <p className="text-[11.5px] text-emerald-100/70 leading-relaxed max-w-xs">
                Nepal-compliant payroll and workforce management for modern
                organizations.
              </p>
            </div>

            {/* Product Column */}
            <div className="md:col-span-3 space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                PRODUCT
              </h4>
              <ul className="space-y-2 text-[11.5px] text-emerald-100/70">
                <li>
                  <a
                    href="#capabilities"
                    className="hover:text-white transition-colors"
                  >
                    Platform Features
                  </a>
                </li>
                <li>
                  <a
                    href="#workflow"
                    className="hover:text-white transition-colors"
                  >
                    Payroll Workflow
                  </a>
                </li>
                <li>
                  <a
                    href="#statutory"
                    className="hover:text-white transition-colors"
                  >
                    Statutory Engine
                  </a>
                </li>
                <li>
                  <Link
                    href="/self-service"
                    className="hover:text-white transition-colors"
                  >
                    Self-Service Portal
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company Column */}
            <div className="md:col-span-2 space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                COMPANY
              </h4>
              <ul className="space-y-2 text-[11.5px] text-emerald-100/70">
                <li>
                  <a
                    href="#capabilities"
                    className="hover:text-white transition-colors"
                  >
                    About Platform
                  </a>
                </li>
                <li>
                  <a
                    href="#demo"
                    className="hover:text-white transition-colors"
                  >
                    Request a Demo
                  </a>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="hover:text-white transition-colors"
                  >
                    Portal Sign In
                  </Link>
                </li>
                <li>
                  <a
                    href="#capabilities"
                    className="hover:text-white transition-colors"
                  >
                    Security & Privacy
                  </a>
                </li>
              </ul>
            </div>

            {/* Get In Touch Column */}
            <div className="sm:col-span-2 md:col-span-3 space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                GET IN TOUCH
              </h4>
              <ul className="space-y-2 text-[11.5px] text-emerald-100/70">
                <li>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="inline-flex items-center gap-2 hover:text-white transition-colors underline-offset-2 hover:underline"
                    title={`Send email to ${CONTACT_EMAIL}`}
                  >
                    <Mail className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>{CONTACT_EMAIL}</span>
                  </a>
                </li>
                <li className="flex items-center gap-2 flex-wrap text-emerald-100/90">
                  <Phone className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <a
                    href="tel:+97761590067"
                    className="hover:text-white transition-colors underline-offset-2 hover:underline font-medium"
                    title="Click to call 061-590067"
                  >
                    061-590067
                  </a>
                  <span className="text-emerald-400/50">/</span>
                  <a
                    href="tel:+97761591388"
                    className="hover:text-white transition-colors underline-offset-2 hover:underline font-medium"
                    title="Click to call 061-591388"
                  >
                    061-591388
                  </a>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
                  <span className="block text-emerald-100/70">
                    Pokhara, Kaski, Nepal
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Divider and Copyright Bar */}
          <div className="mt-8 border-t border-emerald-900/60 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-emerald-100/60 text-[11px]">
            <p>© 2026 Aakash HRMS. All rights reserved.</p>
            <p className="font-medium text-emerald-100/80">Made in Nepal 🇳🇵</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
