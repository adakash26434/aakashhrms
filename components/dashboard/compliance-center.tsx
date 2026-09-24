import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ComplianceItem } from "@/lib/types/dashboard";

interface ComplianceCenterProps {
  score: number;
  items: ComplianceItem[];
}

const statusConfig = {
  "on-track": {
    label: "On track",
    variant: "on-track" as const,
    icon: CheckCircle2,
  },
  "needs-review": {
    label: "Needs review",
    variant: "needs-review" as const,
    icon: Clock,
  },
  draft: {
    label: "Draft",
    variant: "draft" as const,
    icon: Pencil,
  },
};

export function ComplianceCenter({ score, items }: ComplianceCenterProps) {
  return (
    <Card className="bg-white border-payroll-border shadow-payroll-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8.5 w-8.5 items-center justify-center rounded-lg bg-payroll-primary-light text-payroll-primary border border-payroll-primary-border">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-950">
                Nepal statutory compliance · {score}%
              </h3>
              <p className="text-xs text-gray-500">
                Labour Act 2074 & IRD readiness
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/setup/tax-rates"
              className="inline-flex items-center gap-1 text-xs text-payroll-primary font-semibold hover:underline"
            >
              <span>Statutory setup</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {items.map((item) => {
            const config = statusConfig[item.status] || statusConfig["on-track"];
            const StatusIcon = config.icon;

            return (
              <div
                key={item.id}
                className="rounded-lg border border-payroll-border/80 bg-gray-50/50 p-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-900 font-mono">
                    {item.code}
                  </span>
                  <Badge variant={config.variant} size="sm" className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    <span>{config.label}</span>
                  </Badge>
                </div>
                <h4 className="text-xs font-semibold text-gray-900">
                  {item.name}
                </h4>
                <div className="mt-2.5">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">Readiness</span>
                    <span className="font-semibold text-payroll-primary font-mono">
                      {item.readiness}%
                    </span>
                  </div>
                  <Progress value={item.readiness} />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                  {item.detail}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
