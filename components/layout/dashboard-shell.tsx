"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { DateFormatProvider } from "@/lib/contexts/date-format-context";
import { WorkspaceContextProvider } from "@/lib/contexts/workspace-context";
import type { WorkspaceContext } from "@/lib/services/workspace-context.service";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

import { SidebarProvider, useSidebar } from "@/lib/contexts/sidebar-context";

interface DashboardShellProps {
  children: React.ReactNode;
  context?: WorkspaceContext;
}

function DashboardContent({
  children,
  context,
}: {
  children: React.ReactNode;
  context?: WorkspaceContext;
}) {
  const { isPinned: pinnedPreference, isHovered, setIsHovered, togglePin } =
    useSidebar();
  // Below 1024px a pinned 256px sidebar crushes the workspace, so it shows as
  // the icon rail (hover / tap still expands it). Interim until the Phase 2.9
  // responsive frame; the stored pin preference is left untouched.
  const isCompactViewport = useMediaQuery("(max-width: 1023px)");
  const isPinned = pinnedPreference && !isCompactViewport;
  const isExpanded = isPinned || isHovered;

  return (
    <div className="flex h-screen overflow-hidden bg-payroll-cream print:h-auto print:overflow-visible print:bg-white print:block">
      {/* Sidebar container with hover expansion when unpinned */}
      <aside
        className={cn(
          "print:hidden relative shrink-0 transition-[width] duration-200 ease-in-out z-30",
          isPinned ? "w-64" : "w-18"
        )}
      >
        <div
          onMouseEnter={() => {
            if (!isPinned) setIsHovered(true);
          }}
          onMouseLeave={() => {
            if (!isPinned) setIsHovered(false);
          }}
          className={cn(
            "h-screen flex flex-col bg-white text-gray-900 border-r border-payroll-border",
            "transition-[width,box-shadow] duration-200 ease-in-out",
            isPinned
              ? "w-64 relative"
              : isHovered
              ? "w-64 absolute left-0 top-0 z-40 shadow-xl"
              : "w-18 relative"
          )}
        >
          <Sidebar
            isPinned={isPinned}
            isExpanded={isExpanded}
            onTogglePin={togglePin}
            onToggle={togglePin}
            context={context}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:h-auto print:overflow-visible print:block">
        <div className="print:hidden">
          <TopHeader
            context={context}
            onToggleSidebar={togglePin}
            isSidebarCollapsed={!pinnedPreference}
          />
        </div>
        <main className="flex-1 overflow-y-auto bg-white p-4 lg:p-6 print:p-0 print:bg-white print:overflow-visible print:block">
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children, context }: DashboardShellProps) {
  return (
    <DateFormatProvider>
      <WorkspaceContextProvider value={context}>
        <SidebarProvider>
          <DashboardContent context={context}>{children}</DashboardContent>
        </SidebarProvider>
      </WorkspaceContextProvider>
    </DateFormatProvider>
  );
}
