"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, ShieldCheck, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ViewCompanyActionsProps {
  companyId: string;
  companyName: string;
}

/**
 * Client component for the "View Company Data" (Impersonation) action
 * on the company detail page. Available to Super Admins for ACTIVE companies only.
 */
export function ViewCompanyActions({ companyId, companyName }: ViewCompanyActionsProps) {
  const [isStarting, setIsStarting] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const handleViewCompanyData = async () => {
    if (
      !confirm(
        `Start viewing ${companyName}'s data as Super Admin?\n\nYou will access their live dashboard, employees, payroll, and settings. All operations will be logged under the Super Admin audit trail.`,
      )
    ) {
      return;
    }

    setIsStarting(true);
    try {
      const res = await fetch(`/api/platform/companies/${companyId}/impersonate`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Accessing workspace for ${companyName}...`);
        router.push(data.redirectUrl || "/dashboard");
      } else {
        toast.error(`Impersonation failed: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center space-x-2 border-b border-payroll-light/60 pb-2.5">
          <ShieldCheck className="w-4 h-4 text-payroll-primary" />
          <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
            Super Admin Authority
          </h3>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleViewCompanyData}
            isLoading={isStarting}
            disabled={isStarting}
            className="w-full bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-xs"
          >
            <Eye className="w-4 h-4 mr-1.5" />
            <span>{isStarting ? "Initiating Session..." : "View Company Workspace"}</span>
          </Button>

          <p className="text-[11px] text-gray-500 text-center leading-relaxed">
            Opens this company&apos;s workspace in Super Admin mode. All actions are logged to the forensic audit trail.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
