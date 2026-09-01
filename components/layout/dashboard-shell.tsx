"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { DateFormatProvider } from "@/lib/contexts/date-format-context";
import type { WorkspaceContext } from "@/lib/services/workspace-context.service";

interface DashboardShellProps {
  children: React.ReactNode;
  context?: WorkspaceContext;
}

export function DashboardShell({ children, context }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved !== null) {
      setSidebarCollapsed(saved === "true");
    }
  }, []);

  const handleToggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    if (isMounted) {
      localStorage.setItem("sidebarCollapsed", String(newState));
    }
  };

  return (
    <DateFormatProvider>
      <div className="flex h-screen overflow-hidden bg-payroll-cream print:h-auto print:overflow-visible print:bg-white print:block">
        <aside className="print:hidden flex shrink-0">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={handleToggleSidebar}
            context={context}
          />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:h-auto print:overflow-visible print:block">
          <div className="print:hidden">
            <TopHeader context={context} />
          </div>
          <main className="flex-1 overflow-y-auto bg-payroll-cream p-6 print:p-0 print:bg-white print:overflow-visible print:block">
            {children}
          </main>
        </div>
      </div>
    </DateFormatProvider>
  );
}
