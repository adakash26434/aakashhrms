import React from "react";
import { getMyProfile } from "@/lib/services/self-service.service";
import { parseStructuredAddress, formatStructuredAddress, PROVINCES } from "@/lib/constants/nepal-locations";
import {
  UserCircle,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Users,
  BadgeCheck,
  Building2,
  Calendar,
  FileText,
  Shield,
  Briefcase,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Profile | Self-Service Portal",
  description: "View verified personnel records, official identity documents, and bank details",
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  if (typeof d === "string") {
    return d.split("T")[0];
  }
  return d.toISOString().split("T")[0];
}

function AddressDisplay({ raw }: { raw: string | null | undefined }) {
  if (!raw || raw.trim() === "" || raw === "—") {
    return <span className="text-gray-400 italic">Not provided</span>;
  }

  try {
    if (raw.trim().startsWith("{") && raw.trim().endsWith("}")) {
      const parsed = JSON.parse(raw);
      const provinceName =
        PROVINCES.find((p) => p.id === parsed.province || p.name === parsed.province)
          ?.name || parsed.province;
      const streetPart = [
        parsed.tole ? `${parsed.tole}` : "",
        parsed.wardNo ? `Ward No. ${parsed.wardNo}` : "",
      ]
        .filter(Boolean)
        .join(", ");
      const regionPart = [parsed.localLevel, parsed.district, provinceName]
        .filter(Boolean)
        .join(", ");

      if (streetPart || regionPart) {
        return (
          <div className="space-y-0.5 text-xs">
            {streetPart && (
              <div className="font-semibold text-payroll-navy">{streetPart}</div>
            )}
            {regionPart && <div className="text-gray-600">{regionPart}</div>}
          </div>
        );
      }
      if (parsed.formatted) {
        return (
          <div className="text-xs text-payroll-navy font-medium">
            {parsed.formatted}
          </div>
        );
      }
    }
  } catch {}

  return <span className="text-xs text-payroll-navy font-medium">{raw}</span>;
}

