"use client";

import React, { createContext, useContext } from "react";
import type { WorkspaceContext } from "@/lib/services/workspace-context.service";

const WorkspaceReactContext = createContext<WorkspaceContext | null>(null);

export function WorkspaceContextProvider({
  value,
  children,
}: {
  value?: WorkspaceContext;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceReactContext.Provider value={value || null}>
      {children}
    </WorkspaceReactContext.Provider>
  );
}

export function useWorkspaceContext(): WorkspaceContext | null {
  return useContext(WorkspaceReactContext);
}
