"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { useState } from "react";

interface OnboardingBannerProps {
  isCompleted: boolean;
}

export function OnboardingBanner({ isCompleted }: OnboardingBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (isCompleted || dismissed) return null;

  return (
    <div className="p-4 rounded-2xl bg-linear-to-r from-emerald-800 to-emerald-950 text-white shadow-md border border-emerald-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-3.5">
        <div className="p-2.5 rounded-xl bg-white/10 text-emerald-300 backdrop-blur-xs shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white">Initial Organization Setup Pending</h4>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-400 text-gray-900 rounded-full">
              Setup Required
            </span>
          </div>
          <p className="text-xs text-emerald-100/90 mt-0.5 max-w-2xl">
            Configure your active BS fiscal year, primary operating branch, departments, Nepal Labour Act statutory leaves, and pay heads to activate your full payroll engine.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-white text-emerald-950 rounded-xl hover:bg-emerald-50 transition-all shadow-sm"
        >
          <span>Complete Setup Wizard</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-2 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10"
          title="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
