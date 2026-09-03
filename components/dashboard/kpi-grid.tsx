import { Calendar, CreditCard, Shield, Users, Wallet, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { KpiMetric } from "@/lib/types/dashboard";

const iconMap = {
  users: Users,
  wallet: Wallet,
  calendar: Calendar,
  "credit-card": CreditCard,
  shield: Shield,
  alert: Shield,
} as const;

const badgeVariantMap = {
  success: "success",
  warning: "warning",
  info: "info",
  neutral: "neutral",
} as const;

interface KpiCardProps {
  metric: KpiMetric;
}

export function KpiCard({ metric }: KpiCardProps) {
  const Icon = iconMap[metric.icon] || Users;

  return (
    <Card
      className={cn(
        "p-4 transition-all duration-200 hover:-translate-y-0.5",
        metric.highlighted
          ? "border-payroll-light bg-payroll-light/40"
          : "border-payroll-light/80 bg-white",
      )}
    >
      <div className="mb-2.5 flex items-start justify-between">
        <div
          className={cn(
            "flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-payroll-light/60",
            metric.highlighted
              ? "bg-white text-payroll-primary shadow-payroll-xs"
              : "bg-payroll-cream text-payroll-navy/70",
          )}
        >
          <Icon className="h-4 w-4 text-payroll-primary" />
        </div>
        <Badge variant={badgeVariantMap[metric.badgeVariant] || "default"} size="sm">
          {metric.badge}
        </Badge>
      </div>
      <p className="text-xs font-medium text-gray-500">{metric.label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-payroll-navy">
        {metric.value}
      </p>
      <p className="mt-0.5 text-[11px] text-gray-400 font-medium">{metric.subtext}</p>
    </Card>
  );
}

interface KpiGridProps {
  metrics: KpiMetric[];
  pendingApprovals: { value: number; subtext: string; badge: string };
}

export function KpiGrid({ metrics, pendingApprovals }: KpiGridProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map((metric) => (
          <KpiCard key={metric.id} metric={metric} />
        ))}
      </div>
      <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-payroll-light/80 bg-white p-4 gap-3 shadow-payroll-xs hover:shadow-payroll-sm transition-all">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-gray-700">Pending Approvals</p>
              <Badge variant="warning" size="sm">
                {pendingApprovals.badge}
              </Badge>
            </div>
            <p className="text-lg font-bold text-payroll-navy leading-tight">
              {pendingApprovals.value} Requests
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500">{pendingApprovals.subtext}</p>
      </Card>
    </div>
  );
}
