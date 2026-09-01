"use client";

import { useState, useCallback } from "react";
import { Plus, HelpCircle, BookOpen, Scale, FileText, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { useToast } from "@/components/ui/toast";
import type {
  LeaveRule,
  LeaveRuleKPIs,
  LeaveRuleFormData,
} from "@/lib/types/leave-rule";
import {
  saveLeaveRuleAction,
  deleteLeaveRuleAction,
  getLeaveRulesWithKPIsAction,
} from "@/app/actions/leave-rule.actions";
import { LeaveRulesTable } from "./leave-rules-table";
import { LeaveRuleFormModal } from "./leave-rule-form-modal";
import { ConfirmDeleteDialog } from "../ot-rules/confirm-delete-dialog";

interface LeaveRulesClientProps {
  initialRules: LeaveRule[];
  initialKpis: LeaveRuleKPIs;
  leaveTypes: { id: string; name: string; code: string }[];
}

function LeaveRuleKPICards({ kpis }: { kpis: LeaveRuleKPIs }) {
  const metrics = [
    {
      label: "Total Policies",
      value: kpis.total,
      icon: BookOpen,
      tone: "bg-green-50 text-[#2e7d32]",
    },
    {
      label: "Statutory Rules",
      value: kpis.statutory,
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Company Policies",
      value: kpis.company,
      icon: FileText,
      tone: "bg-purple-50 text-purple-600",
    },
    {
      label: "Active Rules",
      value: kpis.active,
      icon: Scale,
      tone: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label} className="overflow-hidden border-[#d7e8d0]/60 shadow-sm">
          <div className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {m.label}
              </p>
              <p className="text-2xl font-semibold tabular-nums text-[#1b3a1f]">
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

export function LeaveRulesClient({
  initialRules,
  initialKpis,
  leaveTypes,
}: LeaveRulesClientProps) {
  const [rules, setRules] = useState<LeaveRule[]>(initialRules);
  const [kpis, setKpis] = useState<LeaveRuleKPIs>(initialKpis);
  const [formOpen, setFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [editingRule, setEditingRule] = useState<LeaveRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeaveRule | null>(null);
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

  const handleNewLeaveRule = useCallback(() => {
    setEditingRule(null);
    setFormSession((session) => session + 1);
    setFormOpen(true);
  }, []);

  const handleEditLeaveRule = useCallback((rule: LeaveRule) => {
    setEditingRule(rule);
    setFormSession((session) => session + 1);
    setFormOpen(true);
  }, []);

  const handleSaveLeaveRule = useCallback(
    async (id: string | null, data: LeaveRuleFormData) => {
      const res = await saveLeaveRuleAction(id, data);
      if (res.success && res.data) {
        showBanner(
          id ? "Leave rule updated successfully." : "New leave rule created successfully."
        );
        const refresh = await getLeaveRulesWithKPIsAction();
        if (refresh.success && refresh.data) {
          setRules(refresh.data.rules);
          setKpis(refresh.data.kpis);
        }
      } else {
        throw new Error(res.error || "Failed to save leave rule.");
      }
    },
    []
  );

  const handleDeleteRequest = useCallback((rule: LeaveRule) => {
    if (rule.ruleCategory === "STATUTORY") {
      showBanner("Statutory leave rules mandated by Nepal Labour Act 2074 cannot be deleted.", "info");
      return;
    }
    setDeleteTarget(rule);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const res = await deleteLeaveRuleAction(deleteTarget.id);
    if (res.success) {
      showBanner("Leave rule deleted successfully.");
      const refresh = await getLeaveRulesWithKPIsAction();
      if (refresh.success && refresh.data) {
        setRules(refresh.data.rules);
        setKpis(refresh.data.kpis);
      }
    } else {
      showBanner(res.error || "Failed to delete leave rule.", "info");
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  }, [deleteTarget]);

  const deleteDescription = deleteTarget
    ? `Are you sure you want to delete the leave rule "${deleteTarget.ruleName}"? This action cannot be undone.`
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
          <h1 className="text-xl font-bold text-[#1b3a1f] flex items-center gap-2">
            ⚖️ Leave Rules
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure how leave days are accrued, encashed, and statutory limits.
          </p>
        </div>
        <Button type="button" onClick={handleNewLeaveRule} size="md">
          <Plus className="h-4 w-4" />
          New Leave Rule
        </Button>
      </div>

      <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 text-sm text-green-800 flex items-start gap-3 shadow-sm">
        <HelpCircle className="h-5 w-5 shrink-0 mt-0.5 text-green-600" />
        <div className="space-y-1">
          <strong className="block text-[#1b3a1f] font-bold">
            Leave Accrual & Encashment Rules
          </strong>
          <p className="text-sm text-green-700 leading-relaxed font-semibold">
            Define accrual rates (e.g. 1 day per 20 days worked for Home Leave) and encashment parameters. Statutory rules are linked to their respective statutory leave categories and protect system compliance.
          </p>
        </div>
      </div>

      <LeaveRuleKPICards kpis={kpis} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1b3a1f]">
            Rule Matrix
          </h2>
        </div>
        <LeaveRulesTable
          rules={rules}
          onEdit={handleEditLeaveRule}
          onDelete={handleDeleteRequest}
        />
      </div>

      <LeaveRuleFormModal
        key={`leave-rule-form-${formSession}`}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveLeaveRule}
        ruleRecord={editingRule}
        leaveTypes={leaveTypes}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Leave Rule"
        description={deleteDescription}
      />
    </div>
  );
}
