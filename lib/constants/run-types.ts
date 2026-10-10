// Pay run types (4.8 / F6). REGULAR is the monthly salary; FESTIVAL and ARREARS are off-cycle runs
// in the same pay month that pay one thing on its own (see lib/engines/off-cycle.engine.ts).

export const RUN_TYPES = ["REGULAR", "FESTIVAL", "ARREARS"] as const;
export type RunType = (typeof RUN_TYPES)[number];

export const RUN_TYPE_LABEL: Record<RunType, { en: string; np: string; hint: string }> = {
  REGULAR: { en: "Regular salary", np: "मासिक तलब", hint: "The month's salary: attendance, allowances, statutory deductions, loans, claims and funds." },
  FESTIVAL: { en: "Festival allowance", np: "चाडपर्व खर्च", hint: "One month's basic (or the head's rule), in proportion for service under a year; taxed on its own." },
  ARREARS: { en: "Arrears", np: "बक्यौता", hint: "Back pay for back-dated salary revisions into finalised months; taxed on its own." },
};

export const asRunType = (value: unknown): RunType => (RUN_TYPES.includes(value as RunType) ? (value as RunType) : "REGULAR");
export const isOffCycle = (type: unknown): boolean => asRunType(type) !== "REGULAR";
