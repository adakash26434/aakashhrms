"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PayHeadHeroProps {
  onNew: () => void;
}

/**
 * Page hero for the Pay Head Setup page.
 *
 * Renders the title + subtitle on the left and a primary
 * "New Pay Head" button on the right. Matches the design
 * screenshot.
 */
export function PayHeadHero({ onNew }: PayHeadHeroProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-[#1b3a1f]">
          Pay Head Master
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-gray-500">
          Configure allowance and deduction heads with calculation rules, tax
          effects, statutory flags, and department/position applicability.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 pt-1">
        <Button type="button" onClick={onNew} size="md">
          <Plus className="h-4 w-4" />
          New Pay Head
        </Button>
      </div>
    </div>
  );
}
