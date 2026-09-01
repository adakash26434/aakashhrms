"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, CreditCard, Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { useToast } from "@/components/ui/toast";
import type {
  LoanType,
  Loan,
  LoanKPIs,
  LoanTypeFormData,
  DisburseLoanFormData,
  RepaymentFormData,
  LoanTypeValidationErrors,
  DisbursementValidationErrors,
  RepaymentValidationErrors,
  LoanLookupData,
} from "@/lib/types/loan";
import {
  saveLoanTypeAction,
  deleteLoanTypeAction,
  disburseLoanAction,
  recordRepaymentAction,
  getLoanTypesAction,
  getLoansAction,
  getLoanLookupDataAction,
} from "@/app/actions/loan.actions";
import { LoanKPICards } from "./loan-kpi-cards";
import { LoanTypesTable } from "./loan-types-table";
import { EmployeeLoansTable } from "./employee-loans-table";
import { LoanTypeModal } from "./loan-type-modal";
import { LoanDisbursementModal } from "./loan-disbursement-modal";
import { LoanRepaymentModal } from "./loan-repayment-modal";
import { LoanDetailsModal } from "./loan-details-modal";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

type ActiveTab = "loans" | "types";

interface LoanClientProps {
  initialLoanTypes: LoanType[];
  initialLoanTypeKPIs: { total: number; active: number; inactive: number };
  initialLoans: Loan[];
  initialLoanKPIs: LoanKPIs;
}

