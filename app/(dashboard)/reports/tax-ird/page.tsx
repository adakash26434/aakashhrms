import { redirect } from "next/navigation";

// The TDS / IRD report became Payroll → Statutory returns (4.8 / F9): eTDS by revenue code,
// SSF, Provident Fund and CIT schedules, and the annual tax certificates. Old links land there.
export default function TaxIrdReportPage() {
  redirect("/payroll/statutory");
}
