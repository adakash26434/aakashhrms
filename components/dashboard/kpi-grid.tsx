import { Calendar, CreditCard, Shield, Users, Wallet } from "lucide-react";
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
  const Icon = iconMap[metric.icon];

  return (
    <Card
      className={cn(
        "p-4 shadow-sm",
        metric.highlighted
          ? "border-payroll-light bg-payroll-light"
          : "border-payroll-light/80 bg-white",
      )}
    >
      <div className="mb-3 flex items-start justify-between">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            metric.highlighted ? "bg-white/60" : "bg-payroll-cream",
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              metric.highlighted ? "text-payroll-primary" : "text-payroll-navy/70",
            )}
          />
        </div>
        <Badge variant={badgeVariantMap[metric.badgeVariant]}>
          {metric.badge}
        </Badge>
      </div>
      <p className="text-sm font-medium text-gray-500">{metric.label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-payroll-navy">
        {metric.value}
      </p>
      <p className="mt-1 text-sm text-gray-400">{metric.subtext}</p>
    </Card>
  );
}

interface KpiGridProps {
  metrics: KpiMetric[];
  pendingApprovals: { value: number; subtext: string; badge: string };
}

export function KpiGrid({ metrics, pendingApprovals }: KpiGridProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <KpiCard key={metric.id} metric={metric} />
        ))}
      </div>
      <Card className="flex items-center justify-between border-payroll-light/80 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-medium text-gray-500">Pending Approvals</p>
          <p className="text-2xl font-semibold text-payroll-navy">
            {pendingApprovals.value}
          </p>
          <p className="text-sm text-gray-400">{pendingApprovals.subtext}</p>
        </div>
        <Badge variant="warning">{pendingApprovals.badge}</Badge>
      </Card>
    </div>
  );
}
