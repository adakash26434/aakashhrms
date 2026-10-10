"use client";

import { Printer } from "lucide-react";
import { WindowButton } from "@/components/kit/window";

/** Prints the page (hidden in the printout). For server-rendered print views that need one button. */
export function PrintButton({ label = "Print", className }: { label?: string; className?: string }) {
  return (
    <WindowButton variant="primary" className={className} onClick={() => window.print()}>
      <Printer className="h-3.5 w-3.5" aria-hidden /> {label}
    </WindowButton>
  );
}
