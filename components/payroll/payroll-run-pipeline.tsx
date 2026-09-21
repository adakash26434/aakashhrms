"use client";

import { CheckCircle2, Circle, Clock, Lock } from "lucide-react";
import type { PayrollRun } from "@/lib/types/payroll";

interface PayrollRunPipelineProps {
  run: PayrollRun;
}

export function PayrollRunPipeline({ run }: PayrollRunPipelineProps) {
  const steps = [
    {
      label: "Draft Generated",
      status: "DRAFT",
      desc: "Initial calculation complete",
      time: run.createdAt,
      icon: Clock,
    },
    {
      label: "Submitted for Review",
      status: "UNDER_REVIEW",
      desc: run.notes || "Pending verification & audit",
      time: run.updatedAt,
      icon: Clock,
    },
    {
      label: "Approved",
      status: "APPROVED",
      desc: run.reviewedBy ? "Audited & approved" : "Awaiting final approval",
      time: run.reviewedAt,
      icon: CheckCircle2,
    },
    {
      label: "Locked & Disbursed",
      status: "LOCKED",
      desc: run.approvedBy ? "Authorized & amortized" : "Locked for bank payout",
      time: run.lockedAt,
      icon: Lock,
    },
  ];

  const order = ["DRAFT", "UNDER_REVIEW", "APPROVED", "LOCKED"];
  const currIdx = order.indexOf(run.status);

  const getStepState = (stepStatus: string) => {
    const stepIdx = order.indexOf(stepStatus);
    if (stepIdx < currIdx) return "COMPLETED";
    if (stepIdx === currIdx) return "ACTIVE";
    return "PENDING";
  };

  return (
    <div className="rounded-xl border border-payroll-light/80 bg-white p-5 shadow-payroll-xs">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
            Payroll Workflow Pipeline
          </h3>
          <span className="rounded-full bg-payroll-primary/10 px-2 py-0.5 text-[10px] font-bold text-payroll-primary">
            Step {currIdx + 1} of 4: {run.status.replace("_", " ")}
          </span>
        </div>
        <span className="text-[11px] text-gray-400 font-mono">
          Run ID: {run.id.slice(0, 8)}...
        </span>
      </div>

      <div className="relative flex flex-col gap-5 md:flex-row md:justify-between md:gap-2">
        {/* Connector line for large screens */}
        <div className="absolute left-6 top-5 hidden h-0.5 w-[85%] bg-payroll-light/80 md:block z-0" />

        {steps.map((step, idx) => {
          const state = getStepState(step.status);

          return (
            <div
              key={idx}
              className="relative z-10 flex flex-1 flex-col items-start text-left md:items-center md:text-center"
            >
              <div className="flex items-center gap-3 md:flex-col md:gap-2">
                {state === "COMPLETED" && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-payroll-xs">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                )}
                {state === "ACTIVE" && (
                  <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-xl bg-payroll-primary text-white border border-payroll-primary shadow-payroll-sm">
                    <step.icon className="h-5 w-5" />
                  </div>
                )}
                {state === "PENDING" && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-payroll-cream/60 text-gray-400 border border-payroll-light">
                    <Circle className="h-4 w-4" />
                  </div>
                )}

                <div>
                  <p
                    className={`text-xs font-bold leading-tight ${
                      state === "ACTIVE"
                        ? "text-payroll-primary"
                        : state === "COMPLETED"
                        ? "text-payroll-navy"
                        : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500 line-clamp-1">{step.desc}</p>
                  {step.time && (
                    <p className="mt-1 text-[10px] text-gray-400 tabular-nums">
                      {new Date(step.time).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
