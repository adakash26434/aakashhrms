import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateFormatMenu } from "@/components/ui/date-format-menu";

interface FiscalYearHeroProps {
  onCreate: () => void;
}

export function FiscalYearHero({ onCreate }: FiscalYearHeroProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-[#1b3a1f]">
          Fiscal Year Setup
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-gray-500">
          Manage Bikram Sambat fiscal years. Edit and delete are disabled after
          payslips are generated for a period.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-1">
        {/* Local mirror of the global date format toggle. Both are
            wired to the same context, so flipping this also flips the
            header one and vice versa. */}
        <DateFormatMenu size="md" />
        <Button onClick={onCreate} size="md">
          <Plus className="h-4 w-4" />
          New Fiscal Year
        </Button>
      </div>
    </div>
  );
}