export default async function MyProfilePage() {
  let profile;
  try {
    profile = await getMyProfile();
  } catch (error: any) {
    return (
      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
        <CardContent className="py-16">
          <EmptyState
            icon={<UserCircle className="h-10 w-10 text-payroll-primary" />}
            title="Profile Unavailable"
            description={
              error?.message ||
              "Failed to load personnel profile records. Please contact HR."
            }
          />
        </CardContent>
      </Card>
    );
  }

  const initials = `${profile.firstName?.[0] || ""}${profile.lastName?.[0] || ""}`.toUpperCase();

  return (
    <div className="space-y-6">
      {/* ── Header / Hero Banner Card ── */}
      <Card className="border-payroll-light/80 shadow-payroll-xs bg-white overflow-hidden">
        <CardContent className="p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-payroll-navy text-white text-xl font-bold border border-white/20 shadow-payroll-sm shrink-0">
                {initials || "EM"}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-payroll-navy tracking-tight">
                    {profile.firstName} {profile.lastName}
                  </h1>
                  <Badge
                    variant={profile.status === "Active" ? "success" : "neutral"}
                    size="sm"
                    className="font-bold gap-1"
                  >
                    <BadgeCheck className="h-3 w-3" />
                    <span>{profile.status || "Active"}</span>
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm font-bold text-payroll-primary mt-0.5 font-mono">
                  {profile.employeeCode} · {profile.designationName || "Staff"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {profile.departmentName || "Department"} · {profile.branchName || "Main Branch"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs bg-payroll-cream px-3.5 py-2 rounded-xl border border-payroll-light shadow-2xs self-start sm:self-auto">
              <Calendar className="h-4 w-4 text-payroll-primary shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">
                  Joined Date
                </span>
                <strong className="text-payroll-navy block font-mono text-xs">
                  {formatDate(profile.joiningDate)}
                </strong>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Details Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Employment Details */}
        <DetailSection title="Employment & Position" icon={Briefcase}>
          <DetailRow label="Employee Category" value={profile.category || "Permanent"} />
          <DetailRow label="Salary Grade Level" value={profile.salaryGrade || "—"} />
          <DetailRow label="Appointment Joining Date" value={formatDate(profile.joiningDate)} />
          <DetailRow label="Confirmation Date" value={formatDate(profile.confirmationDate)} />
          <DetailRow label="Income Tax Filing Status" value={profile.taxStatus || "Normal Single"} />
          <DetailRow label="Gender" value={profile.gender || "—"} />
          <DetailRow label="Date of Birth" value={formatDate(profile.dateOfBirth)} />
          <DetailRow label="Attendance Device Code" value={profile.attendanceCode || profile.employeeCode} />
        </DetailSection>

        {/* 2. Contact & Address Details */}
        <DetailSection title="Contact & Address Verification" icon={Mail}>
          <DetailRow label="Corporate Email" value={profile.companyEmail || profile.email || "—"} />
          <DetailRow label="Personal Email" value={profile.personalEmail || "—"} />
          <DetailRow label="Mobile Phone" value={profile.mobileNo || "—"} />

          <div className="pt-2 border-t border-payroll-light/60 space-y-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-payroll-navy mb-1.5">
                <MapPin className="h-3.5 w-3.5 text-payroll-primary" />
                <span>Permanent Address (Official Registry)</span>
              </div>
              <div className="rounded-xl bg-payroll-cream/60 border border-payroll-light p-3 text-xs leading-relaxed">
                <AddressDisplay raw={profile.permanentAddress} />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-payroll-navy mb-1.5">
                <MapPin className="h-3.5 w-3.5 text-payroll-primary" />
                <span>Temporary / Residential Address</span>
              </div>
              <div className="rounded-xl bg-payroll-cream/60 border border-payroll-light p-3 text-xs leading-relaxed">
                <AddressDisplay raw={profile.temporaryAddress} />
              </div>
            </div>
          </div>
        </DetailSection>

        {/* 3. Identity & Tax Documents */}
        <DetailSection title="Official Statutory Documents" icon={FileText}>
          <DetailRow label="Nepal Citizenship Number" value={profile.citizenshipNo || "—"} />
          <DetailRow label="Permanent Account Number (IRD PAN)" value={profile.panNumber || "—"} />
        </DetailSection>

        {/* 4. Family Lineage Information */}
        <DetailSection title="Family Lineage (Official Records)" icon={Users}>
          <DetailRow label="Father's Full Name" value={profile.fatherName || "—"} />
          <DetailRow label="Mother's Full Name" value={profile.motherName || "—"} />
          <DetailRow label="Grandfather's Full Name" value={profile.grandfatherName || "—"} />
          <DetailRow label="Spouse Full Name" value={profile.spouseName || "—"} />
        </DetailSection>
      </div>

      {/* 5. Salary Disbursement Bank Accounts */}
      {profile.bankDetails && profile.bankDetails.length > 0 && (
        <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-payroll-light/60 pb-3">
              <CreditCard className="h-4 w-4 text-payroll-primary" />
              <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                Salary Disbursement Accounts
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profile.bankDetails.map((bank: any) => (
                <div
                  key={bank.id}
                  className="flex items-center justify-between rounded-xl border border-payroll-light bg-payroll-cream/50 p-4 shadow-2xs"
                >
                  <div>
                    <p className="text-sm font-bold text-payroll-navy">{bank.bankName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {bank.branchName || "Main Branch"} · A/C:{" "}
                      <span className="font-mono font-bold text-payroll-navy">
                        {bank.accountNumber}
                      </span>
                    </p>
                  </div>
                  {bank.isPrimary && (
                    <Badge variant="success" size="sm" className="font-bold text-[10px]">
                      PRIMARY
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-payroll-light/60 pb-3">
          <Icon className="h-4 w-4 text-payroll-primary" />
          <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
            {title}
          </h3>
        </div>
        <div className="space-y-1">{children}</div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs py-1.5 border-b border-payroll-light/40 last:border-b-0 gap-1">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="font-bold text-payroll-navy text-left sm:text-right max-w-full sm:max-w-[65%] break-words">
        {value}
      </span>
    </div>
  );
}
