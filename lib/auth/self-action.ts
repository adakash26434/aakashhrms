// Security plan S21 (standing rule): nobody acts on their own pay-relevant
// record. A user account is linked to an employee through users.employeeId
// (ScopeFilter.employeeId); when that employee is the subject of an approval,
// someone else has to give it. Leave approvals (4.6), salary changes (4.4),
// attendance (4.5), payslip edits (4.8), leave salary (4.9) and loans (4.10)
// use these checks. Pure: no database access, safe to unit-test.

/** Audit result for an action refused because it concerned the user's own record. */
export const DENIED_SELF = "DENIED_SELF";

/** True when the acting user's linked employee is this employee. */
export function isOwnRecord(actorEmployeeId: string | null | undefined, employeeId: string | null | undefined): boolean {
  return !!actorEmployeeId && !!employeeId && actorEmployeeId === employeeId;
}

/** True when the acting user's linked employee is among these employees. */
export function includesOwnRecord(actorEmployeeId: string | null | undefined, employeeIds: readonly string[]): boolean {
  return !!actorEmployeeId && employeeIds.includes(actorEmployeeId);
}
