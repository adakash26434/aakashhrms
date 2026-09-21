"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { DateFormatProvider } from "@/lib/contexts/date-format-context";
import { WorkspaceContextProvider } from "@/lib/contexts/workspace-context";
import type { WorkspaceContext } from "@/lib/services/workspace-context.service";

interface DashboardShellProps {
  children: React.ReactNode;
  context?: WorkspaceContext;
}

export function DashboardShell({ children, context }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebarCollapsed") === "true";
    }
    return false;
  });

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebarCollapsed", String(next));
      } catch {
        // ignore localStorage access errors in restricted envs
      }
      return next;
    });
  };

  return (
    <DateFormatProvider>
      <WorkspaceContextProvider value={context}>
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
              <TopHeader
                context={context}
                onToggleSidebar={handleToggleSidebar}
                isSidebarCollapsed={sidebarCollapsed}
              />
            </div>
            <main className="flex-1 overflow-y-auto bg-payroll-cream p-6 print:p-0 print:bg-white print:overflow-visible print:block">
              {children}
            </main>
          </div>
        </div>
      </WorkspaceContextProvider>
    </DateFormatProvider>
  );
}