export function LoanClient({
  initialLoanTypes,
  initialLoanTypeKPIs,
  initialLoans,
  initialLoanKPIs,
}: LoanClientProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("loans");
  const [loanTypes, setLoanTypes] = useState(initialLoanTypes);
  const [loanTypeKPIs, setLoanTypeKPIs] = useState(initialLoanTypeKPIs);
  const [loansList, setLoansList] = useState(initialLoans);
  const [loanKPIs, setLoanKPIs] = useState(initialLoanKPIs);

  // Modals
  const [isLoanTypeModalOpen, setIsLoanTypeModalOpen] = useState(false);
  const [editingLoanType, setEditingLoanType] = useState<LoanType | null>(null);
  const [isDisbursementModalOpen, setIsDisbursementModalOpen] = useState(false);
  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LoanType | null>(null);

  // Loan Details Modal
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Validation errors
  const [loanTypeErrors, setLoanTypeErrors] = useState<LoanTypeValidationErrors>({});
  const [disbursementErrors, setDisbursementErrors] = useState<DisbursementValidationErrors>({});
  const [repaymentErrors, setRepaymentErrors] = useState<RepaymentValidationErrors>({});

  // Lookup data for disbursement/repayment modals
  const [lookupData, setLookupData] = useState<LoanLookupData | null>(null);

  const toast = useToast();
  const [banner, setBanner] = useState<{
    visible: boolean;
    message: string;
    tone: "success" | "info";
  }>({ visible: false, message: "", tone: "success" });

  const showBanner = (message: string, tone: "success" | "info" = "success") => {
    setBanner({ visible: true, message, tone });
    if (tone === "success") {
      toast.success(message);
    } else {
      toast.info(message);
    }
    setTimeout(() => setBanner((b) => ({ ...b, visible: false })), 4000);
  };

  // Refresh functions
  const refreshLoanTypes = useCallback(async () => {
    const res = await getLoanTypesAction();
    if (res.success && res.data) {
      setLoanTypes(res.data.loanTypes);
      setLoanTypeKPIs(res.data.kpis);
    }
  }, []);

  const refreshLoans = useCallback(async () => {
    const res = await getLoansAction();
    if (res.success && res.data) {
      setLoansList(res.data.loans);
      setLoanKPIs(res.data.kpis);
    }
  }, []);

  // Load lookup data when disbursement or repayment modal opens
  useEffect(() => {
    if (isDisbursementModalOpen || isRepaymentModalOpen) {
      getLoanLookupDataAction().then((res) => {
        if (res.success && res.data) {
          setLookupData(res.data);
        }
      });
    }
  }, [isDisbursementModalOpen, isRepaymentModalOpen]);

  // --- Handlers ---

  const handleSaveLoanType = async (id: string | null, data: LoanTypeFormData) => {
    setLoanTypeErrors({});
    const res = await saveLoanTypeAction(id, data);
    if (res.success) {
      setIsLoanTypeModalOpen(false);
      setEditingLoanType(null);
      showBanner(id ? "Loan type updated successfully." : "Loan type created successfully.");
      await refreshLoanTypes();
    } else if ('validationErrors' in res && res.validationErrors) {
      setLoanTypeErrors(res.validationErrors as LoanTypeValidationErrors);
    } else {
      showBanner(res.error || "Failed to save loan type.", "info");
    }
  };

  const handleDeleteLoanType = async () => {
    if (!deleteTarget) return;
    const res = await deleteLoanTypeAction(deleteTarget.id);
    if (res.success) {
      setDeleteTarget(null);
      showBanner("Loan type deleted successfully.");
      await refreshLoanTypes();
    } else {
      showBanner(res.error || "Failed to delete loan type.", "info");
    }
  };

  const handleDisburseLoan = async (data: DisburseLoanFormData) => {
    setDisbursementErrors({});
    const res = await disburseLoanAction(data);
    if (res.success) {
      setIsDisbursementModalOpen(false);
      showBanner("Loan disbursed successfully.");
      await refreshLoans();
    } else if ('validationErrors' in res && res.validationErrors) {
      setDisbursementErrors(res.validationErrors as DisbursementValidationErrors);
    } else {
      showBanner(res.error || "Failed to disburse loan.", "info");
    }
  };

  const handleRecordRepayment = async (data: RepaymentFormData) => {
    setRepaymentErrors({});
    const res = await recordRepaymentAction(data);
    if (res.success) {
      setIsRepaymentModalOpen(false);
      showBanner("Repayment recorded successfully.");
      await refreshLoans();
    } else if ('validationErrors' in res && res.validationErrors) {
      setRepaymentErrors(res.validationErrors as RepaymentValidationErrors);
    } else {
      showBanner(res.error || "Failed to record repayment.", "info");
    }
  };

  const handleSelectLoan = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsDetailsModalOpen(true);
  };

  const handleRecordPaymentFromTable = (loan: Loan) => {
    // Pre-set the repayment modal context would require more refactoring,
    // so we just open the repayment modal
    setRepaymentErrors({});
    setIsRepaymentModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-350 space-y-6">
      {/* Banner */}
      <Banner
        visible={banner.visible}
        message={banner.message}
        tone={banner.tone}
        onDismiss={() => setBanner((b) => ({ ...b, visible: false }))}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1b3a1f]">Loan Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Staff loan disbursement, EMI scheduling, repayment tracking, and running balance across all branches.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "types" && (
            <Button
              onClick={() => {
                setEditingLoanType(null);
                setLoanTypeErrors({});
                setIsLoanTypeModalOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Loan Type
            </Button>
          )}
          {activeTab === "loans" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setRepaymentErrors({});
                  setIsRepaymentModalOpen(true);
                }}
              >
                Record Cash Payment
              </Button>
              <Button
                onClick={() => {
                  setDisbursementErrors({});
                  setIsDisbursementModalOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                New Loan
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab("loans")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "loans"
              ? "bg-white text-[#1b3a1f] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Employee Loans
        </button>
        <button
          onClick={() => setActiveTab("types")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "types"
              ? "bg-white text-[#1b3a1f] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Settings className="h-4 w-4" />
          Loan Types
        </button>
      </div>

      {/* Content */}
      {activeTab === "loans" && (
        <>
          <LoanKPICards kpis={loanKPIs} />
          <EmployeeLoansTable
            loans={loansList}
            onSelectLoan={handleSelectLoan}
            onRecordPayment={handleRecordPaymentFromTable}
          />
        </>
      )}

      {activeTab === "types" && (
        <>
          {/* Simple KPI row for loan types */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total Types</p>
                  <p className="text-2xl font-semibold tabular-nums text-[#1b3a1f]">{loanTypeKPIs.total}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-2.5 text-[#2e7d32]">
                  <Settings className="h-5 w-5" />
                </div>
              </div>
            </Card>
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Active</p>
                  <p className="text-2xl font-semibold tabular-nums text-[#1b3a1f]">{loanTypeKPIs.active}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
                  <Settings className="h-5 w-5" />
                </div>
              </div>
            </Card>
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Inactive</p>
                  <p className="text-2xl font-semibold tabular-nums text-[#1b3a1f]">{loanTypeKPIs.inactive}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-2.5 text-red-500">
                  <Settings className="h-5 w-5" />
                </div>
              </div>
            </Card>
          </div>
          <LoanTypesTable
            loanTypes={loanTypes}
            onEdit={(lt) => {
              setEditingLoanType(lt);
              setLoanTypeErrors({});
              setIsLoanTypeModalOpen(true);
            }}
            onDelete={(lt) => setDeleteTarget(lt)}
          />
        </>
      )}

      {/* Modals */}
      <LoanTypeModal
        open={isLoanTypeModalOpen}
        onClose={() => {
          setIsLoanTypeModalOpen(false);
          setEditingLoanType(null);
        }}
        onSave={handleSaveLoanType}
        initialData={editingLoanType}
        validationErrors={loanTypeErrors}
      />

      <LoanDisbursementModal
        open={isDisbursementModalOpen}
        onClose={() => setIsDisbursementModalOpen(false)}
        onSave={handleDisburseLoan}
        lookupData={lookupData}
        validationErrors={disbursementErrors}
      />

      <LoanRepaymentModal
        open={isRepaymentModalOpen}
        onClose={() => setIsRepaymentModalOpen(false)}
        onSave={handleRecordRepayment}
        employees={lookupData?.employees || []}
        validationErrors={repaymentErrors}
      />

      <LoanDetailsModal
        open={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedLoan(null);
        }}
        loan={selectedLoan}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteLoanType}
      />
    </div>
  );
}
