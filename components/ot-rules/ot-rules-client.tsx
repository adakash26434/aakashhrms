"use client";

import { useState, useCallback } from "react";
import { Timer, Clock } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type {
  OtRule,
  OtRuleKPIs,
  OtRuleFormData,
} from "@/lib/types/ot-rule";
import {
  saveOtRuleAction,
  deleteOtRuleAction,
  getOtRulesWithKPIsAction,
} from "@/app/actions/ot-rule.actions";
import { OtRulesTable } from "@/components/ot-rules/ot-rules-table";
import { OtRuleFormModal } from "@/components/ot-rules/ot-rule-form-modal";
import { ConfirmDeleteDialog } from "@/components/ot-rules/confirm-delete-dialog";

interface OtRulesClientProps {
  initialOtRules: OtRule[];
  initialOtKPIs: OtRuleKPIs;
  otMultiplierOfficeDay?: number;
  otMultiplierOffDay?: number;
  embedded?: boolean;
}

function OtKPICards({
  kpis,
  multiplierOfficeDay,
  multiplierOffDay,
}: {
  kpis: OtRuleKPIs;
  multiplierOfficeDay: number;
  multiplierOffDay: number;
}) {
  const metrics = [
    {
      label: "Total overtime rules",
      value: "2",
      subtext: "Office & weekly rest policies",
      icon: Timer,
      iconColor: "text-zinc-400",
    },
    {
      label: "Office day multiplier",
      value: `${multiplierOfficeDay.toFixed(1)}x`,
      subtext: "Standard hourly rate factor",
      icon: Clock,
      iconColor: "text-amber-500",
    },
    {
      label: "Off day multiplier",
      value: `${multiplierOffDay.toFixed(1)}x`,
      subtext: "Holiday / weekend rate factor",
      icon: Clock,
      iconColor: "text-emerald-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
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

export function OtRulesClient({
  initialOtRules,
  initialOtKPIs,
  otMultiplierOfficeDay = 1.5,
  otMultiplierOffDay = 1.5,
  embedded = false,
}: OtRulesClientProps) {
  const [otRules, setOtRules] = useState<OtRule[]>(initialOtRules);
  const [otKPIs, setOtKPIs] = useState<OtRuleKPIs>(initialOtKPIs);
  const [otFormOpen, setOtFormOpen] = useState(false);
  const [otFormSession, setOtFormSession] = useState(0);
  const [editingOtRule, setEditingOtRule] = useState<OtRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const toast = useToast();

  const handleNewOtRule = useCallback(() => {
    setEditingOtRule(null);
    setOtFormSession((s) => s + 1);
    setOtFormOpen(true);
  }, []);

  const handleEditOtRule = useCallback((rule: OtRule) => {
    setEditingOtRule(rule);
    setOtFormSession((s) => s + 1);
    setOtFormOpen(true);
  }, []);

  const handleSaveOtRule = useCallback(
    async (id: string | null, data: OtRuleFormData) => {
      const res = await saveOtRuleAction(id, data);
      if (res.success && res.data) {
        toast.success(
          id
            ? "Overtime rule updated successfully."
            : "New overtime rule created successfully."
        );
        const refresh = await getOtRulesWithKPIsAction();
        if (refresh.success && refresh.data) {
          setOtRules(refresh.data.rules);
          setOtKPIs(refresh.data.kpis);
        }
      } else {
        throw new Error(res.error || "Failed to save OT rule.");
      }
    },
    [toast]
  );

  const handleDeleteRequest = useCallback((rule: OtRule) => {
    setDeleteTarget({ id: rule.id, name: rule.ruleName });
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const res = await deleteOtRuleAction(deleteTarget.id);
      if (res.success) {
        toast.success("Overtime rule deleted successfully.");
        const refresh = await getOtRulesWithKPIsAction();
        if (refresh.success && refresh.data) {
          setOtRules(refresh.data.rules);
          setOtKPIs(refresh.data.kpis);
        }
      } else {
        toast.error(res.error || "Failed to delete OT rule.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete OT rule.");
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, toast]);

  const deleteDescription = deleteTarget
    ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
    : "";

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 p-6 mx-auto max-w-350"}>
      <div className="flex items-center justify-between">
        <div>
          {!embedded && (
            <h1 className="text-xl font-semibold text-[#1b3a1f]">
              ⏱️ Overtime Rules
            </h1>
          )}
          <p className="text-sm text-gray-500">
            Configure overtime calculation multipliers for the organization.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 text-sm text-green-800 flex items-start gap-3 shadow-sm">
          <Clock className="h-5 w-5 shrink-0 mt-0.5 text-green-600" />
          <div className="space-y-1">
            <strong className="block text-[#1b3a1f] font-bold">
              Statutory Global Overtime Standard Active
            </strong>
            <p className="text-sm text-green-700 leading-relaxed font-semibold">
              As per Section 2(a) and Section 37 of **Nepal&apos;s Labour Act, 2017
              (2074)**, overtime is calculated globally for all employees at
              **1.5 times** the basic hourly rate:
            </p>
            <div className="mt-2 pl-3 border-l-2 border-green-300 font-mono text-[12px] text-green-800 space-y-0.5">
              <p>
                Hourly Rate = Basic Monthly Salary / (30 days &times; 8 hours)
                = Basic Salary / 240
              </p>
              <p>
                OT Pay = Overtime Hours Worked &times; (Hourly Rate &times;
                1.5)
              </p>
            </div>
            <p className="text-[11px] text-green-600 mt-2 italic">
              Custom overtime rules are disabled as the statutory calculation
              is enforced globally.
            </p>
          </div>
        </div>

        <OtKPICards
          kpis={otKPIs}
          multiplierOfficeDay={otMultiplierOfficeDay}
          multiplierOffDay={otMultiplierOffDay}
        />
        <OtRulesTable
          rules={[
            {
              id: "statutory-office",
              ruleName: "Nepal Labour Act - Office Day Overtime",
              ruleType: "Hourly",
              rateOfficeDay: 1.5,
              rateOffDay: 0.0,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: "statutory-off",
              ruleName: "Company OT Rule - Off Day / Holiday Overtime",
              ruleType: "Hourly",
              rateOfficeDay: 0.0,
              rateOffDay: otMultiplierOffDay,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]}
          onEdit={handleEditOtRule}
          onDelete={handleDeleteRequest}
        />
      </div>

      <OtRuleFormModal
        key={`ot-rule-form-${otFormSession}`}
        open={otFormOpen}
        onClose={() => setOtFormOpen(false)}
        onSave={handleSaveOtRule}
        rule={editingOtRule}
      />
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Rule"
        description={deleteDescription}
      />
    </div>
  );
}
