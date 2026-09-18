"use client";

import { useState, useActionState } from "react";
import { loginAction } from "@/app/actions/auth.actions";
import { Eye, EyeOff, ArrowRight, Loader2, AlertCircle, HelpCircle, X, Mail } from "lucide-react";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [companyDigits, setCompanyDigits] = useState("");
  const [state, formAction, isPending] = useActionState(loginAction, undefined);

  // Strip any 'CMP-' or 'CMP' prefix so user only ever enters/sees the digits
  const handleCompanyDigitsChange = (value: string) => {
    const cleaned = value.replace(/^CMP-?/i, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    setCompanyDigits(cleaned);
  };

  return (
    <div className="w-full space-y-4">
      {/* Error Alert */}
      {state?.error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200/80 p-3 text-xs font-medium text-red-700 animate-fadeIn">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
          <span>{state.error}</span>
        </div>
      )}

      <form action={formAction} className="space-y-3.5">
        {/* Field 1: Company Code (Fixed CMP- Prefix) */}
        <div>
          <label
            htmlFor="companyDigits"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Company Code
          </label>
          {/* Hidden full company code passed to server action */}
          <input
            type="hidden"
            name="companyCode"
            value={companyDigits ? `CMP-${companyDigits}` : ""}
          />
          <div className="flex rounded-lg shadow-2xs">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 px-3.5 text-xs font-mono font-bold text-gray-500 select-none">
              CMP-
            </span>
            <input
              id="companyDigits"
              type="text"
              required
              autoFocus
              autoComplete="organization"
              value={companyDigits}
              onChange={(e) => handleCompanyDigitsChange(e.target.value)}
              placeholder="100001"
              className="h-10 sm:h-11 w-full rounded-r-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 font-mono tracking-wider uppercase placeholder:normal-case placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-400 focus:border-payroll-primary focus:outline-none focus:ring-2 focus:ring-payroll-primary/20 transition-all"
            />
          </div>
        </div>

        {/* Field 2: Email Address */}
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            className="h-10 sm:h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-payroll-primary focus:outline-none focus:ring-2 focus:ring-payroll-primary/20 transition-all"
          />
        </div>

        {/* Field 3: Password */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-gray-700"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className="h-10 sm:h-11 w-full rounded-lg border border-gray-200 bg-white pl-3 pr-11 text-sm text-gray-900 placeholder:text-gray-400 focus:border-payroll-primary focus:outline-none focus:ring-2 focus:ring-payroll-primary/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer p-1 rounded-md transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-gray-500" />
              ) : (
                <Eye className="h-4 w-4 text-gray-500" />
              )}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full h-10 sm:h-11 mt-1.5 rounded-lg bg-payroll-primary hover:bg-payroll-navy text-white text-sm font-bold shadow-md shadow-payroll-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Signing In...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Support Help Text */}
      <div className="text-center pt-1">
        <p className="text-xs text-gray-500">
          Need help?{" "}
          <a
            href="mailto:support@aakashhrms.com"
            className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline transition-colors"
          >
            support@aakashhrms.com
          </a>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Password Assistance
                </h3>
                <p className="text-xs text-gray-500">
                  Credential recovery instructions
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-200/70 p-4 text-xs text-gray-600 space-y-2 leading-relaxed">
              <p>
                To maintain enterprise security, employee password resets must be initiated by your company&apos;s Human Resources or System Administrator.
              </p>
              <p>
                If you are a Workspace Administrator or Organization Owner locked out of your account, please contact technical support with your organization details.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <a
                href="mailto:support@aakashhrms.com?subject=Workspace%20Password%20Reset%20Request"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                Contact Support
              </a>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-black transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
