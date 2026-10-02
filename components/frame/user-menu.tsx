"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Keyboard, Lock, LogOut, Rows3, UserCircle, Wallet } from "lucide-react";
import { useDensity } from "@/lib/kit/density";
import { logoutAction } from "@/app/actions/auth.actions";
import type { WorkspaceContext } from "@/lib/services/workspace-context.service";
import { cn } from "@/lib/utils";
import { useFrame } from "./frame-context";

export function UserMenu({ context }: { context?: WorkspaceContext }) {
  const { lockNow, setHelpOpen } = useFrame();
  const [density, setDensity] = useDensity();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isImpersonating = Boolean(context?.isImpersonating);
  const name = context?.user.name || "User";
  const initials = context?.user.initials || "U";
  const role = context?.user.role || "";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-sunken focus-visible:bg-surface-sunken cursor-pointer";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={cn(
          "flex h-8 items-center gap-2 rounded-md pl-1 pr-1.5 text-left hover:bg-surface-sunken cursor-pointer",
          open && "bg-surface-sunken"
        )}
      >
        <span
          className={cn(
            "flex h-6.5 w-6.5 items-center justify-center rounded-full text-2xs font-semibold text-white",
            isImpersonating ? "bg-warning" : "bg-brand"
          )}
        >
          {initials}
        </span>
        <span className="hidden max-w-36 xl:block">
          <span className="block truncate text-xs font-semibold leading-tight text-ink">{name}</span>
          <span className="block truncate text-2xs leading-tight text-ink-faint">{role}</span>
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-lg border border-line bg-surface p-1.5 shadow-lg animate-[dialogIn_140ms_var(--ease-out-quint)]"
        >
          <div className="mb-1 rounded-md bg-surface-sunken px-2.5 py-2">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            {context?.user.email && <p className="truncate text-2xs text-ink-faint">{context.user.email}</p>}
            {role && <p className="mt-0.5 truncate text-2xs font-medium text-brand-strong">{role}</p>}
          </div>
          {!isImpersonating && (
            <>
              <Link role="menuitem" href="/self-service" onClick={() => setOpen(false)} className={itemClass}>
                <Wallet className="h-4 w-4 text-ink-faint" /> My self-service
              </Link>
              <Link role="menuitem" href="/self-service/my-profile" onClick={() => setOpen(false)} className={itemClass}>
                <UserCircle className="h-4 w-4 text-ink-faint" /> My profile
              </Link>
            </>
          )}
          <button
            role="menuitemcheckbox"
            aria-checked={density === "compact"}
            type="button"
            className={itemClass}
            onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
          >
            <Rows3 className="h-4 w-4 text-ink-faint" />
            <span className="flex-1">Compact rows</span>
            <span className={cn("h-4 w-7 rounded-full p-0.5 transition-colors", density === "compact" ? "bg-brand" : "bg-line-strong")} aria-hidden>
              <span className={cn("block h-3 w-3 rounded-full bg-white transition-transform", density === "compact" && "translate-x-3")} />
            </span>
          </button>
          <button
            role="menuitem"
            type="button"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              setHelpOpen(true);
            }}
          >
            <Keyboard className="h-4 w-4 text-ink-faint" />
            <span className="flex-1">Keyboard shortcuts</span>
            <kbd className="text-2xs text-ink-faint">?</kbd>
          </button>
          {lockNow && (
            <button
              role="menuitem"
              type="button"
              className={itemClass}
              onClick={() => {
                setOpen(false);
                lockNow();
              }}
            >
              <Lock className="h-4 w-4 text-ink-faint" />
              <span className="flex-1">Lock session</span>
              <kbd className="text-2xs text-ink-faint">Ctrl Shift L</kbd>
            </button>
          )}
          {!isImpersonating && (
            <>
              <div className="my-1 border-t border-line" />
              <button
                role="menuitem"
                type="button"
                className={cn(itemClass, "text-danger hover:bg-danger-subtle")}
                onClick={() => {
                  setOpen(false);
                  void logoutAction();
                }}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
