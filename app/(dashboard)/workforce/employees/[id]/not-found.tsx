import Link from "next/link";
import { UserX } from "lucide-react";
import { EmptyState } from "@/components/kit/empty-state";

/**
 * Missing, malformed or out-of-scope employee ids all land here (S18): the
 * page never says which, so it cannot be used to probe for records.
 */
export default function EmployeeNotFound() {
  return (
    <EmptyState
      className="py-16"
      icon={<UserX className="h-5 w-5" />}
      title="Employee not found"
      description="The record may have been deleted, or it is outside the branches and departments you can see."
      action={
        <Link href="/workforce/employees" className="inline-flex h-8 items-center rounded-md bg-brand px-3 text-xs font-medium text-white hover:bg-brand-hover">
          Back to employees
        </Link>
      }
    />
  );
}
