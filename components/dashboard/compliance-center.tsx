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
    <Card className="bg-white">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-zinc-950">
                Nepal Statutory Compliance · {score}%
              </h3>
              <p className="text-xs text-zinc-500">
                Labour Act 2074 & IRD Income Tax Act 2058 readiness
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/setup/tax-rates"
              className="inline-flex items-center gap-1 text-xs text-emerald-800 font-medium hover:text-emerald-950 transition-colors"
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
                className="rounded-md border border-zinc-200/80 bg-zinc-50/50 p-3.5 hover:bg-zinc-50 transition-colors"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-900 font-mono">
                    {item.code}
                  </span>
                  <Badge variant={config.variant} size="sm" className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    <span>{config.label}</span>
                  </Badge>
                </div>
                <h4 className="text-xs font-semibold text-zinc-900">
                  {item.name}
                </h4>
                <div className="mt-2.5">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500">Readiness</span>
                    <span className="font-semibold text-emerald-800 font-mono">
                      {item.readiness}%
                    </span>
                  </div>
                  <Progress value={item.readiness} />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
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
