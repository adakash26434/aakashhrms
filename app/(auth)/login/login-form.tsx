"use client";

import { useState, useActionState, useEffect } from "react";
import { loginAction } from "@/app/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

type LoginStep = "company" | "credentials";

interface ResolvedCompany {
  displayName: string;
  slug: string;
}

export function LoginForm() {
  const [step, setStep] = useState<LoginStep>("company");
  const [companyCode, setCompanyCode] = useState("");
  const [resolvedCompany, setResolvedCompany] =
    useState<ResolvedCompany | null>(null);
  const [companyError, setCompanyError] = useState("");
  const [isResolvingCompany, setIsResolvingCompany] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(loginAction, undefined);

  // Auto-format company code as user types (uppercase, add CMP- prefix)
  const handleCompanyCodeChange = (value: string) => {
    // Allow user to type with or without the CMP- prefix
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    setCompanyCode(cleaned);
    setCompanyError("");
  };

  const handleResolveCompany = async () => {
    if (!companyCode.trim()) {
      setCompanyError("Please enter your company code.");
      return;
    }

    // Normalize: add CMP- prefix if user forgot it
    let code = companyCode.trim().toUpperCase();
    if (!code.startsWith("CMP-")) {
      code = `CMP-${code}`;
      setCompanyCode(code);
    }

    setIsResolvingCompany(true);
    setCompanyError("");

    try {
      const res = await fetch("/api/auth/resolve-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyCode: code }),
      });

      const data = await res.json();

      if (data.success) {
        setResolvedCompany(data.company);
        setStep("credentials");
      } else {
        setCompanyError(data.error || "Company not found.");
      }
    } catch {
      setCompanyError("Unable to verify company code. Please try again.");
    } finally {
      setIsResolvingCompany(false);
    }
  };

  const handleBackToCompany = () => {
    setStep("company");
    setResolvedCompany(null);
    setCompanyError("");
  };

  // Handle "Enter" key on company code input
  const handleCompanyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleResolveCompany();
    }
  };

  // STEP 1: Company Code Entry
  if (step === "company") {
    return (
      <div className="space-y-6">
        <div>
          <label
            className="mb-2 block text-sm font-medium text-gray-700"
            htmlFor="companyCode"
          >
            Company Code
          </label>
          <input
            id="companyCode"
            type="text"
            value={companyCode}
            onChange={(e) => handleCompanyCodeChange(e.target.value)}
            onKeyDown={handleCompanyKeyDown}
            placeholder="e.g. CMP-1111AF"
            autoFocus
            autoComplete="off"
            className="h-11 w-full rounded-lg border border-payroll-light bg-white px-4 text-sm text-payroll-navy font-mono tracking-wider uppercase focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary placeholder:text-gray-400 placeholder:normal-case placeholder:tracking-normal placeholder:font-sans"
          />
          <p className="mt-1.5 text-xs text-gray-400">
            Enter the company code provided by your organization (e.g., CMP-1111AF).
          </p>
        </div>

        {companyError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
            {companyError}
          </div>
        )}

        <Button
          type="button"
          onClick={handleResolveCompany}
          className="w-full h-11"
          disabled={isResolvingCompany || !companyCode.trim()}
        >
          {isResolvingCompany ? "Verifying..." : "Continue"}
        </Button>
      </div>
    );
  }

  // STEP 2: Email & Password (company resolved)
  return (
    <div className="space-y-6">
      {/* Company Badge */}
      {resolvedCompany && (
        <div className="flex items-center justify-between rounded-lg bg-[#f0f7ef] border border-payroll-light px-4 py-3">
          <div>
            <p className="text-xs text-gray-500 font-medium">Signing in to</p>
            <p className="text-sm font-bold text-payroll-navy">
              {resolvedCompany.displayName}
            </p>
          </div>
          <button
            type="button"
            onClick={handleBackToCompany}
            className="text-xs text-payroll-primary hover:text-payroll-navy font-medium underline underline-offset-2 transition-colors"
          >
            Change
          </button>
        </div>
      )}

      <form action={formAction} className="space-y-5">
        {/* Hidden company code field — passed to the server action */}
        <input type="hidden" name="companyCode" value={companyCode} />

        <div>
          <label
            className="mb-2 block text-sm font-medium text-gray-700"
            htmlFor="email"
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            placeholder="you@company.com"
            className="h-11 w-full rounded-lg border border-payroll-light bg-white px-4 text-sm text-payroll-navy focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
          />
        </div>

        <div>
          <label
            className="mb-2 block text-sm font-medium text-gray-700"
            htmlFor="password"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              className="h-11 w-full rounded-lg border border-payroll-light bg-white pl-4 pr-11 text-sm text-payroll-navy focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer p-1 rounded-md transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-500" />
              ) : (
                <Eye className="h-5 w-5 text-gray-500" />
              )}
            </button>
          </div>
        </div>

        {state?.error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
            {state.error}
          </div>
        )}

        <Button type="submit" className="w-full h-11" disabled={isPending}>
          {isPending ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </div>
  );
}
