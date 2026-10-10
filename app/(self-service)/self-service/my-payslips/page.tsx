import React from "react";
import { getMyPayslips } from "@/lib/services/self-service.service";
import { FileText, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PayslipsClientList } from "@/components/self-service/payslips-client-list";

import { essLang } from "@/lib/i18n/ess-server";
import { t } from "@/lib/i18n/ess";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Payslips | Self-Service Portal",
  description: "View itemized monthly salary payslips and deductions",
};

export default async function MyPayslipsPage() {
  const lang = await essLang();
  let payslips;
  try {
    payslips = await getMyPayslips();
  } catch (error: any) {
    return (
      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
        <CardContent className="py-16">
          <EmptyState
            icon={<Wallet className="h-10 w-10 text-payroll-primary" />}
            title="Payslips Unavailable"
            description={error?.message || "Failed to load salary payslips. Please contact HR."}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-payroll-navy tracking-tight">
            {t(lang, "payslips.title")}
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
            {t(lang, "payslips.description")}
          </p>
        </div>

        <span className="text-xs font-bold text-gray-500 bg-payroll-cream px-3 py-1.5 rounded-xl border border-payroll-light">
          {payslips.length} {t(lang, "payslips.count")}
        </span>
      </div>

      {payslips.length === 0 ? (
        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="py-16">
            <EmptyState
              icon={<FileText className="h-10 w-10 text-payroll-primary" />}
              title="No payslips generated yet"
              description="Your salary slips will be automatically generated and made available here once monthly payroll is approved and disbursed."
            />
          </CardContent>
        </Card>
      ) : (
        <PayslipsClientList payslips={payslips} />
      )}
    </div>
  );
}
