import { getMyProfile } from "@/lib/services/self-service.service";
import { parseStructuredAddress, formatStructuredAddress, PROVINCES } from "@/lib/constants/nepal-locations";
import { UserCircle, Mail, Phone, MapPin, CreditCard, Users, BadgeCheck, Building2, Calendar, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Profile | Self-Service Portal",
  description: "View your personal and employment details",
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
      const provinceName = PROVINCES.find((p) => p.id === parsed.province || p.name === parsed.province)?.name || parsed.province;
      const streetPart = [parsed.tole ? `${parsed.tole}` : "", parsed.wardNo ? `Ward No. ${parsed.wardNo}` : ""].filter(Boolean).join(", ");
      const regionPart = [parsed.localLevel, parsed.district, provinceName].filter(Boolean).join(", ");
      
      if (streetPart || regionPart) {
        return (
          <div className="space-y-0.5 text-xs">
            {streetPart && <div className="font-semibold text-gray-800">{streetPart}</div>}
            {regionPart && <div className="text-gray-600">{regionPart}</div>}
          </div>
        );
      }
      if (parsed.formatted) {
        return <div className="text-xs text-gray-800 font-medium">{parsed.formatted}</div>;
      }
    }
  } catch {}

  return <span className="text-xs text-gray-800 font-medium">{raw}</span>;
}

export default async function MyProfilePage() {
  let profile;
  try {
    profile = await getMyProfile();
  } catch (error: any) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-gray-200 bg-white">
        <UserCircle className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Profile Unavailable</h2>
        <p className="text-sm text-gray-500 max-w-md">{error?.message || "Failed to load your profile. Please contact HR."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / Hero Banner */}
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50/30 to-green-50/20 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-700 text-white text-xl font-bold shadow-sm">
              {profile.firstName?.[0]}{profile.lastName?.[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#1b3a1f]">
                  {profile.firstName} {profile.lastName}
                </h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  profile.status === "Active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-gray-100 text-gray-600 border border-gray-200"
                }`}>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {profile.status}
                </span>
              </div>
              <p className="text-sm font-medium text-emerald-800">
                {profile.employeeCode} · {profile.designationName || "Staff"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {profile.departmentName || "Department"} · {profile.branchName || "Main Branch"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 bg-white px-3.5 py-2 rounded-xl border border-gray-200/80 shadow-2xs">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="font-semibold text-gray-700">Joined Date</p>
              <p>{formatDate(profile.joiningDate)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Employment Details */}
        <DetailSection title="Employment Details" icon={Building2}>
          <DetailRow label="Employee Category" value={profile.category || "Permanent"} />
          <DetailRow label="Salary Grade" value={profile.salaryGrade || "—"} />
          <DetailRow label="Joining Date" value={formatDate(profile.joiningDate)} />
          <DetailRow label="Confirmation Date" value={formatDate(profile.confirmationDate)} />
          <DetailRow label="Tax Filing Status" value={profile.taxStatus || "Normal Single"} />
          <DetailRow label="Gender" value={profile.gender || "—"} />
          <DetailRow label="Date of Birth" value={formatDate(profile.dateOfBirth)} />
          <DetailRow label="Attendance Code" value={profile.attendanceCode || profile.employeeCode} />
        </DetailSection>

        {/* 2. Contact & Address Details */}
        <DetailSection title="Contact & Address Details" icon={Mail}>
          <DetailRow label="Company Email" value={profile.companyEmail || profile.email || "—"} />
          <DetailRow label="Personal Email" value={profile.personalEmail || "—"} />
          <DetailRow label="Mobile Number" value={profile.mobileNo || "—"} />
          
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                <span>Permanent Address</span>
              </div>
              <div className="rounded-lg bg-gray-50/80 border border-gray-200/70 p-2.5 text-xs text-gray-700 leading-relaxed">
                <AddressDisplay raw={profile.permanentAddress} />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                <MapPin className="h-3.5 w-3.5 text-blue-600" />
                <span>Temporary / Current Address</span>
              </div>
              <div className="rounded-lg bg-gray-50/80 border border-gray-200/70 p-2.5 text-xs text-gray-700 leading-relaxed">
                <AddressDisplay raw={profile.temporaryAddress} />
              </div>
            </div>
          </div>
        </DetailSection>

        {/* 3. Identity & Tax Documents */}
        <DetailSection title="Official Documents" icon={FileText}>
          <DetailRow label="Citizenship Number" value={profile.citizenshipNo || "—"} />
          <DetailRow label="PAN Number (IRD)" value={profile.panNumber || "—"} />
        </DetailSection>

        {/* 4. Family Lineage Information */}
        <DetailSection title="Family Information (Official Lineage)" icon={Users}>
          <DetailRow label="Father's Name" value={profile.fatherName || "—"} />
          <DetailRow label="Mother's Name" value={profile.motherName || "—"} />
          <DetailRow label="Grandfather's Name" value={profile.grandfatherName || "—"} />
          <DetailRow label="Spouse Name" value={profile.spouseName || "—"} />
        </DetailSection>
      </div>

      {/* 5. Bank Accounts */}
      {profile.bankDetails && profile.bankDetails.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-[#1b3a1f]">Salary Disbursement Accounts</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profile.bankDetails.map((bank) => (
              <div
                key={bank.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 p-4 transition-all"
              >
                <div>
                  <p className="text-sm font-bold text-gray-800">{bank.bankName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{bank.branchName || "Main Branch"} · A/C: <span className="font-mono font-semibold text-gray-700">{bank.accountNumber}</span></p>
                </div>
                {bank.isPrimary && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    PRIMARY
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
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
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
        <Icon className="h-4 w-4 text-emerald-600" />
        <h3 className="text-sm font-bold text-[#1b3a1f]">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm py-1 border-b border-gray-50 last:border-b-0 gap-1">
      <span className="text-gray-500 text-xs font-medium">{label}</span>
      <span className="font-semibold text-gray-800 text-left sm:text-right max-w-full sm:max-w-[65%] break-words">
        {value}
      </span>
    </div>
  );
}
