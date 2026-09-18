"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Edit3,
  Mail,
  Building,
  AlertCircle,
  CheckCircle2,
  Shield,
  Calendar,
  GitBranch,
  Palmtree,
  Coins,
  Percent,
  Clock,
  Plus,
  Trash2,
  RefreshCw,
  MapPin,
  Hash,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  Pencil,
  Info,
} from "lucide-react";
import {
  INDUSTRY_SECTORS,
  IndustrySectorKey,
} from "@/lib/constants/industry-types";
import { getAvailableFiscalYearPresets } from "@/lib/utils/fiscal-year-presets";
import { FiscalYearFormModal } from "@/components/fiscal-year/fiscal-year-form-modal";
import type { FiscalYear, FiscalYearFormData, FiscalYearStatus } from "@/lib/types/fiscal-year";
import {
  formatADDate,
  adToBSString,
  BS_MONTHS_EN,
  type BSMonthNumber,
} from "@/lib/utils/bs-calendar";
import {
  DEFAULT_NEPAL_LEAVE_TYPES,
  DEFAULT_PAY_HEADS,
  LeaveTypePreset,
  PayHeadPreset,
} from "@/lib/types/onboarding";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { useToast } from "@/components/ui/toast";
import { validatePhoneNumber } from "@/lib/utils/phone";
import { cn } from "@/lib/utils";

export type EditModalTab =
  | "profile"
  | "branch"
  | "fiscal-year"
  | "leaves"
  | "pay-heads"
  | "tax-slabs";

export interface TaxSlabItem {
  category: string;
  amountFrom: string;
  amountTo: string | null;
  ratePercent: string;
  fixedDeduction: string;
}

const DEFAULT_TAX_SLABS: TaxSlabItem[] = [
  // Normal Single Individual (FY 2083/84)
  {
    category: "Normal Single",
    amountFrom: "0",
    amountTo: "1000000",
    ratePercent: "1.00",
    fixedDeduction: "0",
  },
  {
    category: "Normal Single",
    amountFrom: "1000001",
    amountTo: "1500000",
    ratePercent: "10.00",
    fixedDeduction: "0",
  },
  {
    category: "Normal Single",
    amountFrom: "1500001",
    amountTo: "2500000",
    ratePercent: "20.00",
    fixedDeduction: "0",
  },
  {
    category: "Normal Single",
    amountFrom: "2500001",
    amountTo: "4000000",
    ratePercent: "27.00",
    fixedDeduction: "0",
  },
  {
    category: "Normal Single",
    amountFrom: "4000001",
    amountTo: null,
    ratePercent: "29.00",
    fixedDeduction: "0",
  },

  // Married Couple (FY 2083/84)
  {
    category: "Married",
    amountFrom: "0",
    amountTo: "1000000",
    ratePercent: "1.00",
    fixedDeduction: "0",
  },
  {
    category: "Married",
    amountFrom: "1000001",
    amountTo: "1500000",
    ratePercent: "10.00",
    fixedDeduction: "0",
  },
  {
    category: "Married",
    amountFrom: "1500001",
    amountTo: "2500000",
    ratePercent: "20.00",
    fixedDeduction: "0",
  },
  {
    category: "Married",
    amountFrom: "2500001",
    amountTo: "4000000",
    ratePercent: "27.00",
    fixedDeduction: "0",
  },
  {
    category: "Married",
    amountFrom: "4000001",
    amountTo: null,
    ratePercent: "29.00",
    fixedDeduction: "0",
  },

  // Handicapped (FY 2083/84)
  {
    category: "Handicapped",
    amountFrom: "0",
    amountTo: "1500000",
    ratePercent: "1.00",
    fixedDeduction: "0",
  },
  {
    category: "Handicapped",
    amountFrom: "1500001",
    amountTo: "2000000",
    ratePercent: "10.00",
    fixedDeduction: "0",
  },
  {
    category: "Handicapped",
    amountFrom: "2000001",
    amountTo: "3000000",
    ratePercent: "20.00",
    fixedDeduction: "0",
  },
  {
    category: "Handicapped",
    amountFrom: "3000001",
    amountTo: "4500000",
    ratePercent: "27.00",
    fixedDeduction: "0",
  },
  {
    category: "Handicapped",
    amountFrom: "4500001",
    amountTo: null,
    ratePercent: "29.00",
    fixedDeduction: "0",
  },
];

export interface EditCompanyModalProps {
  company: {
    id: string;
    companyCode: string;
    displayName: string;
    legalName: string;
    slug?: string;
    status?: string;
    contactEmail: string;
    contactPhone?: string | null;
    industryType?: string | null;
    panVatNumber?: string | null;
    registrationNumber?: string | null;
    headOfficeAddress?: string | null;
    headOfficeBranchCode?: string | null;
    headOfficeBranchAddress?: string | null;
    notes?: string | null;
    initialSetupPayload?: {
      fiscalYear?: {
        label: string;
        slug: string;
        fromMonth?: number;
        toMonth?: number;
        startDateBS: string;
        endDateBS: string;
        startDateAD: string;
        endDateAD: string;
        status?: string;
      };
      leaveTypes?: LeaveTypePreset[];
      otHourlyMultiplier?: number;
      payHeads?: PayHeadPreset[];
      taxSlabs?: TaxSlabItem[];
    } | null;
  };
  initialTab?: EditModalTab;
  buttonLabel?: string;
  buttonVariant?: "outline" | "primary" | "secondary" | "ghost";
  buttonSize?: "sm" | "xs" | "md" | "lg" | "default";
  buttonClassName?: string;
}

