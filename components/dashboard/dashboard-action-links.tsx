import Link from "next/link";
import {
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  FileSpreadsheet,
  Users,
} from "lucide-react";

interface ActionLink {
  label: string;
  href: string;
  icon: typeof Users;
}

const ACTION_LINKS: ActionLink[] = [
  {
    label: "Employee directory",
    href: "/workforce/employees",
    icon: Users,
  },
  {
    label: "Review attendance",
    href: "/timeAndLeave/attendance",
    icon: CalendarCheck,
  },
  {
    label: "Leave requests",
    href: "/timeAndLeave/applications",
    icon: CalendarDays,
  },
  {
    label: "Salary sheet",
    href: "/reports/salary-sheet",
    icon: FileSpreadsheet,
  },
];

export function DashboardActionLinks() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-1 text-xs">
      <span className="font-semibold text-gray-500">Quick actions</span>
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        {ACTION_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Icon className="h-3.5 w-3.5 text-gray-400 group-hover:text-payroll-primary transition-colors" />
              <span className="font-medium text-[13px]">{link.label}</span>
              <ArrowUpRight className="h-3 w-3 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
