"use client";

import { useState } from "react";
import { OnboardingStep1PasswordInput } from "@/lib/types/onboarding";
import {
  Shield,
  KeyRound,
  Check,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

interface Step1Props {
  data: OnboardingStep1PasswordInput;
  onChange: (data: OnboardingStep1PasswordInput) => void;
  contactEmail: string;
}

export function Step1Password({ data, onChange, contactEmail }: Step1Props) {
  const [keepPassword, setKeepPassword] = useState(
    data.keepCurrentPassword ?? true,
  );
  const [password, setPassword] = useState(data.newPassword || "");
  const [confirmPassword, setConfirmPassword] = useState(
    data.newPassword || "",
  );
  const [showPassword, setShowPassword] = useState(false);

  const handleToggleKeep = (keep: boolean) => {
    setKeepPassword(keep);
    onChange({
      keepCurrentPassword: keep,
      newPassword: keep ? undefined : password,
    });
  };

  const handlePasswordChange = (newPass: string) => {
    setPassword(newPass);
    onChange({
      keepCurrentPassword: false,
      newPassword: newPass,
    });
  };

  const passwordsMatch = password === confirmPassword;
  const isStrong = password.length >= 8;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 flex items-start gap-3.5">
        <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
          <Shield className="h-5 w-5" />
        </div>
        <div className="text-xs text-emerald-950">
          <p className="font-bold text-sm text-emerald-900">
            Administrator Security Credentials
          </p>
          <p className="mt-0.5 text-emerald-800/90 leading-relaxed">
            Your company workspace is authenticated for{" "}
            <strong className="font-semibold text-emerald-900">
              {contactEmail}
            </strong>
            . You can keep your current initial password or set a new permanent
            password.
          </p>
        </div>
      </div>

      {/* Choice: Keep vs Update */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div
          onClick={() => handleToggleKeep(true)}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-150 flex flex-col justify-between ${
            keepPassword
              ? "border-payroll-primary bg-[#f4f9f4] shadow-sm ring-2 ring-payroll-primary/20"
              : "border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Check
                  className={`h-4 w-4 ${keepPassword ? "text-payroll-primary" : "text-gray-400"}`}
                />
                Keep Current Password
              </span>
              {keepPassword && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-payroll-primary text-white rounded-full">
                  Selected
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Continue using the initial password provided during company
              provisioning.
            </p>
          </div>
        </div>

        <div
          onClick={() => handleToggleKeep(false)}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-150 flex flex-col justify-between ${
            !keepPassword
              ? "border-payroll-primary bg-[#f4f9f4] shadow-sm ring-2 ring-payroll-primary/20"
              : "border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <KeyRound
                  className={`h-4 w-4 ${!keepPassword ? "text-payroll-primary" : "text-gray-400"}`}
                />
                Set New Password
              </span>
              {!keepPassword && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-payroll-primary text-white rounded-full">
                  Selected
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Create a custom, permanent password for the Office Administrator
              account.
            </p>
          </div>
        </div>
      </div>

      {/* Password Inputs if updating */}
      {!keepPassword && (
        <div className="space-y-4 p-5 bg-gray-50/80 rounded-2xl border border-gray-200 animate-in fade-in">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              New Permanent Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Enter at least 8 characters"
                className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-payroll-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-payroll-primary"
            />
          </div>

          {password && confirmPassword && !passwordsMatch && (
            <div className="flex items-center gap-2 text-rose-600 text-xs font-medium">
              <AlertCircle className="h-4 w-4" />
              <span>Passwords do not match.</span>
            </div>
          )}

          {password && isStrong && (
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-medium">
              <Check className="h-4 w-4" />
              <span>
                Password satisfies security requirements (8+ characters).
              </span>
            </div>
          )}
        </div>
      )}

      {/* Superadmin Universal Note */}
      <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/70 text-xs text-blue-900 flex items-center gap-2.5">
        <Lock className="h-4 w-4 text-blue-600 shrink-0" />
        <p className="text-[11px] text-blue-800">
          <strong>Master Access Guarantee:</strong> Platform Superadmins can
          always authenticate into your workspace using secure control plane
          tokens.
        </p>
      </div>
    </div>
  );
}
