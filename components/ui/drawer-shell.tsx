"use client";

import React, { ReactNode } from "react";
import { SidePanel } from "@/components/ui/side-panel";

export interface DrawerShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  className?: string;
}

export function DrawerShell({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: DrawerShellProps) {
  const headerContent =
    typeof title === "string" ? (
      <h2 className="text-base font-bold text-payroll-navy tracking-tight truncate">
        {title}
      </h2>
    ) : (
      title
    );

  return (
    <SidePanel
      open={isOpen}
      onClose={onClose}
      header={headerContent}
      subtitle={description}
      footer={footer}
      size={size}
      className={className}
    >
      {children}
    </SidePanel>
  );
}
