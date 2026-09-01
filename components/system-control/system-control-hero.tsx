import { DataSaveButton } from "@/components/ui/data-save-button";

interface SystemControlHeroProps {
  onSave: () => void;
  isSaving: boolean;
}

/**
 * Page hero for the System Control Setup page.
 *
 * Renders the title + subtitle on the left and a save button on
 * the right. The save button is the shared `<DataSaveButton>`
 * primitive, so its loading state stays consistent with other
 * setup pages (e.g. future Pay Heads, future Leave Heads).
 */
export function SystemControlHero({ onSave, isSaving }: SystemControlHeroProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-[#1b3a1f]">
          System Control
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-gray-500">
          Configure office hours, overtime rules, statutory deduction limits,
          insurance thresholds, and employee category permissions. These
          settings apply globally across all branches and fiscal years.
        </p>
      </div>
      <div className="flex shrink-0 items-center pt-1">
        <DataSaveButton onClick={onSave} isSaving={isSaving} />
      </div>
    </div>
  );
}