export function EditCompanyModal({
  company,
  initialTab = "profile",
  buttonLabel,
  buttonVariant = "outline",
  buttonSize = "sm",
  buttonClassName,
}: EditCompanyModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EditModalTab>(initialTab);

  // 1. Profile fields
  const [companyCode, setCompanyCode] = useState(company.companyCode);
  const [displayName, setDisplayName] = useState(company.displayName);
  const [legalName, setLegalName] = useState(company.legalName);
  const [contactEmail, setContactEmail] = useState(company.contactEmail);
  const [contactPhone, setContactPhone] = useState(company.contactPhone || "");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [industryType, setIndustryType] = useState<IndustrySectorKey>(
    (company.industryType as IndustrySectorKey) || "General",
  );
  const [panVatNumber, setPanVatNumber] = useState(company.panVatNumber || "");
  const [registrationNumber, setRegistrationNumber] = useState(
    company.registrationNumber || "",
  );
  const [headOfficeAddress, setHeadOfficeAddress] = useState(
    company.headOfficeAddress || "",
  );
  const [notes, setNotes] = useState(company.notes || "");

  // 2. Branch fields
  const [headOfficeBranchCode, setHeadOfficeBranchCode] = useState(
    company.headOfficeBranchCode || "HO-01",
  );
  const [headOfficeBranchAddress, setHeadOfficeBranchAddress] = useState(
    company.headOfficeBranchAddress || company.headOfficeAddress || "",
  );

  // 3. Fiscal year fields
  const { current: defaultFY } = useMemo(
    () => getAvailableFiscalYearPresets(),
    [],
  );

  const companyFY = company.initialSetupPayload?.fiscalYear;
  const initialFY = companyFY || {
    label: defaultFY.label,
    slug: defaultFY.slug,
    fromMonth: 4,
    toMonth: 3,
    startDateBS: defaultFY.startDateBS,
    endDateBS: defaultFY.endDateBS,
    startDateAD: defaultFY.startDateAD,
    endDateAD: defaultFY.endDateAD,
    status: "Active",
  };
  const [fyLabel, setFyLabel] = useState(initialFY.label);
  const [fySlug, setFySlug] = useState(initialFY.slug);
  const [fyFromMonth, setFyFromMonth] = useState<BSMonthNumber>(
    (initialFY.fromMonth as BSMonthNumber) || 4,
  );
  const [fyToMonth, setFyToMonth] = useState<BSMonthNumber>(
    (initialFY.toMonth as BSMonthNumber) || 3,
  );
  const [fyStartDateBS, setFyStartDateBS] = useState(initialFY.startDateBS);
  const [fyEndDateBS, setFyEndDateBS] = useState(initialFY.endDateBS);
  const [fyStartDateAD, setFyStartDateAD] = useState<Date>(
    new Date(initialFY.startDateAD),
  );
  const [fyEndDateAD, setFyEndDateAD] = useState<Date>(
    new Date(initialFY.endDateAD),
  );
  const [fyStatus, setFyStatus] = useState<FiscalYearStatus>(
    (initialFY.status as FiscalYearStatus) || "Active",
  );

  const [isFYModalOpen, setIsFYModalOpen] = useState(false);
  const [fyModalMode, setFyModalMode] = useState<"edit" | "add">("edit");

  const handleSaveFYFromModal = (formData: FiscalYearFormData) => {
    const startBS = adToBSString(formData.startDateAD);
    const endBS = adToBSString(formData.endDateAD);
    setFyLabel(formData.label.trim());
    setFySlug(formData.slug.trim());
    setFyFromMonth(formData.fromMonth);
    setFyToMonth(formData.toMonth);
    setFyStartDateAD(formData.startDateAD);
    setFyEndDateAD(formData.endDateAD);
    setFyStartDateBS(startBS);
    setFyEndDateBS(endBS);
    setFyStatus(formData.status || "Active");
    setIsFYModalOpen(false);
  };

  const fyModalInitialValue: FiscalYear | null = useMemo(() => {
    if (fyModalMode === "add") return null;
    return {
      id: "company-edit-fy",
      label: fyLabel,
      slug: fySlug,
      fromMonth: fyFromMonth,
      toMonth: fyToMonth,
      startDateAD: fyStartDateAD,
      endDateAD: fyEndDateAD,
      startDateBS: fyStartDateBS,
      endDateBS: fyEndDateBS,
      status: fyStatus,
      payslipsGenerated: false,
    };
  }, [
    fyModalMode,
    fyLabel,
    fySlug,
    fyFromMonth,
    fyToMonth,
    fyStartDateAD,
    fyEndDateAD,
    fyStartDateBS,
    fyEndDateBS,
    fyStatus,
  ]);

  // 4. Statutory Leaves & Overtime
  const [otHourlyMultiplier, setOtHourlyMultiplier] = useState<number>(
    company.initialSetupPayload?.otHourlyMultiplier ?? 1.5,
  );
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypePreset[]>(
    company.initialSetupPayload?.leaveTypes &&
      company.initialSetupPayload.leaveTypes.length > 0
      ? company.initialSetupPayload.leaveTypes
      : DEFAULT_NEPAL_LEAVE_TYPES,
  );

  // 5. Pay Heads
  const [payHeads, setPayHeads] = useState<PayHeadPreset[]>(
    company.initialSetupPayload?.payHeads &&
      company.initialSetupPayload.payHeads.length > 0
      ? company.initialSetupPayload.payHeads
      : DEFAULT_PAY_HEADS,
  );

  // New pay head form state
  const [showAddPayHead, setShowAddPayHead] = useState(false);
  const [newPayHeadName, setNewPayHeadName] = useState("");
  const [newPayHeadCode, setNewPayHeadCode] = useState("");
  const [newPayHeadType, setNewPayHeadType] = useState<"EARNING" | "DEDUCTION">(
    "EARNING",
  );
  const [newPayHeadTaxable, setNewPayHeadTaxable] = useState(true);

  // 6. Tax Slabs
  const [taxSlabs, setTaxSlabs] = useState<TaxSlabItem[]>(
    company.initialSetupPayload?.taxSlabs &&
      company.initialSetupPayload.taxSlabs.length > 0
      ? company.initialSetupPayload.taxSlabs
      : DEFAULT_TAX_SLABS,
  );
  const [selectedTaxCategory, setSelectedTaxCategory] =
    useState("Normal Single");

  // Submission state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when opening
  const handleOpen = () => {
    setActiveTab(initialTab);
    setCompanyCode(company.companyCode);
    setDisplayName(company.displayName);
    setLegalName(company.legalName);
    setContactEmail(company.contactEmail);
    setContactPhone(company.contactPhone || "");
    setIndustryType((company.industryType as IndustrySectorKey) || "General");
    setPanVatNumber(company.panVatNumber || "");
    setRegistrationNumber(company.registrationNumber || "");
    setHeadOfficeAddress(company.headOfficeAddress || "");
    setHeadOfficeBranchCode(company.headOfficeBranchCode || "HO-01");
    setHeadOfficeBranchAddress(
      company.headOfficeBranchAddress || company.headOfficeAddress || "",
    );
    setNotes(company.notes || "");

    const fy = company.initialSetupPayload?.fiscalYear;
    const resolvedFY = fy || {
      label: defaultFY.label,
      slug: defaultFY.slug,
      fromMonth: 4,
      toMonth: 3,
      startDateBS: defaultFY.startDateBS,
      endDateBS: defaultFY.endDateBS,
      startDateAD: defaultFY.startDateAD,
      endDateAD: defaultFY.endDateAD,
      status: "Active",
    };
    setFyLabel(resolvedFY.label);
    setFySlug(resolvedFY.slug);
    setFyFromMonth((resolvedFY.fromMonth as BSMonthNumber) || 4);
    setFyToMonth((resolvedFY.toMonth as BSMonthNumber) || 3);
    setFyStartDateBS(resolvedFY.startDateBS);
    setFyEndDateBS(resolvedFY.endDateBS);
    setFyStartDateAD(new Date(resolvedFY.startDateAD));
    setFyEndDateAD(new Date(resolvedFY.endDateAD));
    setFyStatus((resolvedFY.status as FiscalYearStatus) || "Active");

    setOtHourlyMultiplier(
      company.initialSetupPayload?.otHourlyMultiplier ?? 1.5,
    );
    setLeaveTypes(
      company.initialSetupPayload?.leaveTypes &&
        company.initialSetupPayload.leaveTypes.length > 0
        ? company.initialSetupPayload.leaveTypes
        : DEFAULT_NEPAL_LEAVE_TYPES,
    );
    setPayHeads(
      company.initialSetupPayload?.payHeads &&
        company.initialSetupPayload.payHeads.length > 0
        ? company.initialSetupPayload.payHeads
        : DEFAULT_PAY_HEADS,
    );
    setTaxSlabs(
      company.initialSetupPayload?.taxSlabs &&
        company.initialSetupPayload.taxSlabs.length > 0
        ? company.initialSetupPayload.taxSlabs
        : DEFAULT_TAX_SLABS,
    );

    setShowAddPayHead(false);
    setError(null);
    setPhoneError(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isSaving) return;
    setIsOpen(false);
  };

  const handlePhoneChange = (val: string) => {
    setContactPhone(val);
    if (!val.trim()) {
      setPhoneError(null);
      return;
    }
    const result = validatePhoneNumber(val);
    if (!result.isValid) {
      setPhoneError("Invalid phone format (e.g. 9800000000 / 01-4XXXXXX)");
    } else {
      setPhoneError(null);
    }
  };

  // Leave Type inline editor
  const handleUpdateLeaveDays = (index: number, days: number) => {
    setLeaveTypes((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], daysPerYear: Math.max(0, days) };
      return copy;
    });
  };

  const handleToggleLeavePaid = (index: number) => {
    setLeaveTypes((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], isPaid: !copy[index].isPaid };
      return copy;
    });
  };

  const handleToggleLeaveEncashable = (index: number) => {
    setLeaveTypes((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], isEncashable: !copy[index].isEncashable };
      return copy;
    });
  };

  const handleUpdateLeaveMaxAccumulation = (index: number, cap: number) => {
    setLeaveTypes((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], maxAccumulation: Math.max(0, cap) };
      return copy;
    });
  };

  // Pay Heads management
  const handleAddPayHead = () => {
    if (!newPayHeadName.trim() || !newPayHeadCode.trim()) {
      setError("Please specify both name and unique code for the pay head.");
      return;
    }

    const cleanCode = newPayHeadCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "");
    if (payHeads.some((p) => p.code === cleanCode)) {
      setError(`Pay Head code "${cleanCode}" already exists.`);
      return;
    }

    const newHead: PayHeadPreset = {
      name: newPayHeadName.trim(),
      code: cleanCode,
      type: newPayHeadType,
      isTaxable: newPayHeadTaxable,
    };

    setPayHeads((prev) => [...prev, newHead]);
    setNewPayHeadName("");
    setNewPayHeadCode("");
    setShowAddPayHead(false);
    setError(null);
  };

  const handleRemovePayHead = (code: string) => {
    setPayHeads((prev) => prev.filter((p) => p.code !== code));
  };

  const handleTogglePayHeadTaxable = (code: string) => {
    setPayHeads((prev) =>
      prev.map((p) =>
        p.code === code ? { ...p, isTaxable: !p.isTaxable } : p,
      ),
    );
  };

  // Tax Slabs management
  const filteredTaxSlabs = taxSlabs.filter(
    (s) => s.category === selectedTaxCategory,
  );

  const handleUpdateTaxSlab = (
    indexInFiltered: number,
    field: keyof TaxSlabItem,
    val: string | null,
  ) => {
    const targetItem = filteredTaxSlabs[indexInFiltered];
    if (!targetItem) return;

    setTaxSlabs((prev) => {
      return prev.map((s) => {
        if (s === targetItem) {
          return { ...s, [field]: val };
        }
        return s;
      });
    });
  };

  const handleResetTaxSlabs = async () => {
    try {
      const res = await fetch("/api/platform/policies");
      if (res.ok) {
        const data = await res.json();
        if (
          data.success &&
          data.activePack?.payload?.taxSlabsBaseline &&
          data.activePack.payload.taxSlabsBaseline.length > 0
        ) {
          setTaxSlabs(
            data.activePack.payload.taxSlabsBaseline.map((s: any) => ({
              category: s.category,
              amountFrom: String(s.amountFrom),
              amountTo:
                s.amountTo !== null && s.amountTo !== undefined && s.amountTo !== ""
                  ? String(s.amountTo)
                  : null,
              ratePercent: String(s.ratePercent),
              fixedDeduction: String(s.fixedDeduction || "0"),
            }))
          );
          toast.info("Tax slabs reset to current Statutory Policy Pack baseline.");
          return;
        }
      }
    } catch {
      // Fallback to DEFAULT_TAX_SLABS
    }
    setTaxSlabs(DEFAULT_TAX_SLABS);
    toast.info("Tax slabs reset to standard Nepal IRD brackets.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!contactEmail.trim()) {
      setError("Company Admin email is required.");
      return;
    }

    if (contactPhone && phoneError) {
      setError("Please fix the invalid contact phone number.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        companyCode: companyCode.trim().toUpperCase(),
        displayName: displayName.trim(),
        legalName: legalName.trim(),
        contactEmail: contactEmail.trim().toLowerCase(),
        contactPhone: contactPhone.trim() || null,
        industryType,
        panVatNumber: panVatNumber.trim() || null,
        registrationNumber: registrationNumber.trim() || null,
        headOfficeAddress: headOfficeAddress.trim() || null,
        headOfficeBranchCode:
          headOfficeBranchCode.trim().toUpperCase() || "HO-01",
        headOfficeBranchAddress: headOfficeBranchAddress.trim() || null,
        notes: notes.trim() || null,
        initialSetupPayload: {
          fiscalYear: {
            label: fyLabel.trim(),
            slug: fySlug.trim(),
            fromMonth: fyFromMonth,
            toMonth: fyToMonth,
            startDateBS: fyStartDateBS.trim(),
            endDateBS: fyEndDateBS.trim(),
            startDateAD:
              fyStartDateAD instanceof Date
                ? fyStartDateAD.toISOString()
                : new Date(fyStartDateAD).toISOString(),
            endDateAD:
              fyEndDateAD instanceof Date
                ? fyEndDateAD.toISOString()
                : new Date(fyEndDateAD).toISOString(),
            status: fyStatus || "Active",
          },
          leaveTypes,
          otHourlyMultiplier,
          payHeads,
          taxSlabs,
        },
      };

      const res = await fetch(`/api/platform/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "Failed to update company configuration.",
        );
      }

      toast.success(
        "Company details & configurations updated and synchronized!",
      );
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button
        variant={buttonVariant as any}
        size={buttonSize === "default" ? "md" : buttonSize}
        onClick={handleOpen}
        className={buttonClassName || "text-xs font-bold shadow-payroll-xs"}
      >
        <Edit3 className="w-3.5 h-3.5 mr-1.5 text-payroll-primary" />
        <span>{buttonLabel || "Edit Company Configuration"}</span>
      </Button>

      <Dialog
        open={isOpen}
        onClose={handleClose}
        title="Super Admin Company Configuration Editor"
        description={`Full control plane editor for ${company.displayName} (${company.companyCode}). All changes sync to the tenant database.`}
        size="4xl"
        headerBottom={
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                activeTab === "profile"
                  ? "bg-payroll-primary text-white shadow-2xs"
                  : "text-payroll-navy/80 hover:text-payroll-navy bg-white/70 hover:bg-white border border-payroll-light/70",
              )}
            >
              <Building className="w-3.5 h-3.5" />
              <span>1. Profile & Admin</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("branch")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                activeTab === "branch"
                  ? "bg-payroll-primary text-white shadow-2xs"
                  : "text-payroll-navy/80 hover:text-payroll-navy bg-white/70 hover:bg-white border border-payroll-light/70",
              )}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>2. Head Office Branch</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("fiscal-year")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                activeTab === "fiscal-year"
                  ? "bg-payroll-primary text-white shadow-2xs"
                  : "text-payroll-navy/80 hover:text-payroll-navy bg-white/70 hover:bg-white border border-payroll-light/70",
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>3. Fiscal Year</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("leaves")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                activeTab === "leaves"
                  ? "bg-payroll-primary text-white shadow-2xs"
                  : "text-payroll-navy/80 hover:text-payroll-navy bg-white/70 hover:bg-white border border-payroll-light/70",
              )}
            >
              <Palmtree className="w-3.5 h-3.5" />
              <span>4. Leaves & OT</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("pay-heads")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                activeTab === "pay-heads"
                  ? "bg-payroll-primary text-white shadow-2xs"
                  : "text-payroll-navy/80 hover:text-payroll-navy bg-white/70 hover:bg-white border border-payroll-light/70",
              )}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>5. Pay Heads</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("tax-slabs")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                activeTab === "tax-slabs"
                  ? "bg-payroll-primary text-white shadow-2xs"
                  : "text-payroll-navy/80 hover:text-payroll-navy bg-white/70 hover:bg-white border border-payroll-light/70",
              )}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>6. Tax Slabs</span>
            </button>
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Super Admin Master Authority • Live Tenant DB Synchronization
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                isLoading={isSaving}
                disabled={isSaving}
                className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-sm"
              >
                Save All Configurations
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}
            {/* ════════════════════════════════════════════════════════════════════
                TAB 1: LEGAL PROFILE & ADMIN CONTACT
            ════════════════════════════════════════════════════════════════════ */}
            {activeTab === "profile" && (
              <div className="space-y-4">
                {/* Admin Email */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                      Company Admin Email{" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <Shield className="w-2.5 h-2.5" /> Super Admin Authority
                    </span>
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="admin@company.com"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary text-payroll-navy font-medium shadow-payroll-xs"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Changing this email updates both the Platform Registry and
                    the tenant&apos;s primary Administrator user account.
                  </p>
                </div>

                {/* Company Code & Display Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                      Company Code (Public ID){" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Hash className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={companyCode}
                        onChange={(e) =>
                          setCompanyCode(e.target.value.toUpperCase())
                        }
                        placeholder="CMP-123456"
                        className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary text-payroll-navy shadow-payroll-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                      Display Brand Name{" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Acme Corp"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary text-payroll-navy shadow-payroll-xs"
                    />
                  </div>
                </div>

                {/* Legal Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                    Legal Entity Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Acme Corporation Pvt. Ltd."
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary text-payroll-navy shadow-payroll-xs"
                  />
                </div>

                {/* PAN / VAT & Registration Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                      PAN / VAT Number
                    </label>
                    <input
                      type="text"
                      value={panVatNumber}
                      onChange={(e) =>
                        setPanVatNumber(
                          e.target.value.replace(/\D/g, "").slice(0, 9),
                        )
                      }
                      placeholder="e.g. 601234567"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary text-payroll-navy shadow-payroll-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                      Company Registration No.
                    </label>
                    <input
                      type="text"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      placeholder="e.g. 123456/080/081"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary text-payroll-navy shadow-payroll-xs"
                    />
                  </div>
                </div>

                {/* Head Office Address & Contact Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                      Company Head Office Address
                    </label>
                    <input
                      type="text"
                      value={headOfficeAddress}
                      onChange={(e) => setHeadOfficeAddress(e.target.value)}
                      placeholder="e.g. Putalisadak, Kathmandu"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary text-payroll-navy shadow-payroll-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                        Contact Phone
                      </label>
                      {!phoneError && contactPhone && (
                        <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Valid
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
                      <p className="text-[11px] text-rose-600 font-semibold">
                        {phoneError}
                      </p>
                    )}
                  </div>
                </div>

                {/* Organization Industry Sector & Internal Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                        Organization Industry Sector (संस्थाको क्षेत्र)
                      </label>
                      <span className="text-[10px] text-payroll-primary font-semibold">
                        Super Admin Exclusive
                      </span>
                    </div>
                    <select
                      value={industryType}
                      onChange={(e) =>
                        setIndustryType(e.target.value as IndustrySectorKey)
                      }
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary text-payroll-navy shadow-payroll-xs"
                    >
                      {(Object.keys(INDUSTRY_SECTORS) as IndustrySectorKey[]).map(
                        (key) => {
                          const sec = INDUSTRY_SECTORS[key];
                          return (
                            <option key={key} value={key}>
                              {sec.label} — {sec.labelNepali}
                            </option>
                          );
                        },
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                      Super Admin Notes (Internal)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional internal notes about this company..."
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary text-payroll-navy resize-none shadow-payroll-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
                TAB 2: HEAD OFFICE BRANCH SETUP
            ════════════════════════════════════════════════════════════════════ */}
            {activeTab === "branch" && (
              <div className="space-y-4">
                <div className="p-3 bg-payroll-cream/40 rounded-xl border border-payroll-light text-xs text-gray-600">
                  <p className="font-semibold text-payroll-navy">
                    Primary Corporate Branch Management
                  </p>
                  <p className="text-[11px] mt-0.5">
                    The head office branch carries the organization brand name
                    and is differentiated by branch code and physical address.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                      Branch Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={headOfficeBranchCode}
                      onChange={(e) =>
                        setHeadOfficeBranchCode(e.target.value.toUpperCase())
                      }
                      placeholder="HO-01"
                      className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary text-payroll-navy shadow-payroll-xs"
                    />
                    <p className="text-[10px] text-gray-500">
                      Unique corporate code for this branch
                    </p>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                        Branch Address / Location{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setHeadOfficeBranchAddress(headOfficeAddress)
                        }
                        className="text-[11px] font-semibold text-payroll-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Sync from Head Office Address</span>
                      </button>
                    </div>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-payroll-primary absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={headOfficeBranchAddress}
                        onChange={(e) =>
                          setHeadOfficeBranchAddress(e.target.value)
                        }
                        placeholder="Putalisadak, Kathmandu"
                        className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary text-payroll-navy shadow-payroll-xs"
                      />
                    </div>
                    <p className="text-[10px] text-gray-500">
                      Syncs to the tenant&apos;s primary record in the{" "}
                      <code className="font-mono text-payroll-primary">
                        branches
                      </code>{" "}
                      table.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
                TAB 3: ACTIVE FISCAL YEAR
            ════════════════════════════════════════════════════════════════════ */}
            {activeTab === "fiscal-year" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                      Active Operating Fiscal Year
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Super Admin establishes or updates the active cycle for this company
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        setFyModalMode("add");
                        setIsFYModalOpen(true);
                      }}
                      className="border-payroll-light text-payroll-navy hover:bg-payroll-cream text-xs h-7.5 px-2.5 font-medium flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5 text-payroll-primary" />
                      <span>Add Fiscal Year</span>
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      onClick={() => {
                        setFyModalMode("edit");
                        setIsFYModalOpen(true);
                      }}
                      className="bg-payroll-primary hover:bg-payroll-primary/90 text-white text-xs h-7.5 px-2.5 font-semibold flex items-center gap-1.5 shadow-2xs"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit Fiscal Year</span>
                    </Button>
                  </div>
                </div>

                {/* Active Fiscal Year Primary Display Card */}
                <div className="p-5 rounded-2xl border border-payroll-primary/30 bg-linear-to-br from-payroll-primary/5 via-white to-payroll-cream/30 shadow-payroll-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-payroll-light/60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-payroll-primary/10 border border-payroll-primary/20 flex items-center justify-center text-payroll-primary shrink-0">
                        <CalendarDays className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-payroll-navy">
                            {fyLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {fyStatus === "Active" ? "Active Operating Cycle" : "Configured Cycle"}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                          Database Slug: <span className="text-payroll-primary font-semibold">{fySlug}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 3 Detail Blocks */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                    <div className="p-3 bg-white rounded-xl border border-payroll-light/70 shadow-2xs">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                        Bikram Sambat (BS) Range
                      </span>
                      <span className="text-xs font-mono font-bold text-payroll-navy mt-1 block">
                        {fyStartDateBS} ~ {fyEndDateBS}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        Bikram Sambat calendar
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-payroll-light/70 shadow-2xs">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                        Gregorian (AD) Equivalent
                      </span>
                      <span className="text-xs font-mono font-bold text-payroll-navy mt-1 block">
                        {formatADDate(fyStartDateAD, "short")} to {formatADDate(fyEndDateAD, "short")}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        Stored in tenant DB as AD timestamp
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-payroll-light/70 shadow-2xs">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                        Operational Month Range
                      </span>
                      <span className="text-xs font-bold text-payroll-navy mt-1 block">
                        {BS_MONTHS_EN[fyFromMonth]} to {BS_MONTHS_EN[fyToMonth]}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        Month {fyFromMonth} through Month {fyToMonth} (12 Mo.)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-payroll-cream/50 rounded-xl border border-payroll-light/70 text-xs text-payroll-navy flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-payroll-primary shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-payroll-navy">
                      Active Cycle: <strong>{fyLabel}</strong> ({BS_MONTHS_EN[fyFromMonth]} to {BS_MONTHS_EN[fyToMonth]})
                    </p>
                    <p className="text-[11px] text-gray-600">
                      Changes made here synchronize with the tenant&apos;s <code>fiscal_years</code> table using canonical Bikram Sambat date mappings.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
                TAB 4: STATUTORY LEAVES & OVERTIME
            ════════════════════════════════════════════════════════════════════ */}
            {activeTab === "leaves" && (
              <div className="space-y-4">
                {/* Overtime Multiplier */}
                <div className="p-3.5 bg-payroll-cream/40 rounded-xl border border-payroll-light flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-payroll-primary" />
                    <div>
                      <h4 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                        Statutory Overtime Multiplier Rate
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Nepal Labour Act Section 31 standard multiplier (default
                        1.5x basic hourly wage)
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-payroll-light shadow-2xs">
                    <span className="text-xs font-bold text-gray-600">
                      Rate:
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="3"
                      value={otHourlyMultiplier}
                      onChange={(e) =>
                        setOtHourlyMultiplier(parseFloat(e.target.value) || 1.5)
                      }
                      className="w-16 px-2 py-0.5 text-xs text-center font-mono font-bold bg-payroll-cream/50 border border-payroll-light rounded-lg text-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
                    />
                    <span className="text-xs font-bold text-gray-600">x</span>
                  </div>
                </div>

                {/* Statutory Leave Types */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                      Statutory Leave Policies ({leaveTypes.length})
                    </h4>
                    <span className="text-[11px] text-gray-500">
                      Directly editable days, encashability, and accumulation
                      caps
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {leaveTypes.map((lt, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white rounded-xl border border-payroll-light shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-payroll-navy">
                              {lt.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-payroll-cream text-payroll-primary border border-payroll-light rounded">
                              {lt.code}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              • {lt.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-600">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={lt.isPaid}
                                onChange={() => handleToggleLeavePaid(idx)}
                                className="rounded text-payroll-primary focus:ring-payroll-primary"
                              />
                              <span>Paid Leave</span>
                            </label>

                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(lt.isEncashable)}
                                onChange={() =>
                                  handleToggleLeaveEncashable(idx)
                                }
                                className="rounded text-payroll-primary focus:ring-payroll-primary"
                              />
                              <span>Encashable</span>
                            </label>

                            {lt.isEncashable && (
                              <div className="inline-flex items-center gap-1 text-[11px]">
                                <span>Cap:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="300"
                                  value={lt.maxAccumulation || 0}
                                  onChange={(e) =>
                                    handleUpdateLeaveMaxAccumulation(
                                      idx,
                                      parseInt(e.target.value) || 0,
                                    )
                                  }
                                  className="w-14 px-1.5 py-0.5 text-xs text-center font-mono font-bold bg-payroll-cream/50 border border-payroll-light rounded"
                                />
                                <span>d</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-payroll-navy">
                            Days / Year:
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="365"
                            value={lt.daysPerYear}
                            onChange={(e) =>
                              handleUpdateLeaveDays(
                                idx,
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-16 px-2 py-1 text-xs text-center font-mono font-bold bg-payroll-cream/50 border border-payroll-light rounded-lg text-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-2xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
                TAB 5: STANDARD PAY HEADS
            ════════════════════════════════════════════════════════════════════ */}
            {activeTab === "pay-heads" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                      Standard Pay Heads & Deductions ({payHeads.length})
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Configure earnings, statutory deductions, and tax effects
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => setShowAddPayHead(!showAddPayHead)}
                    className="text-xs font-bold text-payroll-primary"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    <span>Add Pay Head</span>
                  </Button>
                </div>

                {/* Inline Add Pay Head Form */}
                {showAddPayHead && (
                  <div className="p-3.5 bg-payroll-cream/40 rounded-xl border border-payroll-light space-y-3">
                    <h5 className="text-xs font-bold text-payroll-navy uppercase">
                      New Pay Head Component
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-gray-600 block mb-1">
                          Head Name
                        </label>
                        <input
                          type="text"
                          value={newPayHeadName}
                          onChange={(e) => setNewPayHeadName(e.target.value)}
                          placeholder="e.g. Communication Allowance"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-payroll-light bg-white text-payroll-navy"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-600 block mb-1">
                          Code
                        </label>
                        <input
                          type="text"
                          value={newPayHeadCode}
                          onChange={(e) =>
                            setNewPayHeadCode(e.target.value.toUpperCase())
                          }
                          placeholder="COMM"
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-payroll-light bg-white text-payroll-navy"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-600 block mb-1">
                          Type
                        </label>
                        <select
                          value={newPayHeadType}
                          onChange={(e) =>
                            setNewPayHeadType(e.target.value as any)
                          }
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-payroll-light bg-white text-payroll-navy"
                        >
                          <option value="EARNING">Earning</option>
                          <option value="DEDUCTION">Deduction</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-payroll-navy cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPayHeadTaxable}
                          onChange={(e) =>
                            setNewPayHeadTaxable(e.target.checked)
                          }
                          className="rounded text-payroll-primary focus:ring-payroll-primary"
                        />
                        <span>Taxable / Affects Income Tax</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => setShowAddPayHead(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          onClick={handleAddPayHead}
                          className="bg-payroll-primary text-white font-bold"
                        >
                          Add to Pay Heads
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* List of Pay Heads */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {payHeads.map((ph) => {
                    const isEarning = ph.type === "EARNING";
                    return (
                      <div
                        key={ph.code}
                        className="p-3 bg-white rounded-xl border border-payroll-light shadow-2xs flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            {isEarning ? (
                              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <ArrowDownRight className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span className="text-xs font-bold text-payroll-navy">
                              {ph.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono font-bold text-gray-500">
                              {ph.code}
                            </span>
                            <span className="text-[10px] text-gray-400">•</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                isEarning
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {isEarning ? "Earning" : "Deduction"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTogglePayHeadTaxable(ph.code)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border cursor-pointer transition-all ${
                              ph.isTaxable
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-gray-50 border-gray-200 text-gray-500"
                            }`}
                          >
                            {ph.isTaxable ? "Taxable" : "Tax-Exempt"}
                          </button>

                          {/* Allow removing custom pay heads */}
                          {!ph.isSsfHead &&
                            !ph.isSsfEmployerHead &&
                            !ph.isPfHead &&
                            !ph.isCitHead &&
                            !ph.isTdsHead &&
                            ph.code !== "BASIC" && (
                              <button
                                type="button"
                                onClick={() => handleRemovePayHead(ph.code)}
                                className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                                title="Delete Pay Head"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
                TAB 6: NEPAL IRD PROGRESSIVE TAX SLABS
            ════════════════════════════════════════════════════════════════════ */}
            {activeTab === "tax-slabs" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
                      Progressive Income Tax Slabs ({fyLabel})
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Nepal Income Tax Act 2058 / Finance Act progressive tax
                      brackets
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={handleResetTaxSlabs}
                    className="text-[11px] font-semibold text-payroll-primary"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    <span>Reset to Standard</span>
                  </Button>
                </div>

                {/* Category Selector */}
                <div className="flex items-center gap-1.5 bg-payroll-cream/50 p-1 rounded-xl border border-payroll-light">
                  {["Normal Single", "Married", "Handicapped"].map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedTaxCategory(cat)}
                        className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          selectedTaxCategory === cat
                            ? "bg-white text-payroll-navy shadow-2xs border border-payroll-light"
                            : "text-gray-500 hover:text-payroll-navy"
                        }`}
                      >
                        {cat}
                      </button>
                    ),
                  )}
                </div>

                {/* Table of Brackets for the selected category */}
                <div className="bg-white rounded-xl border border-payroll-light overflow-hidden shadow-2xs">
                  <div className="grid grid-cols-12 gap-2 bg-payroll-cream/40 p-2.5 text-[10px] font-bold text-payroll-navy uppercase tracking-wider border-b border-payroll-light">
                    <span className="col-span-4">Income Bracket (NPR)</span>
                    <span className="col-span-3">
                      Upper Limit (Empty = Above)
                    </span>
                    <span className="col-span-2 text-center">Rate (%)</span>
                    <span className="col-span-3 text-right">
                      Fixed Deduction (NPR)
                    </span>
                  </div>

                  <div className="divide-y divide-payroll-light/60 p-1">
                    {filteredTaxSlabs.map((slab, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center p-2 text-xs"
                      >
                        <div className="col-span-4">
                          <input
                            type="number"
                            value={slab.amountFrom}
                            onChange={(e) =>
                              handleUpdateTaxSlab(
                                idx,
                                "amountFrom",
                                e.target.value,
                              )
                            }
                            className="w-full px-2 py-1 text-xs font-mono rounded border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>

                        <div className="col-span-3">
                          <input
                            type="number"
                            value={slab.amountTo || ""}
                            onChange={(e) =>
                              handleUpdateTaxSlab(
                                idx,
                                "amountTo",
                                e.target.value ? e.target.value : null,
                              )
                            }
                            placeholder="And above"
                            className="w-full px-2 py-1 text-xs font-mono rounded border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>

                        <div className="col-span-2 text-center">
                          <div className="inline-flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              step="0.01"
                              value={slab.ratePercent}
                              onChange={(e) =>
                                handleUpdateTaxSlab(
                                  idx,
                                  "ratePercent",
                                  e.target.value,
                                )
                              }
                              className="w-14 px-1.5 py-1 text-xs text-center font-mono font-bold rounded border border-payroll-light bg-payroll-cream/20 text-payroll-primary"
                            />
                            <span className="text-[10px] text-gray-500">%</span>
                          </div>
                        </div>

                        <div className="col-span-3 text-right">
                          <input
                            type="number"
                            value={slab.fixedDeduction || "0"}
                            onChange={(e) =>
                              handleUpdateTaxSlab(
                                idx,
                                "fixedDeduction",
                                e.target.value,
                              )
                            }
                            className="w-full px-2 py-1 text-xs font-mono text-right rounded border border-payroll-light bg-payroll-cream/20 text-payroll-navy"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
        </div>
      </Dialog>

      {/* Modal for adding or editing the Fiscal Year in company edit */}
      {isFYModalOpen && (
        <FiscalYearFormModal
          key={fyModalMode === "edit" ? `edit-${fySlug}` : "add-new"}
          open={isFYModalOpen}
          onClose={() => setIsFYModalOpen(false)}
          initialValue={fyModalInitialValue}
          onSubmit={handleSaveFYFromModal}
        />
      )}
    </>
  );
}
