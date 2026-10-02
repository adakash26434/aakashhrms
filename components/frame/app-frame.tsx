"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { DateFormatProvider } from "@/lib/contexts/date-format-context";
import { SidebarProvider, useSidebar } from "@/lib/contexts/sidebar-context";
import { WorkspaceContextProvider } from "@/lib/contexts/workspace-context";
import { findActiveLocation, visibleModules } from "@/lib/frame/navigation";
import { resolveShortcut } from "@/lib/frame/shortcuts";
import type { WorkspaceContext } from "@/lib/services/workspace-context.service";
import { CommandPalette } from "./command-palette";
import { FrameContext, type FrameState } from "./frame-context";
import { ModuleRail } from "./module-rail";
import { SectionNav } from "./section-nav";
import { ShortcutHelp } from "./shortcut-help";
import { StatusBar } from "./status-bar";
import { TitleBar } from "./title-bar";
import { useIdleLock } from "./use-idle-lock";
import { useRecentPages } from "./use-recent-pages";

export interface ImpersonationInfo {
  actorName: string;
  companyName: string;
  companyId: string;
}

interface AppFrameProps {
  children: React.ReactNode;
  context?: WorkspaceContext;
  impersonation?: ImpersonationInfo;
}

/**
 * Desktop application frame (redesign Phase 2):
 *
 *   ┌ title bar ───────────────────────────────────────────┐
 *   │ rail │ navigator │ workspace                          │
 *   └ status bar ──────────────────────────────────────────┘
 *
 * ≥1280px: rail + docked navigator (Ctrl B). 1024–1279px: rail, navigator
 * floats on demand. <1024px: both live in a drawer behind the menu button.
 */
export function AppFrame({ children, context, impersonation }: AppFrameProps) {
  return (
    <DateFormatProvider>
      <WorkspaceContextProvider value={context}>
        <SidebarProvider>
          <FrameLayout context={context} impersonation={impersonation}>
            {children}
          </FrameLayout>
        </SidebarProvider>
      </WorkspaceContextProvider>
    </DateFormatProvider>
  );
}

const XL_QUERY = "(min-width: 1280px)";
const LG_QUERY = "(min-width: 1024px)";

