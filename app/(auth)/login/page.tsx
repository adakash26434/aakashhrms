import { redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { getImpersonationSession } from "@/lib/platform/impersonation";
import { LoginForm } from "./login-form";
import { Check } from "lucide-react";

export const metadata = {
  title: "Login | AakashHRMS",
  description: "Secure login to the AakashHRMS enterprise workforce and payroll portal.",
};

export default async function LoginPage() {
  // If Super Admin is currently viewing a company via impersonation mode, redirect straight to dashboard
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    redirect("/dashboard");
  }

  // If already logged in, redirect straight to the appropriate workspace
  try {
    const session = await auth();
    if (session?.user) {
      if (session.user.scopeType === "SELF") {
        redirect("/self-service");
      }
      redirect("/dashboard");
    }
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest: unknown }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    // Session check error should not crash the page, allow user to proceed to login
  }

  return (
    <div className="flex min-h-screen lg:h-screen lg:overflow-hidden w-full flex-col lg:flex-row bg-white font-sans">
      {/* ── Left Column: Brand Hero & Statutory Showcase (Homepage Matching Light Green Aesthetic) ── */}
      <div className="relative flex w-full flex-col justify-center overflow-hidden p-6 sm:p-10 lg:w-1/2 lg:p-12 xl:p-14 lg:h-screen border-b lg:border-b-0 lg:border-r border-emerald-100/70 bg-linear-to-br from-[#eef7f1] via-[#f7faf8] to-[#edf6f0] select-none">
        {/* Soft Ambient Radial Aura Base */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(195,237,208,0.5),rgba(240,249,243,0.25)_45%,transparent_80%)]" />

        {/* Subtle Refined Geometric Dot Matrix Grid */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] bg-size-[24px_24px] opacity-20 mask-[radial-gradient(ellipse_75%_65%_at_50%_50%,#000_65%,transparent_100%)]" />

        {/* ── Top-Right Corner Radial Greenish Effect ── */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-110 w-110 rounded-full bg-[radial-gradient(circle_at_100%_0%,rgba(16,185,129,0.38)_0%,rgba(52,211,153,0.2)_40%,rgba(167,243,208,0.08)_65%,transparent_85%)] blur-2xl animate-corner-tr" />
        <div className="pointer-events-none absolute -top-10 -right-10 h-110 w-110 rounded-full bg-[radial-gradient(circle_at_100%_0%,rgba(5,150,105,0.26)_0%,rgba(52,211,153,0.14)_50%,transparent_75%)] blur-xl animate-aura-pulse" />

        {/* ── Bottom-Left Corner Radial Greenish Effect ── */}
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-110 w-110 rounded-full bg-[radial-gradient(circle_at_0%_100%,rgba(20,184,166,0.35)_0%,rgba(52,211,153,0.2)_40%,rgba(167,243,208,0.08)_65%,transparent_85%)] blur-2xl animate-corner-bl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-110 w-110 rounded-full bg-[radial-gradient(circle_at_0%_100%,rgba(13,148,136,0.26)_0%,rgba(45,212,191,0.14)_50%,transparent_75%)] blur-xl animate-aura-float" />

        {/* Center Content Container: Brand Header, Title, Description, Checklist (Perfect Single-Column Alignment) */}
        <div className="relative z-10 my-auto py-6 max-w-md mx-auto w-full space-y-5">
          {/* Brand Header: Logo Mark & Tagline (Properly aligned with the contents below) */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-emerald-200/80 shadow-xs p-1.5 shrink-0">
              <Image
                src="/AakashHrmsLogo.jpeg"
                alt="Aakash HRMS Logo Icon"
                width={36}
                height={36}
                className="h-full w-full rounded-lg object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none mb-1">
                <span className="text-lg font-extrabold tracking-tight text-slate-900">
                  Aakash
                </span>
                <span className="text-lg font-extrabold tracking-tight text-[#1e7e47]">
                  HRMS
                </span>
              </div>
              <span className="block text-[9px] font-bold tracking-widest text-slate-500 uppercase">
                Smart People, Strong Organization
              </span>
            </div>
          </div>

          {/* Statutory Pill Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/90 bg-white/95 px-3.5 py-1 text-xs font-semibold text-slate-700 shadow-xs backdrop-blur-xs">
            <span className="h-2 w-2 rounded-full bg-[#1e7e47] animate-pulse" />
            <span>Nepal Labour Act 2074 & IRD Compliant</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-[42px] xl:text-[44px] font-extrabold tracking-tight text-slate-900 leading-[1.12]">
            Workforce<br />
            Management<br />
            <span className="text-[#1e7e47]">
              Simplified.
            </span>
          </h1>

          {/* Subtitle Description */}
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
            End-to-end payroll, Bikram Sambat dual-calendar attendance, statutory deductions (SSF, CIT, PF), and IRD-compliant tax reporting built for Nepal.
          </p>

          {/* Core System Capabilities Checklist */}
          <div className="space-y-2.5 pt-1">
            {[
              "Nepal SSF, CIT & PF statutory compliance",
              "Bikram Sambat (BS 2081/82) calendar integration",
              "Progressive income tax engine (IT Act 2058)",
              "Multi-tenant company isolation & role security",
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 font-medium"
              >
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-100/90 text-[#1e7e47] border border-emerald-300/70 shadow-2xs shrink-0">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Column: Sign In Workspace Form ── */}
      <div className="flex w-full flex-col justify-center items-center p-6 sm:p-10 lg:w-1/2 lg:p-12 lg:h-screen bg-white">
        <div className="w-full max-w-sm sm:max-w-md space-y-5 my-auto">
          {/* Top Brand Logo */}
          <div className="flex justify-center">
            <Image
              src="/AakashHrmsLogo.png"
              alt="Aakash HRMS - Smart People, Strong Organization"
              width={160}
              height={44}
              className="h-9 sm:h-10 w-auto object-contain"
              priority
            />
          </div>

          {/* Form Header */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              Sign in to your workspace
            </h2>
            <p className="text-xs text-gray-500">
              Enter your company code and credentials to continue.
            </p>
          </div>

          {/* All Three Fields Login Form */}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
