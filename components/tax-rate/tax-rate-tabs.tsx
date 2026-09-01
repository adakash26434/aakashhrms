"use client";

import { cn } from "@/lib/utils";
import type { TaxCategory } from "@/lib/types/tax-rate";
import { TAX_CATEGORIES } from "@/lib/types/tax-rate";

interface TaxRateTabsProps {
  /** The currently active category. */
  active: TaxCategory;
  /** Called when the user picks a different tab. */
  onChange: (next: TaxCategory) => void;
  /**
   * Optional: a map of category → "configured" indicator. When provided,
   * a small dot is drawn next to configured categories. Matches the
   * screenshot's small visual hint (e.g. a "configured" mark).
   */
  configuredMap?: Partial<Record<TaxCategory, boolean>>;
}

/**
 * 4-tab category selector: Normal Single / Married / Widow / Handicapped.
 *
 * The active tab is filled with the brand blue (`bg-[#2e7d32] text-white`)
 * to match the screenshot. Inactive tabs are text-only and gain a subtle
 * hover background. A small green dot is shown when a category has at
 * least one slab for the active fiscal year.
 */
export function TaxRateTabs({ active, onChange, configuredMap }: TaxRateTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Tax category"
      className="inline-flex w-full gap-1 rounded-lg border border-[#d7e8d0]/80 bg-white p-1 sm:w-auto"
    >
      {TAX_CATEGORIES.map((category) => {
        const isActive = category === active;
        const isConfigured = configuredMap?.[category] ?? false;
        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(category)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-[#2e7d32] text-white shadow-sm"
                : "text-[#1b3a1f] hover:bg-[#f6faf6]",
            )}
          >
            <span>{category}</span>
            {isConfigured && !isActive && (
              <span
                aria-hidden
                title="This category has at least one slab configured"
                className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
