// Label pay heads (4.12e): onboarding's "Basic Salary" (BASIC) and "Grade Amount" (GRADE). Basic
// and grade are set in each salary structure itself, so these heads only name them and hold no
// amount: no salary change or template takes a new amount on one, and Setup → Pay heads keeps them
// as they are (only their names change). An amount a structure still holds from before 4.4 is paid
// on top of basic / grade until someone revises it away; Setup → Pay heads and the payroll
// pre-flight list who.

/** A label head: an allowance whose code, letters only, is BASIC or GRADE ("grade" too). */
export function isLabelHead(head: { code: string | null | undefined; type: string }): boolean {
  if (head.type === "deduction") return false;
  const code = (head.code ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  return code === "BASIC" || code === "GRADE";
}

/** What a label head names, in words: "the basic salary" or "the grade". */
export function labelNames(head: { code: string | null | undefined }): string {
  return (head.code ?? "").toUpperCase().replace(/[^A-Z]/g, "") === "GRADE" ? "the grade" : "the basic salary";
}