function FrameLayout({ children, context, impersonation }: AppFrameProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isPinned, togglePin } = useSidebar();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [floatingNavOpen, setFloatingNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const isImpersonating = Boolean(context?.isImpersonating);
  const { lockNow, countdown } = useIdleLock(!isImpersonating);

  const allowedModules = context?.allowedModules;
  const modules = useMemo(
    () => visibleModules({ allowedModules: allowedModules ?? [], fullAccess: isImpersonating }),
    [allowedModules, isImpersonating]
  );
  const location = findActiveLocation(pathname, modules);
  const activeModule = location?.module ?? modules[0] ?? null;
  const activeSection = location?.section ?? null;

  const visibleHrefs = useMemo(() => new Set(modules.flatMap((m) => m.sections.map((s) => s.href))), [modules]);
  const recentAll = useRecentPages(
    activeSection && activeModule ? { href: activeSection.href, label: activeSection.label, module: activeModule.label } : null
  );
  const recent = recentAll.filter((p) => visibleHrefs.has(p.href) && p.href !== activeSection?.href).slice(0, 5);

  const toggleNavigator = useCallback(() => {
    if (window.matchMedia(XL_QUERY).matches) togglePin();
    else if (window.matchMedia(LG_QUERY).matches) setFloatingNavOpen((v) => !v);
    else setDrawerOpen((v) => !v);
  }, [togglePin]);

  // Close transient panels on navigation (state adjusted during render, not in an effect).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setDrawerOpen(false);
    setFloatingNavOpen(false);
  }

  // Global shortcuts (2.7).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        setFloatingNavOpen(false);
        return;
      }
      const hit = resolveShortcut(e, e.target as HTMLElement | null);
      if (!hit) return;
      // Plain "?" yields to open dialogs; combos always work.
      if (hit.id === "help" && (paletteOpen || document.querySelector('[aria-modal="true"]'))) return;
      e.preventDefault();
      switch (hit.id) {
        case "palette":
        case "paletteAlt":
          setHelpOpen(false);
          setPaletteOpen((v) => !v);
          break;
        case "help":
          setHelpOpen(true);
          break;
        case "toggleNavigator":
          toggleNavigator();
          break;
        case "lockSession":
          lockNow?.();
          break;
        case "module": {
          const target = modules.find((m) => m.hotkey === String((hit.moduleIndex ?? 0) + 1));
          if (target) router.push(target.sections[0].href);
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modules, router, toggleNavigator, lockNow, paletteOpen]);

  const counters = { pendingApprovals: context?.pendingApprovalsCount ?? 0 };

  const frame: FrameState = {
    drawerOpen,
    setDrawerOpen,
    navigatorOpen: isPinned,
    toggleNavigator,
    paletteOpen,
    setPaletteOpen,
    helpOpen,
    setHelpOpen,
    lockNow,
    lockCountdown: countdown,
  };

  const navigator = (onNavigate?: () => void) => (
    <SectionNav
      module={activeModule}
      activeSectionId={activeSection?.id ?? null}
      counters={counters}
      recent={recent}
      onNavigate={onNavigate}
    />
  );

  return (
    <FrameContext.Provider value={frame}>
      <div className="flex h-screen flex-col overflow-hidden bg-canvas print:block print:h-auto print:overflow-visible print:bg-white">
        <a
          href="#workspace"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-brand focus:px-3 focus:py-1.5 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>

        {impersonation && (
          <div className="print:hidden">
            <ImpersonationBanner {...impersonation} />
          </div>
        )}
        <TitleBar context={context} />

        <div className="relative flex min-h-0 flex-1 print:block">
          {/* Rail (≥1024px) */}
          <div className="hidden lg:flex print:hidden">
            <ModuleRail
              modules={modules}
              activeModuleId={activeModule?.id ?? null}
              navigatorOpen={isPinned}
              onToggleNavigator={toggleNavigator}
            />
          </div>

          {/* Docked navigator (≥1280px, when pinned) */}
          {isPinned && <div className="hidden xl:flex print:hidden">{navigator()}</div>}

          {/* Floating navigator (1024–1279px, or ≥1280px when unpinned) */}
          {floatingNavOpen && (
            <div className="absolute inset-y-0 left-14 z-40 hidden shadow-xl lg:flex print:hidden animate-[panelIn_160ms_var(--ease-out-quint)]">
              {navigator(() => setFloatingNavOpen(false))}
            </div>
          )}

          <main
            id="workspace"
            tabIndex={-1}
            className="min-w-0 flex-1 overflow-y-auto bg-surface p-4 outline-none lg:p-6 print:overflow-visible print:p-0"
          >
            {children}
          </main>
        </div>

        <StatusBar context={context} />
      </div>

      {/* Drawer (<1024px): rail + navigator */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[80] flex lg:hidden print:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="flex h-full bg-nav shadow-2xl animate-[panelIn_160ms_var(--ease-out-quint)]">
            <ModuleRail
              modules={modules}
              activeModuleId={activeModule?.id ?? null}
              navigatorOpen
              onNavigate={() => setDrawerOpen(false)}
            />
            {navigator(() => setDrawerOpen(false))}
          </div>
          <button type="button" className="flex-1 bg-ink/25" aria-label="Close navigation" onClick={() => setDrawerOpen(false)}>
            <X className="ml-3 mt-3 h-5 w-5 text-white" />
          </button>
        </div>
      )}

      <CommandPalette
        modules={modules}
        recent={recent}
        canSearchEmployees={isImpersonating || Boolean(allowedModules?.includes("EMPLOYEES"))}
        isImpersonating={isImpersonating}
      />
      <ShortcutHelp />
    </FrameContext.Provider>
  );
}
