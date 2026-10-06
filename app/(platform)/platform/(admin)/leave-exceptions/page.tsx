import type { Metadata } from "next";
import { LeaveExceptionsClient } from "@/components/platform/leave-exceptions-client";

export const metadata: Metadata = { title: "Leave exceptions | AakashHRMS Platform" };
export const dynamic = "force-dynamic";

/** Platform → Leave exceptions (4.6d). The admin layout checks the platform session; the API routes check it again. */
export default function PlatformLeaveExceptionsPage() {
  return <LeaveExceptionsClient />;
}
