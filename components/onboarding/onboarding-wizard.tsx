"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  OnboardingStatus,
  FullOnboardingPayload,
  DEFAULT_NEPAL_LEAVE_TYPES,
  DEFAULT_DEPARTMENTS,
  DEFAULT_DESIGNATIONS,
  DEFAULT_PAY_HEADS,
} from "@/lib/types/onboarding";
import { completeFullOnboardingAction } from "@/app/actions/onboarding.actions";
import { Step1Password } from "./steps/step1-password";
import { Step2CompanyProfile } from "./steps/step2-company-profile";
import { Step3OrgStructure } from "./steps/step3-org-structure";
import { Step4LeaveOt } from "./steps/step4-leave-ot";
import { Step5PayHeadsTax } from "./steps/step5-payheads-tax";
import { Step6Complete } from "./steps/step6-complete";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  KeyRound,
  Building,
  Users,
  Palmtree,
  Coins,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { getAvailableFiscalYearPresets } from "@/lib/utils/fiscal-year-presets";

interface WizardProps {
  initialStatus: OnboardingStatus;
}

const STEPS = [
  { id: 1, label: "Security & Login", icon: KeyRound },
  { id: 2, label: "Company Profile", icon: Building },
  { id: 3, label: "Org Structure", icon: Users },
  { id: 4, label: "Statutory Leaves", icon: Palmtree },
  { id: 5, label: "Pay Heads & Tax", icon: Coins },
  { id: 6, label: "Launch Workspace", icon: CheckCircle2 },
];

