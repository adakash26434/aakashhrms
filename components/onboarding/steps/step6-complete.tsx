"use client";

import { FullOnboardingPayload } from "@/lib/types/onboarding";
import {
  CheckCircle2,
  Sparkles,
  Building,
  MapPin,
  Calendar,
  Palmtree,
  ArrowRight,
  Shield,
} from "lucide-react";

interface Step6Props {
  payload: FullOnboardingPayload;
}

export function Step6Complete({ payload }: Step6Props) {
  const { step2, step3, step4, step5 } = payload;

  return (
    <div className="space-y-6 text-center">
      {/* Celebration Header */}
      <div className="py-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-payroll-primary shadow-sm mb-3.5">
          <Sparkles className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">
          Setup Verification & Ready to Launch!
        </h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
          Review your organization's configuration summary below. Clicking
          "Launch Dashboard" will finalize your isolated workspace.
        </p>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
        {/* Company & Fiscal Year */}
        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">
            <Building className="h-4 w-4 text-payroll-primary" />
            <span>Organization Master</span>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-900">{step2.legalName}</p>
            <p>Email: {step2.contactEmail}</p>
            <p>
              Industry Sector:{" "}
              <strong className="text-gray-900">{step2.industryType || "General"}</strong>
            </p>
            <p>
              Fiscal Year:{" "}
              <strong className="text-gray-900">{step2.fiscalYearLabel}</strong>
            </p>
            <p>Currency: {step2.currency}</p>
          </div>
        </div>

        {/* Head Office Branch & Structure */}
        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">
            <MapPin className="h-4 w-4 text-payroll-primary" />
            <span>Primary Branch & Departments</span>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-900">
              {step3.branchName} ({step3.branchCode})
            </p>
            <p>Location: {step3.branchLocation}</p>
            <p>
              Departments:{" "}
              <strong className="text-gray-900">
                {step3.departments.length} configured
              </strong>
            </p>
            <p>Designations: {step3.designations.length} standard roles</p>
          </div>
        </div>

        {/* Statutory Leaves & OT */}
        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">
            <Palmtree className="h-4 w-4 text-payroll-primary" />
            <span>Statutory Policies (Nepal Labour Act)</span>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <p>
              Leave Types:{" "}
              <strong className="text-gray-900">
                {step4.leaveTypes.length} statutory types
              </strong>
            </p>
            <p>
              Overtime Rate:{" "}
              <strong className="text-gray-900">
                {step4.otHourlyMultiplier}x hourly wage
              </strong>
            </p>
            <p>Encashment: Basic daily wage rate</p>
          </div>
        </div>

        {/* Pay Heads & Tax */}
        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">
            <Shield className="h-4 w-4 text-payroll-primary" />
            <span>Pay Heads & Tax Compliance</span>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <p>
              Pay Heads:{" "}
              <strong className="text-gray-900">
                {step5.payHeads.length} active heads
              </strong>
            </p>
            <p>Statutory Deductions: SSF (11%+20%), CIT, EPF, TDS</p>
            <p>Tax Slabs: Married & Single progressive brackets</p>
          </div>
        </div>
      </div>
    </div>
  );
}
