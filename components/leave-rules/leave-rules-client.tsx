"use client";

import { useState, useCallback } from "react";
import { Plus, HelpCircle, BookOpen, Scale, FileText, CheckCircle2 } from "lucide-react";
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
  embedded?: boolean;
}

function LeaveRuleKPICards({ kpis }: { kpis: LeaveRuleKPIs }) {
  const metrics = [
    {
      label: "Total leave policies",
      value: kpis.total,
      subtext: "Enacted entitlement rules",
      icon: BookOpen,
      iconColor: "text-zinc-400",
    },
    {
      label: "Statutory rules",
      value: kpis.statutory,
      subtext: "Labour Act compliance",
      icon: CheckCircle2,
      iconColor: "text-emerald-700",
    },
    {
      label: "Company policies",
      value: kpis.company,
      subtext: "Internal entity accruals",
      icon: FileText,
      iconColor: "text-zinc-600",
    },
    {
      label: "Active rules",
      value: kpis.active,
      subtext: "Actively enforced in cycles",
      icon: Scale,
      iconColor: "text-emerald-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.label}
            className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0"
          >
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">{m.label}</p>
                <Icon className={`h-4 w-4 ${m.iconColor}`} />
              </div>
              <div className="mt-2.5">
                <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                  {m.value}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
              {m.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LeaveRulesClient({
  initialRules,
  initialKpis,
  leaveTypes,
  embedded = false,
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
  }>({
    visible: false,
    message: "",
    tone: "success",
  });

  const showBanner = (
    message: string,
    tone: "success" | "info" = "success"
  ) => {
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
    ? `Are you sure you want to delete the leave rule for "${deleteTarget.leaveTypeName}"? This action cannot be undone.`
    : "";

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 p-6 mx-auto max-w-350"}>
      <Banner
        visible={banner.visible}
        message={banner.message}
        tone={banner.tone}
        onDismiss={() => setBanner({ ...banner, visible: false })}
      />

      <div className="flex items-center justify-between">
        <div>
          {!embedded && (
            <h1 className="text-xl font-bold text-[#1b3a1f] flex items-center gap-2">
              ⚖️ Leave Rules
            </h1>
          )}
          <p className="text-sm text-gray-500">
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
