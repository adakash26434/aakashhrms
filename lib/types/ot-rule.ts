export type OtRuleType = "Hourly" | "Fixed";

export interface OtRule {
  id: string;
  ruleType: OtRuleType;
  ruleName: string;
  rateOfficeDay: number;
  rateOffDay: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OtRuleFormData {
  ruleType: OtRuleType;
  ruleName: string;
  rateOfficeDay: number;
  rateOffDay: number;
  isActive: boolean;
}

export interface OtRuleValidationErrors {
  ruleName?: string;
  rateOfficeDay?: string;
  rateOffDay?: string;
}

export interface OtRuleKPIs {
  total: number;
  hourly: number;
  fixed: number;
}