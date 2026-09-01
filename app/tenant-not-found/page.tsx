import React from 'react';
import Link from 'next/link';
import { Building2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function TenantNotFoundPage() {
  return (
    <div className="min-h-screen bg-payroll-cream text-payroll-navy flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
      <div className="w-full max-w-md bg-white border border-payroll-light rounded-2xl p-8 shadow-payroll-md text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-payroll-navy tracking-tight">Tenant Company Not Found</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            The subdomain you are trying to access is not registered or is awaiting database provisioning.
          </p>
        </div>

        <div className="p-4 bg-payroll-cream border border-payroll-light rounded-xl text-xs text-gray-500 font-mono">
          Please verify your company subdomain or contact your Super Administrator.
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/platform/login"
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-payroll-primary hover:bg-payroll-primary-hover text-white text-xs font-semibold transition-all shadow-sm"
          >
            <Building2 className="w-4 h-4" />
            <span>Go to Super Admin Portal</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
