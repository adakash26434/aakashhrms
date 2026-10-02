"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  History,
  Keyboard,
  Lock,
  LogOut,
  PanelLeft,
  Search,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { searchEmployeesForPaletteAction } from "@/app/actions/command-palette.actions";
import { logoutAction } from "@/app/actions/auth.actions";
import { useDateFormat } from "@/lib/contexts/date-format-context";
import type { NavModule } from "@/lib/frame/navigation";
import { rankCandidates } from "@/lib/frame/palette-search";
import type { EmployeeQuickResult } from "@/lib/repositories/employee.repository";
import { cn } from "@/lib/utils";
import { useFrame } from "./frame-context";
import type { RecentPage } from "./use-recent-pages";

interface PaletteItem {
  id: string;
  href?: string;
  label: string;
  group: "Recent" | "Pages" | "Employees" | "Commands";
  description?: string;
  keywords?: readonly string[];
  icon: LucideIcon;
  hint?: ReactNode;
  run: () => void;
}

interface PaletteProps {
  modules: NavModule[];
  recent: RecentPage[];
  canSearchEmployees: boolean;
  isImpersonating: boolean;
}

/** Command palette (2.6): Ctrl K / Alt G. Pages, employees and commands. */
export function CommandPalette(props: PaletteProps) {
  const { paletteOpen } = useFrame();
  // Mounted only while open, so every opening starts from a clean state.
  return paletteOpen ? <PaletteDialog {...props} /> : null;
}

