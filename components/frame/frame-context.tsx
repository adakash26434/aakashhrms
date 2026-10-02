"use client";

import { createContext, useContext } from "react";

export interface FrameState {
  /** Mobile / tablet drawer (rail + navigator) below 1024px. */
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  /** Section navigator (Ctrl+B). Persisted preference on wide screens. */
  navigatorOpen: boolean;
  toggleNavigator: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  /** Idle lock; undefined when locking is unavailable (super-admin view). */
  lockNow?: () => void;
  /** Seconds left before the idle lock, shown only in the final minute. */
  lockCountdown: number | null;
}

export const FrameContext = createContext<FrameState | null>(null);

export function useFrame(): FrameState {
  const ctx = useContext(FrameContext);
  if (!ctx) throw new Error("useFrame must be used inside <AppFrame>");
  return ctx;
}
