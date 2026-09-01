"use client";

import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { generateBankExportCSVAction } from "@/app/actions/payroll.actions";
import { toast } from "@/components/ui/toast";

interface BankExportButtonProps {
  runId: string;
  filename: string;
}

export function BankExportButton({ runId, filename }: BankExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    try {
      setIsLoading(true);
      const res = await generateBankExportCSVAction(runId);
      if (!res.success || !res.data) {
        toast.error(res.error || "Failed to generate export file.");
        return;
      }

      // Create a browser download blob
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Bank export CSV generated successfully.");
    } catch (error: unknown) {
      toast.error("Error exporting bank file: " + (error instanceof Error ? error.message : "An unexpected error occurred"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isLoading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#d7e8d0] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#1b3a1f] shadow-sm transition-all hover:bg-[#d7e8d0]/20 hover:text-[#2e7d32] disabled:opacity-50"
    >
      {isLoading ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      Bank Export CSV
    </button>
  );
}