function PaletteDialog({ modules, recent, canSearchEmployees, isImpersonating }: PaletteProps) {
  const { setPaletteOpen, toggleNavigator, setHelpOpen, lockNow } = useFrame();
  const router = useRouter();
  const { calendar, setCalendar } = useDateFormat();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [lookup, setLookup] = useState<{ term: string; results: EmployeeQuickResult[] }>({ term: "", results: [] });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [restoreFocusTo] = useState(() => (typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null));
  const listId = useId();

  const term = query.trim();
  const wantsEmployees = canSearchEmployees && term.length >= 2;
  const employees = wantsEmployees && lookup.term === term ? lookup.results : [];
  const searching = wantsEmployees && lookup.term !== term;

  const close = () => setPaletteOpen(false);
  const go = (href: string) => {
    close();
    router.push(href);
  };

  // Focus the input on open; give focus back to whatever had it on close.
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => restoreFocusTo?.focus?.();
  }, [restoreFocusTo]);

  // Debounced, permission-checked employee lookup.
  useEffect(() => {
    if (!wantsEmployees) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await searchEmployeesForPaletteAction(term);
      if (!cancelled) setLookup({ term, results: result.success && result.data ? result.data : [] });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term, wantsEmployees]);

  const pageItems = useMemo<PaletteItem[]>(
    () =>
      modules.flatMap((m) =>
        m.sections.map((s) => ({
          id: `page:${s.id}`,
          href: s.href,
          label: s.label,
          group: "Pages" as const,
          description: s.description,
          keywords: [m.label, ...(s.keywords ?? [])],
          icon: s.icon,
          hint: <span className="text-2xs text-ink-faint">{m.label}</span>,
          run: () => go(s.href),
        }))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modules]
  );

  const commandItems: PaletteItem[] = [
    {
      id: "cmd:calendar",
      label: calendar === "bs" ? "Show dates in AD" : "Show dates in BS",
      group: "Commands",
      keywords: ["calendar", "bikram sambat", "gregorian", "date format"],
      icon: CalendarRange,
      run: () => {
        setCalendar(calendar === "bs" ? "ad" : "bs");
        close();
      },
    },
    {
      id: "cmd:navigator",
      label: "Show or hide the section navigator",
      group: "Commands",
      keywords: ["sidebar", "collapse"],
      icon: PanelLeft,
      hint: <Keys keys={["Ctrl", "B"]} />,
      run: () => {
        toggleNavigator();
        close();
      },
    },
    {
      id: "cmd:shortcuts",
      label: "Keyboard shortcuts",
      group: "Commands",
      keywords: ["help", "keys", "hotkeys"],
      icon: Keyboard,
      hint: <Keys keys={["?"]} />,
      run: () => {
        close();
        setHelpOpen(true);
      },
    },
    ...(lockNow
      ? [
          {
            id: "cmd:lock",
            label: "Lock session",
            group: "Commands" as const,
            keywords: ["away", "idle", "secure"],
            icon: Lock,
            hint: <Keys keys={["Ctrl", "Shift", "L"]} />,
            run: () => {
              close();
              lockNow();
            },
          },
        ]
      : []),
    ...(!isImpersonating
      ? [
          {
            id: "cmd:self-service",
            label: "Open my self-service",
            group: "Commands" as const,
            keywords: ["my payslip", "my leave", "profile"],
            icon: Wallet,
            run: () => go("/self-service"),
          },
          {
            id: "cmd:sign-out",
            label: "Sign out",
            group: "Commands" as const,
            keywords: ["logout", "log out"],
            icon: LogOut,
            run: () => {
              close();
              void logoutAction();
            },
          },
        ]
      : []),
  ];

  const items: PaletteItem[] = useMemo(() => {
    const q = query.trim();
    if (!q) {
      const recentItems: PaletteItem[] = recent.map((r) => ({
        id: `recent:${r.href}`,
        label: r.label,
        group: "Recent",
        icon: History,
        hint: <span className="text-2xs text-ink-faint">{r.module}</span>,
        run: () => go(r.href),
      }));
      const recentIds = new Set(recent.map((r) => r.href));
      const otherPages = pageItems.filter((p) => !p.href || !recentIds.has(p.href));
      return [...recentItems, ...otherPages.slice(0, 8), ...commandItems];
    }
    const employeeItems: PaletteItem[] = employees.map((e) => ({
      id: `emp:${e.id}`,
      label: e.fullName,
      group: "Employees",
      description: [e.employeeCode, e.departmentName].filter(Boolean).join(" · "),
      icon: User,
      hint: e.status !== "Active" ? <span className="text-2xs text-ink-faint">{e.status}</span> : undefined,
      run: () => go(`/workforce/employees?q=${encodeURIComponent(e.employeeCode || e.fullName)}`),
    }));
    return [
      ...rankCandidates(pageItems, q, 8),
      ...employeeItems,
      ...rankCandidates(commandItems, q, 6),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, recent, pageItems, employees, calendar, lockNow, isImpersonating]);

  const activeIndex = Math.min(active, Math.max(0, items.length - 1));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(items.length ? (activeIndex + 1) % items.length : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(items.length ? (activeIndex - 1 + items.length) % items.length : 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[activeIndex]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      // Keep focus inside the dialog (single focusable control).
      e.preventDefault();
    }
  };

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-ink/25 px-3 pt-[12vh] animate-[fadeIn_120ms_ease-out]" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl animate-[dialogIn_160ms_var(--ease-out-quint)]"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-3.5">
          <Search className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder={canSearchEmployees ? "Search pages, employees or commands…" : "Search pages or commands…"}
            className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint focus:shadow-none"
            style={{ boxShadow: "none", border: 0 }}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            aria-autocomplete="list"
            maxLength={60}
          />
          {searching && <span className="text-2xs text-ink-faint">Searching…</span>}
          <kbd className="rounded border border-line px-1.5 py-px text-3xs text-ink-faint">Esc</kbd>
        </div>

        <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="max-h-[56vh] overflow-y-auto p-1.5">
          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-ink-faint">
              {searching ? "Searching…" : `No matches for “${query.trim()}”.`}
            </p>
          )}
          {items.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const Icon = item.icon;
            return (
              <div key={item.id}>
                {header && <p className="px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-ink-faint">{header}</p>}
                <div
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseMove={() => setActive(index)}
                  onClick={() => item.run()}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2",
                    index === activeIndex ? "bg-selection" : "hover:bg-surface-sunken"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", index === activeIndex ? "text-brand" : "text-ink-faint")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{item.label}</span>
                    {item.description && <span className="block truncate text-2xs text-ink-faint">{item.description}</span>}
                  </span>
                  {item.hint}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-line bg-surface-sunken px-3.5 py-1.5 text-2xs text-ink-faint">
          <span><Keys keys={["↑", "↓"]} /> move</span>
          <span><Keys keys={["Enter"]} /> open</span>
          <span><Keys keys={["Esc"]} /> close</span>
          <span className="ml-auto hidden sm:inline">Alt G also opens this</span>
        </div>
      </div>
    </div>
  );
}

export function Keys({ keys }: { keys: readonly string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
      {keys.map((k) => (
        <kbd key={k} className="min-w-4.5 rounded border border-line bg-white px-1 py-px text-center text-3xs font-medium text-ink-muted">
          {k}
        </kbd>
      ))}
    </span>
  );
}
