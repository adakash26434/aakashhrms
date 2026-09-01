'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Phone, Database, ArrowLeft, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { validatePhoneNumber } from '@/lib/utils/phone';
import { slugifyCompanyName } from '@/lib/platform/company-code';
import { PhoneInput } from '@/components/ui/phone-input';

export default function RegisterCompanyPage() {
  const router = useRouter();
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLegalNameChange = (val: string) => {
    setLegalName(val);
    if (!isSlugCustomized && !displayName) {
      setSlug(slugifyCompanyName(val));
    }
  };

  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    if (!isSlugCustomized) {
      setSlug(slugifyCompanyName(val || legalName));
    }
  };

  const handleSlugChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(clean);
    setIsSlugCustomized(true);
  };

  const handleResetSlug = () => {
    setIsSlugCustomized(false);
    setSlug(slugifyCompanyName(displayName || legalName));
  };

  const handlePhoneChange = (val: string) => {
    setContactPhone(val);
    if (!val.trim()) {
      setPhoneError(null);
      return;
    }
    const result = validatePhoneNumber(val);
    if (!result.isValid) {
      setPhoneError('Invalid phone format (e.g. +977 9800000000, 01-4XXXXXX)');
    } else {
      setPhoneError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate phone if provided
    if (contactPhone && contactPhone.trim()) {
      const result = validatePhoneNumber(contactPhone, true);
      if (!result.isValid) {
        setError('Please provide a valid contact phone number before proceeding.');
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch('/api/platform/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalName,
          displayName: displayName || legalName,
          slug,
          contactEmail,
          contactPhone,
          notes,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to register company.');
      }

      alert(`Company registered successfully!\nPublic Company Code: ${data.company.companyCode}`);
      router.push('/platform/companies');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <Link
          href="/platform/companies"
          className="p-2 rounded-xl border border-payroll-light bg-white hover:bg-payroll-cream text-payroll-navy transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-payroll-navy tracking-tight">Onboard New SaaS Tenant Company</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Register company details to generate a unique Company Code and isolated database.
          </p>
        </div>
      </div>

      <div className="bg-white border border-payroll-light rounded-2xl p-8 shadow-payroll-md space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-payroll-navy uppercase tracking-wider">
                Legal Company Name *
              </label>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => handleLegalNameChange(e.target.value)}
                placeholder="e.g. Himalayan Solutions Pvt. Ltd."
                className="w-full px-4 py-2.5 rounded-xl border border-payroll-light bg-payroll-cream text-payroll-navy text-sm focus:outline-none focus:ring-2 focus:ring-payroll-primary focus:border-transparent transition-all placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-payroll-navy uppercase tracking-wider">
                Display Brand Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                placeholder="e.g. Himalayan Tech"
                className="w-full px-4 py-2.5 rounded-xl border border-payroll-light bg-payroll-cream text-payroll-navy text-sm focus:outline-none focus:ring-2 focus:ring-payroll-primary focus:border-transparent transition-all placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-payroll-navy uppercase tracking-wider">
                Database Slug Identifier *
              </label>
              {isSlugCustomized ? (
                <button
                  type="button"
                  onClick={handleResetSlug}
                  className="text-[11px] font-medium text-payroll-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Auto-sync from Brand Name
                </button>
              ) : (
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Auto-syncing from name
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Database className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="himalayan-tech"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-payroll-light bg-payroll-cream text-payroll-navy text-sm focus:outline-none focus:ring-2 focus:ring-payroll-primary focus:border-transparent transition-all placeholder:text-gray-400 font-mono"
              />
            </div>
            <p className="text-[11px] text-gray-500">
              Unique internal slug used for isolated database naming: <code className="text-payroll-primary font-semibold">pay_t_{slug || 'slug'}</code>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-payroll-navy uppercase tracking-wider">
                Contact Email *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="admin@himalayan.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-payroll-light bg-payroll-cream text-payroll-navy text-sm focus:outline-none focus:ring-2 focus:ring-payroll-primary focus:border-transparent transition-all placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-payroll-navy uppercase tracking-wider">
                  Contact Phone
                </label>
                {!phoneError && contactPhone && (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Valid
                  </span>
                )}
              </div>
              <PhoneInput
                value={contactPhone}
                onChange={handlePhoneChange}
                hasError={Boolean(phoneError)}
                placeholder="9800000000 / 01-4XXXXXX"
              />
              {phoneError && (
                <p className="text-[11px] text-rose-600 font-medium">{phoneError}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-payroll-navy uppercase tracking-wider">
              Internal Onboarding Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enterprise client plan details, custom requirements, contact notes..."
              className="w-full p-3 rounded-xl border border-payroll-light bg-payroll-cream text-payroll-navy text-sm focus:outline-none focus:ring-2 focus:ring-payroll-primary focus:border-transparent transition-all placeholder:text-gray-400"
            />
          </div>

          <div className="pt-4 border-t border-payroll-light/60 flex items-center justify-end space-x-3">
            <Link
              href="/platform/companies"
              className="px-4 py-2.5 rounded-xl border border-payroll-light bg-white hover:bg-payroll-cream text-payroll-navy text-sm font-semibold transition-all shadow-sm cursor-pointer"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || Boolean(phoneError)}
              className="px-6 py-2.5 rounded-xl bg-payroll-primary hover:bg-payroll-primary-hover text-white font-semibold text-sm transition-all shadow-md shadow-payroll-primary/20 border border-payroll-primary disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Registering Company...' : 'Register Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
