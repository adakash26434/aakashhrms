// Payroll readiness: employee records that will break or weaken the next run.

export interface ReadinessEmployee {
  id: string;
  fullName: string;
  employeeCode: string;
  panNumber?: string | null;
  bankAccountNumber?: string | null;
  basicSalary?: number | null;
}

export type ReadinessIssueId = "pan" | "bank" | "basic";

export interface ReadinessIssue {
  id: ReadinessIssueId;
  label: string;
  impact: string;
  count: number;
  /** First few employees, for one-click fixing. */
  sample: { id: string; name: string; code: string }[];
}

/** Nepal PAN: 9 digits. */
export function isValidPan(pan: string | null | undefined): boolean {
  return !!pan && /^\d{9}$/.test(pan.trim());
}

const CHECKS: { id: ReadinessIssueId; label: string; impact: string; failing: (e: ReadinessEmployee) => boolean }[] = [
  {
    id: "pan",
    label: "PAN missing or invalid",
    impact: "TDS cannot be reported against the employee",
    failing: (e) => !isValidPan(e.panNumber),
  },
  {
    id: "bank",
    label: "No bank account",
    impact: "Left out of the bank transfer file",
    failing: (e) => !e.bankAccountNumber || e.bankAccountNumber.trim() === "",
  },
  {
    id: "basic",
    label: "Basic salary is zero",
    impact: "Payslip will calculate as nil",
    failing: (e) => !(Number(e.basicSalary) > 0),
  },
];

export const READINESS_SAMPLE_SIZE = 5;

/** Issues with at least one employee, worst (largest) first. */
export function payrollReadiness(employees: ReadinessEmployee[], sampleSize = READINESS_SAMPLE_SIZE): ReadinessIssue[] {
  return CHECKS.map((check) => {
    const failing = employees.filter(check.failing);
    return {
      id: check.id,
      label: check.label,
      impact: check.impact,
      count: failing.length,
      sample: failing.slice(0, sampleSize).map((e) => ({ id: e.id, name: e.fullName, code: e.employeeCode })),
    };
  })
    .filter((issue) => issue.count > 0)
    .sort((a, b) => b.count - a.count);
}
