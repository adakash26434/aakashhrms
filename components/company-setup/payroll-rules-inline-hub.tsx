"use client";

import React from "react";
import {
  PayrollRulesHubClient,
  type PayrollRuleTab,
} from "@/components/setup/payroll-rules-hub-client";
import type { FiscalYearData } from "@/lib/types/fiscal-year";
import type { TaxRateData } from "@/lib/types/tax-rate";
import type { PayHeadData } from "@/lib/types/pay-head";
import type { SystemControlData } from "@/lib/types/system-control";

interface PayrollRulesInlineHubProps {
  initialTab?: string;
  allowedTabs: PayrollRuleTab[];
  fiscalYearData?: FiscalYearData | null;
  taxRateData?: TaxRateData | null;
  payHeadData?: PayHeadData | null;
  systemControlData?: SystemControlData | null;
  isSuperAdmin?: boolean;
  onSubTabChange?: (tab: PayrollRuleTab) => void;
}

export function PayrollRulesInlineHub({
  initialTab,
  allowedTabs,
  fiscalYearData,
  taxRateData,
  payHeadData,
  systemControlData,
  isSuperAdmin,
  onSubTabChange,
}: PayrollRulesInlineHubProps) {
  return (
    <PayrollRulesHubClient
      embedded={true}
      initialTab={initialTab}
      allowedTabs={allowedTabs}
      fiscalYearData={fiscalYearData}
      taxRateData={taxRateData}
      payHeadData={payHeadData}
      systemControlData={systemControlData}
      isSuperAdmin={isSuperAdmin}
      onSubTabChange={onSubTabChange}
    />
  );
}