export function OnboardingWizard({ initialStatus }: WizardProps) {
  const router = useRouter();
  // For any pending onboarding, always start at Step 1 (Security & Login)
  const [currentStep, setCurrentStep] = useState(
    initialStatus.isCompleted ? 6 : 1
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Initialize Full Payload State with intelligent dynamic defaults
  const [payload, setPayload] = useState<FullOnboardingPayload>(() => {
    const loc = initialStatus.registeredCity || "Kathmandu";
    const compName = initialStatus.companyName || "My Organization";
    const { current: defaultFy } = getAvailableFiscalYearPresets();

    return {
      step1: {
        keepCurrentPassword: !initialStatus.mustChangePassword,
        newPassword: "",
      },
      step2: {
        legalName: compName,
        panVatNumber: "",
        registrationNumber: "",
        contactPhone: initialStatus.contactPhone || "",
        contactEmail: initialStatus.contactEmail || "",
        officeAddress: loc ? `${loc}, Nepal` : "Kathmandu, Nepal",
        currency: "NPR",
        fiscalYearLabel: defaultFy.label,
        fiscalYearSlug: defaultFy.slug,
        startDateBS: defaultFy.startDateBS,
        endDateBS: defaultFy.endDateBS,
        startDateAD: defaultFy.startDateAD,
        endDateAD: defaultFy.endDateAD,
      },
      step3: {
        branchName: `${compName} Head Office`,
        branchCode: "HO-01",
        branchLocation: loc ? `${loc} Central Office` : "Main Office",
        branchPhone: initialStatus.contactPhone || "+977-1-4XXXXXX",
        branchEmail: initialStatus.contactEmail || "info@company.com",
        departments: DEFAULT_DEPARTMENTS,
        designations: DEFAULT_DESIGNATIONS,
      },
      step4: {
        leaveTypes: DEFAULT_NEPAL_LEAVE_TYPES,
        otHourlyMultiplier: 1.5,
      },
      step5: {
        payHeads: DEFAULT_PAY_HEADS,
      },
    };
  });

  const handleNext = () => {
    setError(null);

    // Basic Validation per step
    if (currentStep === 1) {
      if (
        !payload.step1.keepCurrentPassword &&
        (!payload.step1.newPassword || payload.step1.newPassword.length < 8)
      ) {
        setError(
          "Please enter a new password of at least 8 characters, or select 'Keep Current Password'.",
        );
        return;
      }
    } else if (currentStep === 2) {
      if (!payload.step2.legalName.trim()) {
        setError("Legal company name is required.");
        return;
      }
      if (!payload.step2.contactEmail.trim()) {
        setError("Contact email is required.");
        return;
      }
    } else if (currentStep === 3) {
      if (!payload.step3.branchName.trim()) {
        setError("Primary branch name is required.");
        return;
      }
      if (!payload.step3.branchLocation.trim()) {
        setError("Operating location is required.");
        return;
      }
    }

    if (currentStep < 6) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Final Finish
      handleFinish();
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    setError(null);
    startTransition(async () => {
      const res = await completeFullOnboardingAction(payload);
      if (res.success) {
        // Redirect to main dashboard
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(res.error || "Failed to complete setup.");
      }
    });
  };

  const progressPercent = Math.round(
    ((currentStep - 1) / (STEPS.length - 1)) * 100,
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Top Brand & Wizard Stepper ── */}
      <div className="text-center space-y-1.5 pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 text-payroll-primary rounded-full text-xs font-bold mb-1">
          <Sparkles className="h-3.5 w-3.5" />
          <span>First-Time Organization Onboarding</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome to{" "}
          <span className="text-payroll-primary">
            {payload.step2.legalName || "AakashHRMS"}
          </span>
        </h2>
        <p className="text-xs text-gray-500 max-w-lg mx-auto">
          Configure your organization's essential parameters in 6 guided steps.
        </p>
      </div>

      {/* ── Visual Stepper Navigation ── */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="grid grid-cols-6 gap-2">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.id;
            const isCurrent = currentStep === s.id;

            return (
              <div
                key={s.id}
                onClick={() => {
                  if (s.id < currentStep) setCurrentStep(s.id);
                }}
                className={`flex flex-col items-center text-center p-2 rounded-xl transition-all ${
                  isCurrent
                    ? "bg-payroll-cream border border-payroll-light"
                    : s.id < currentStep
                      ? "cursor-pointer hover:bg-gray-50"
                      : "opacity-40"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 transition-colors ${
                    isCurrent
                      ? "bg-payroll-primary text-white shadow-sm"
                      : isCompleted
                        ? "bg-emerald-100 text-payroll-primary"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span className="text-[11px] font-bold text-gray-800 leading-tight line-clamp-1">
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-payroll-primary h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ── Active Step Card Container ── */}
      <Card className="border-gray-200 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Render Step View */}
          {currentStep === 1 && (
            <Step1Password
              data={payload.step1}
              onChange={(s1) => setPayload({ ...payload, step1: s1 })}
              contactEmail={initialStatus.contactEmail}
            />
          )}

          {currentStep === 2 && (
            <Step2CompanyProfile
              data={payload.step2}
              onChange={(s2) => setPayload({ ...payload, step2: s2 })}
            />
          )}

          {currentStep === 3 && (
            <Step3OrgStructure
              data={payload.step3}
              onChange={(s3) => setPayload({ ...payload, step3: s3 })}
            />
          )}

          {currentStep === 4 && (
            <Step4LeaveOt
              data={payload.step4}
              onChange={(s4) => setPayload({ ...payload, step4: s4 })}
            />
          )}

          {currentStep === 5 && (
            <Step5PayHeadsTax
              data={payload.step5}
              onChange={(s5) => setPayload({ ...payload, step5: s5 })}
              fiscalYearLabel={payload.step2.fiscalYearLabel}
            />
          )}

          {currentStep === 6 && <Step6Complete payload={payload} />}

          {/* ── Step Action Controls ── */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || isPending}
              className="text-xs text-gray-700"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Previous Step
            </Button>

            <Button
              type="button"
              onClick={handleNext}
              disabled={isPending}
              className="bg-payroll-primary hover:bg-[#256629] text-white text-xs font-bold shadow-sm"
            >
              {isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Finalizing Workspace...</span>
                </div>
              ) : currentStep === 6 ? (
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Launch Dashboard</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Continue</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
