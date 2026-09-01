"use client";

import { useState, useCallback, useMemo } from "react";
import { Plus, HelpCircle, Calendar, ShieldCheck, UserCheck, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { useToast } from "@/components/ui/toast";
import type {
  LeaveTypeRecord,
  LeaveTypeKPIs,
  LeaveTypeFormData,
} from "@/lib/types/leave-type";
import {
  saveLeaveTypeAction,
  deleteLeaveTypeAction,
  getLeaveTypesWithKPIsAction,
} from "@/app/actions/leave-type.actions";
import dynamic from "next/dynamic";
import { LeaveTypesTable } from "./leave-types-table";

const LeaveTypeFormModal = dynamic(
  () => import("./leave-type-form-modal").then((m) => m.LeaveTypeFormModal),
  { ssr: false }
);

const ConfirmDeleteDialog = dynamic(
  () => import("../ot-rules/confirm-delete-dialog").then((m) => m.ConfirmDeleteDialog),
  { ssr: false }
);

interface LeaveTypesClientProps {
  initialTypes: LeaveTypeRecord[];
  initialKpis: LeaveTypeKPIs;
}

function LeaveTypeKPICards({ kpis }: { kpis: LeaveTypeKPIs }) {
  const metrics = [
    {
      label: "Total Leave Types",
      value: kpis.total,
      icon: Calendar,
      tone: "bg-green-50 text-[#2e7d32]",
    },
    {
      label: "Statutory (Mandatory)",
      value: kpis.statutory,
      icon: ShieldCheck,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Company Custom",
      value: kpis.company,
      icon: UserCheck,
      tone: "bg-purple-50 text-purple-600",
    },
    {
      label: "Active Policies",
      value: kpis.active,
      icon: Scale,
      tone: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label} className="overflow-hidden border-payroll-light/60 shadow-sm">
          <div className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {m.label}
              </p>
              <p className="text-2xl font-semibold tabular-nums text-payroll-navy">
                {m.value}
              </p>
            </div>
            <div className={`rounded-lg p-2.5 ${m.tone}`}>
              <m.icon className="h-5 w-5" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function LeaveTypesClient({
  initialTypes,
  initialKpis,
}: LeaveTypesClientProps) {
  const [types, setTypes] = useState<LeaveTypeRecord[]>(initialTypes);
  const [kpis, setKpis] = useState<LeaveTypeKPIs>(initialKpis);
  const [formOpen, setFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [editingType, setEditingType] = useState<LeaveTypeRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeaveTypeRecord | null>(null);
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
  };

  const handleNewLeaveType = useCallback(() => {
    setEditingType(null);
    setFormSession((session) => session + 1);
    setFormOpen(true);
  }, []);

  const handleEditLeaveType = useCallback((type: LeaveTypeRecord) => {
    setEditingType(type);
    setFormSession((session) => session + 1);
    setFormOpen(true);
  }, []);

  const handleSaveLeaveType = useCallback(
    async (id: string | null, data: LeaveTypeFormData) => {
      const res = await saveLeaveTypeAction(id, data);
      if (res.success && res.data) {
        showBanner(
          id ? "Leave type updated successfully." : "New leave type created successfully."
        );
        const refresh = await getLeaveTypesWithKPIsAction();
        if (refresh.success && refresh.data) {
          setTypes(refresh.data.types);
          setKpis(refresh.data.kpis);
        }
      } else {
        throw new Error(res.error || "Failed to save leave type.");
      }
    },
    []
  );

  const handleDeleteRequest = useCallback((type: LeaveTypeRecord) => {
    if (type.isStatutory) {
      showBanner("Statutory leave types mandated by Nepal Labour Act 2074 cannot be deleted.", "info");
      return;
    }
    setDeleteTarget(type);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const res = await deleteLeaveTypeAction(deleteTarget.id);
    if (res.success) {
      showBanner("Leave type deleted successfully.");
      const refresh = await getLeaveTypesWithKPIsAction();
      if (refresh.success && refresh.data) {
        setTypes(refresh.data.types);
        setKpis(refresh.data.kpis);
      }
    } else {
      showBanner(res.error || "Failed to delete leave type.", "info");
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  }, [deleteTarget]);

  const deleteDescription = deleteTarget
    ? `Are you sure you want to delete the custom leave type "${deleteTarget.name}"? This action cannot be undone.`
    : "";

  return (
    <div className="space-y-6 p-6 mx-auto max-w-350">
      <Banner
        visible={banner.visible}
        message={banner.message}
        tone={banner.tone}
        onDismiss={() => setBanner({ ...banner, visible: false })}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-payroll-navy flex items-center gap-2">
            📅 Leave Types
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage statutory policies (Nepal Labour Act 2074) and custom company leave packages.
          </p>
        </div>
        <Button type="button" onClick={handleNewLeaveType} size="md">
          <Plus className="h-4 w-4" />
          New Leave Type
        </Button>
      </div>

      <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 text-sm text-green-800 flex items-start gap-3 shadow-sm">
        <HelpCircle className="h-5 w-5 shrink-0 mt-0.5 text-green-600" />
        <div className="space-y-1">
          <strong className="block text-payroll-navy font-bold">
            Nepal Labour Act 2074 Statutory Compliance
          </strong>
          <p className="text-sm text-green-700 leading-relaxed font-semibold">
            All registered companies in Nepal are legally required to provide Home, Sick, Mourning, Paternity, and Maternity leaves. Statutory types are protected from deletion to ensure continuous legal compliance.
          </p>
        </div>
      </div>

      <LeaveTypeKPICards kpis={kpis} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-payroll-navy">
            All Leave Types
          </h2>
        </div>
        <LeaveTypesTable
          types={types}
          onEdit={handleEditLeaveType}
          onDelete={handleDeleteRequest}
        />
      </div>

      <LeaveTypeFormModal
        key={`leave-type-form-${formSession}`}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveLeaveType}
        typeRecord={editingType}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Leave Type"
        description={deleteDescription}
      />
    </div>
  );
}
