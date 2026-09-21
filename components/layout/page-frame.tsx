import React from "react";
import { cn } from "@/lib/utils";

export interface PageFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "default" | "wide" | "full";
  spacing?: "default" | "compact" | "relaxed" | "none";
  children: React.ReactNode;
}

export function PageFrame({
  size = "default",
  spacing = "default",
  className,
  children,
  ...props
}: PageFrameProps) {
  const sizeClasses = {
    default: "max-w-7xl",
    wide: "max-w-[1600px]",
    full: "w-full",
  };

  const spacingClasses = {
    default: "space-y-6",
    compact: "space-y-4",
    relaxed: "space-y-8",
    none: "",
  };

  return (
    <div
      className={cn(
        "mx-auto w-full",
        sizeClasses[size],
        spacingClasses[spacing],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
