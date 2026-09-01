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
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-payroll-light">
              <ShieldCheck className="h-5 w-5 text-payroll-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Compliance Center
              </p>
              <h3 className="text-lg font-semibold text-payroll-navy">
                Nepal statutory health · {score}%
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="info">Nepal Labour Act 2074</Badge>
            <a
              href="/setup/tax-rates"
              className="flex items-center gap-1 text-xs text-payroll-primary font-semibold hover:underline"
            >
              <span>Statutory Setup</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {items.map((item) => {
            const config = statusConfig[item.status];
            const StatusIcon = config.icon;

            return (
              <div
                key={item.id}
                className="rounded-lg border border-payroll-light/60 p-4"
              >
                <div className="mb-3 flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-400">
                    {item.code}
                  </span>
                  <Badge variant={config.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </div>
                <h4 className="text-sm font-semibold text-payroll-navy">
                  {item.name}
                </h4>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Submission readiness</span>
                    <span className="font-medium text-payroll-primary">
                      {item.readiness}%
                    </span>
                  </div>
                  <Progress value={item.readiness} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  {item.detail}
                </p>
                {item.lastSubmitted && item.nextDue && (
                  <div className="mt-3 space-y-0.5 border-t border-payroll-cream pt-2 text-xs text-gray-400">
                    <p>Last submitted · {item.lastSubmitted}</p>
                    <p>Next due · {item.nextDue}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
