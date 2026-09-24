"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface SidebarContextValue {
  isPinned: boolean;
  setIsPinned: (pinned: boolean | ((prev: boolean) => boolean)) => void;
  togglePin: () => void;
  isHovered: boolean;
  setIsHovered: (hovered: boolean) => void;
  isExpanded: boolean;
}

const SidebarContext = createContext<SidebarContextValue>({
  isPinned: true,
  setIsPinned: () => {},
  togglePin: () => {},
  isHovered: false,
  setIsHovered: () => {},
  isExpanded: true,
});

export function SidebarProvider({
  children,
  initialPinned = true,
}: {
  children: React.ReactNode;
  initialPinned?: boolean;
}) {
  const [isPinned, setIsPinned] = useState(initialPinned);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebarPinned");
      if (stored !== null) {
        setIsPinned(stored === "true");
      }
    } catch {
      // ignore in restricted envs
    }
  }, []);

  const togglePin = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebarPinned", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const isExpanded = isPinned || isHovered;

  return (
    <SidebarContext.Provider
      value={{
        isPinned,
        setIsPinned,
        togglePin,
        isHovered,
        setIsHovered,
        isExpanded,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
