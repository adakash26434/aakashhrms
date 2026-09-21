"use client";

import Link from "next/link";
import { Building2, Users, Briefcase, ArrowUpRight, Info } from "lucide-react";
import type { Branch } from "@/lib/types/branch";
import type { Department } from "@/lib/types/department";
import type { Designation } from "@/lib/types/designation";

interface OrganizationShortcutsCardProps {
  branches: Branch[];
  departments: Department[];
  designations: Designation[];
}

export function OrganizationShortcutsCard({
  branches,
  departments,
  designations,
}: OrganizationShortcutsCardProps) {
  return (
    <div className="space-y-6">
      {/* Centralization Advisory Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-payroll-primary/20 bg-payroll-cream/60 p-4 text-xs text-payroll-navy shadow-xs">
        <Info className="h-4 w-4 shrink-0 text-payroll-primary mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-payroll-navy">
            Organizational Structure Centralized Under Workforce
          </p>
          <p className="text-gray-600 leading-relaxed">
            Day-to-day management of physical branches, departments, and job designations is now unified under{" "}
            <Link
              href="/workforce/organization"
              className="font-bold text-payroll-primary hover:underline inline-flex items-center gap-0.5"
            >
              Workforce → Organization
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            . This keeps organizational maintenance connected with active employee records while keeping company setup focused on legal identity, working schedules, and policy rules.
          </p>
        </div>
      </div>

      {/* 3 Overview & Shortcut Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Branches Card */}
        <div className="flex flex-col justify-between rounded-xl border border-payroll-light bg-white p-5 shadow-xs transition-all hover:border-payroll-primary/40 hover:shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-payroll-primary/10 text-payroll-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-payroll-cream px-2.5 py-0.5 text-xs font-mono font-bold text-payroll-primary border border-payroll-light/80">
                {branches.length} {branches.length === 1 ? "Branch" : "Branches"}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-payroll-navy">
                Branches &amp; Office Locations
              </h4>
              <p className="text-xs text-gray-500 mt-1 leading-normal">
                Regional offices, physical operating branches, and head office designation.
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-payroll-light/60 pt-3">
            <Link
              href="/workforce/organization?tab=branches"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-payroll-primary hover:underline hover:text-payroll-navy transition-colors"
            >
              <span>Manage Branches</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Departments Card */}
        <div className="flex flex-col justify-between rounded-xl border border-payroll-light bg-white p-5 shadow-xs transition-all hover:border-payroll-primary/40 hover:shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-payroll-primary/10 text-payroll-primary">
                <Users className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-payroll-cream px-2.5 py-0.5 text-xs font-mono font-bold text-payroll-primary border border-payroll-light/80">
                {departments.length} {departments.length === 1 ? "Department" : "Departments"}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-payroll-navy">
                Departments &amp; Units
              </h4>
              <p className="text-xs text-gray-500 mt-1 leading-normal">
                Functional business units, branch associations, and head of department assignments.
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-payroll-light/60 pt-3">
            <Link
              href="/workforce/organization?tab=departments"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-payroll-primary hover:underline hover:text-payroll-navy transition-colors"
            >
              <span>Manage Departments</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Designations Card */}
        <div className="flex flex-col justify-between rounded-xl border border-payroll-light bg-white p-5 shadow-xs transition-all hover:border-payroll-primary/40 hover:shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-payroll-primary/10 text-payroll-primary">
                <Briefcase className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-payroll-cream px-2.5 py-0.5 text-xs font-mono font-bold text-payroll-primary border border-payroll-light/80">
                {designations.length} {designations.length === 1 ? "Designation" : "Designations"}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-payroll-navy">
                Job Designations &amp; Roles
              </h4>
              <p className="text-xs text-gray-500 mt-1 leading-normal">
                Standard job titles, organizational roles, and hierarchy designations.
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-payroll-light/60 pt-3">
            <Link
              href="/workforce/organization?tab=designations"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-payroll-primary hover:underline hover:text-payroll-navy transition-colors"
            >
              <span>Manage Designations</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
