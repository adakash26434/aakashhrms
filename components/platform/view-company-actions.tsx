'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, LogIn } from 'lucide-react';

interface ViewCompanyActionsProps {
  companyId: string;
  companyName: string;
}

/**
 * Client component for the "View Company Data" and "Login as Tenant" actions
 * on the company detail page. Both features are available to Super Admins
 * for ACTIVE companies only.
 */
export function ViewCompanyActions({ companyId, companyName }: ViewCompanyActionsProps) {
  const [isStarting, setIsStarting] = useState(false);
  const router = useRouter();

  const handleViewCompanyData = async () => {
    if (!confirm(`Start viewing ${companyName}'s data as Super Admin?\n\nYou will see their dashboard, employees, payroll, and other data. All actions will be logged.`)) {
      return;
    }

    setIsStarting(true);
    try {
      const res = await fetch(`/api/platform/companies/${companyId}/impersonate`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        router.push(data.redirectUrl || '/dashboard');
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="bg-white border border-payroll-light rounded-2xl p-6 space-y-4 shadow-payroll-sm">
      <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider border-b border-payroll-light/60 pb-2">
        Super Admin Actions
      </h3>

      <div className="space-y-3">
        <button
          onClick={handleViewCompanyData}
          disabled={isStarting}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium text-sm transition-all shadow-md shadow-payroll-primary/20 border border-payroll-primary disabled:opacity-50"
        >
          <Eye className="w-4 h-4" />
          <span>{isStarting ? 'Starting...' : 'View Company Data'}</span>
        </button>

        <p className="text-[11px] text-gray-400 text-center">
          Opens this company&apos;s dashboard in Super Admin mode. All actions are logged to the impersonation audit trail.
        </p>
      </div>
    </div>
  );
}
