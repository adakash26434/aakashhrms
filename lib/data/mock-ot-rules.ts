import type { OtRule } from "@/lib/types/ot-rule";

// ──────────────────────────────────────────────
// Overtime Rules Store
// ──────────────────────────────────────────────
export const mockOtRulesStore = new Map<string, OtRule>();

const now = new Date();

const otRules: OtRule[] = [
  {
    id: "ot-1",
    ruleType: "Hourly",
    ruleName: "Normal Overtime",
    rateOfficeDay: 300,
    rateOffDay: 400,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "ot-2",
    ruleType: "Fixed",
    ruleName: "Public Holiday Duty",
    rateOfficeDay: 900,
    rateOffDay: 1000,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "ot-3",
    ruleType: "Hourly",
    ruleName: "Night Shift OT",
    rateOfficeDay: 400,
    rateOffDay: 500,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "ot-4",
    ruleType: "Fixed",
    ruleName: "Weekend Special Duty",
    rateOfficeDay: 1000,
    rateOffDay: 1100,
    isActive: false,
    createdAt: now,
    updatedAt: now,
  },
];

for (const rule of otRules) {
  mockOtRulesStore.set(rule.id, rule);
}