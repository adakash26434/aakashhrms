/**
 * Mock seed data for the Salary Mapping repository.
 *
 * Exposes:
 *   - `mockSalaryMappingStore` — a mutable Map<string, SalaryMapping>
 *   - `seedSalaryMappings()` — populates the store with 20 records
 *
 * Each mapping references:
 *   - An employee from the mock employee store
 *   - Pay heads from the mock pay head store
 *   - Loan deduction placeholders
 */

import type { SalaryMapping, SalaryHeadAssignment } from "@/lib/types/salary-mapping";

// ---------------------------------------------------------------------------
// Mutable in-memory store
// ---------------------------------------------------------------------------

export const mockSalaryMappingStore = new Map<string, SalaryMapping>();

// ---------------------------------------------------------------------------
// Static ISO timestamps
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();
const EFF_FROM = "2025-07-01"; // Start of current FY (Shrawan)

// ---------------------------------------------------------------------------
// Helper to build salary heads
// ---------------------------------------------------------------------------

function buildHead(
  id: string,
  payHeadId: string,
  payHeadName: string,
  payHeadType: "allowance" | "deduction",
  amount: number,
  isChangeable = true,
): SalaryHeadAssignment {
  return { id, payHeadId, payHeadName, payHeadType, amount, isChangeable };
}

// ---------------------------------------------------------------------------
// Mapping definitions
// We create mappings for emp-1 through emp-8 (core) and emp-fill-1 through emp-fill-12
// ---------------------------------------------------------------------------

interface MappingDef {
  employeeId: string;
  basicSalary: number;
  gradePercent: number;
  gradeAmount: number;
  allowances: { payHeadId: string; name: string; amount: number }[];
  deductions: { payHeadId: string; name: string; amount: number }[];
  loan1Deduction: number;
  loan2Deduction: number;
  loan1Remaining: number;
  loan2Remaining: number;
}

const MAPPING_DEFS: MappingDef[] = [
  // emp-1: Anjali Karki — HR Manager
  {
    employeeId: "emp-1",
    basicSalary: 50000,
    gradePercent: 100,
    gradeAmount: 72000,
    allowances: [
      { payHeadId: "ph-001", name: "Basic Salary", amount: 50000 },
      { payHeadId: "ph-002", name: "Grade Allowance", amount: 72000 },
      { payHeadId: "ph-006", name: "Travel Allowance", amount: 5000 },
    ],
    deductions: [
      { payHeadId: "ph-008", name: "Social Security Fund (SSF)", amount: 5500 },
      { payHeadId: "ph-010", name: "TDS / Income Tax", amount: 3500 },
    ],
    loan1Deduction: 5000,
    loan2Deduction: 0,
    loan1Remaining: 45000,
    loan2Remaining: 0,
  },
  // emp-2: Rajan Bhandari — DevOps
  {
    employeeId: "emp-2",
    basicSalary: 35000,
    gradePercent: 100,
    gradeAmount: 55000,
    allowances: [
      { payHeadId: "ph-001", name: "Basic Salary", amount: 35000 },
      { payHeadId: "ph-002", name: "Grade Allowance", amount: 55000 },
      { payHeadId: "ph-004", name: "Remote Allowance", amount: 50000 },
    ],
    deductions: [
      { payHeadId: "ph-008", name: "Social Security Fund (SSF)", amount: 3850 },
    ],
    loan1Deduction: 0,
    loan2Deduction: 0,
    loan1Remaining: 0,
    loan2Remaining: 0,
  },
  // emp-3: Sushant Adhikari — Finance Manager
  {
    employeeId: "emp-3",
    basicSalary: 65000,
    gradePercent: 100,
    gradeAmount: 95000,
    allowances: [
      { payHeadId: "ph-001", name: "Basic Salary", amount: 65000 },
      { payHeadId: "ph-002", name: "Grade Allowance", amount: 95000 },
      { payHeadId: "ph-006", name: "Travel Allowance", amount: 8000 },
    ],
    deductions: [
      { payHeadId: "ph-008", name: "Social Security Fund (SSF)", amount: 7150 },
      { payHeadId: "ph-009", name: "CIT Deduction", amount: 5000 },
      { payHeadId: "ph-010", name: "TDS / Income Tax", amount: 8500 },
    ],
    loan1Deduction: 0,
    loan2Deduction: 0,
    loan1Remaining: 0,
    loan2Remaining: 0,
  },
  // emp-4: Nabin Sharma — Logistics Manager
  {
    employeeId: "emp-4",
    basicSalary: 42000,
    gradePercent: 100,
    gradeAmount: 68000,
    allowances: [
      { payHeadId: "ph-001", name: "Basic Salary", amount: 42000 },
      { payHeadId: "ph-002", name: "Grade Allowance", amount: 68000 },
    ],
    deductions: [
      { payHeadId: "ph-008", name: "Social Security Fund (SSF)", amount: 4620 },
      { payHeadId: "ph-010", name: "TDS / Income Tax", amount: 2500 },
    ],
    loan1Deduction: 3000,
    loan2Deduction: 0,
    loan1Remaining: 18000,
    loan2Remaining: 0,
  },
  // emp-5: Pratima Shrestha — Engineering Manager (On Leave)
  {
    employeeId: "emp-5",
    basicSalary: 52000,
    gradePercent: 100,
    gradeAmount: 78000,
    allowances: [
      { payHeadId: "ph-001", name: "Basic Salary", amount: 52000 },
      { payHeadId: "ph-002", name: "Grade Allowance", amount: 78000 },
      { payHeadId: "ph-004", name: "Remote Allowance", amount: 50000 },
    ],
    deductions: [
      { payHeadId: "ph-008", name: "Social Security Fund (SSF)", amount: 5720 },
      { payHeadId: "ph-010", name: "TDS / Income Tax", amount: 4500 },
      { payHeadId: "ph-013", name: "Insurance Premium", amount: 2000 },
    ],
    loan1Deduction: 0,
    loan2Deduction: 2000,
    loan1Remaining: 0,
    loan2Remaining: 12000,
  },
  // emp-6: Bimal Acharya — Sales Manager (On Leave)
  {
    employeeId: "emp-6",
    basicSalary: 38000,
    gradePercent: 100,
    gradeAmount: 62000,
    allowances: [
      { payHeadId: "ph-001", name: "Basic Salary", amount: 38000 },
      { payHeadId: "ph-002", name: "Grade Allowance", amount: 62000 },
      { payHeadId: "ph-006", name: "Travel Allowance", amount: 3000 },
    ],
    deductions: [
      { payHeadId: "ph-008", name: "Social Security Fund (SSF)", amount: 4180 },
      { payHeadId: "ph-011", name: "Absent / Leave Deduction", amount: 2000 },
    ],
    loan1Deduction: 0,
    loan2Deduction: 0,
    loan1Remaining: 0,
    loan2Remaining: 0,
  },
  // emp-7: Maya Chaudhary — CS Officer (Contract, On Leave)
  {
    employeeId: "emp-7",
    basicSalary: 25000,
    gradePercent: 100,
    gradeAmount: 42000,
    allowances: [
      { payHeadId: "ph-001", name: "Basic Salary", amount: 25000 },
      { payHeadId: "ph-002", name: "Grade Allowance", amount: 42000 },
    ],
    deductions: [
      { payHeadId: "ph-010", name: "TDS / Income Tax", amount: 1000 },
    ],
    loan1Deduction: 0,
    loan2Deduction: 0,
    loan1Remaining: 0,
    loan2Remaining: 0,
  },
  // emp-8: Kiran Thapa — Ops Officer (Terminated)
  {
    employeeId: "emp-8",
    basicSalary: 30000,
    gradePercent: 100,
    gradeAmount: 48000,
    allowances: [
      { payHeadId: "ph-001", name: "Basic Salary", amount: 30000 },
      { payHeadId: "ph-002", name: "Grade Allowance", amount: 48000 },
    ],
    deductions: [
      { payHeadId: "ph-008", name: "Social Security Fund (SSF)", amount: 3300 },
    ],
    loan1Deduction: 0,
    loan2Deduction: 0,
    loan1Remaining: 0,
    loan2Remaining: 0,
  },
];

// Generate mappings for filler employees
function buildFillerMappings(): MappingDef[] {
  const fillerBaseSalaries = [28000, 32000, 36000, 30000, 34000, 38000, 26000, 31000, 29000, 27000, 33000, 35000];
  return fillerBaseSalaries.map((base, index) => ({
    employeeId: `emp-fill-${index + 1}`,
    basicSalary: base,
    gradePercent: 100,
    gradeAmount: base + 20000 + index * 1000,
    allowances: [
      { payHeadId: "ph-001", name: "Basic Salary", amount: base },
      { payHeadId: "ph-002", name: "Grade Allowance", amount: base + 20000 + index * 1000 },
    ],
    deductions: [
      { payHeadId: "ph-008", name: "Social Security Fund (SSF)", amount: Math.round(base * 0.11) },
    ],
    loan1Deduction: 0,
    loan2Deduction: 0,
    loan1Remaining: 0,
    loan2Remaining: 0,
  }));
}

// ---------------------------------------------------------------------------
// Function to calculate net amount
// ---------------------------------------------------------------------------

function calcNet(def: MappingDef): number {
  const gradeValue = def.basicSalary * (def.gradePercent / 100);
  const totalAllowances = def.allowances.reduce((s, a) => s + a.amount, 0);
  const totalDeductions = def.deductions.reduce((s, d) => s + d.amount, 0);
  return Math.max(0, Math.round(
    def.basicSalary + gradeValue + def.gradeAmount + totalAllowances - totalDeductions - def.loan1Deduction - def.loan2Deduction,
  ));
}

// ---------------------------------------------------------------------------
// Build all seed mappings
// ---------------------------------------------------------------------------

const ALL_DEFS: MappingDef[] = [...MAPPING_DEFS, ...buildFillerMappings()];

function buildSeedMappings(): SalaryMapping[] {
  let headSeq = 0;

  return ALL_DEFS.map((def, idx) => {
    const id = `sm-${String(idx + 1).padStart(3, "0")}`;

    const salaryHeads: SalaryHeadAssignment[] = [
      ...def.allowances.map((a) => {
        headSeq++;
        return buildHead(
          `sh-${String(headSeq).padStart(3, "0")}`,
          a.payHeadId,
          a.name,
          "allowance",
          a.amount,
        );
      }),
      ...def.deductions.map((d) => {
        headSeq++;
        return buildHead(
          `sh-${String(headSeq).padStart(3, "0")}`,
          d.payHeadId,
          d.name,
          "deduction",
          d.amount,
        );
      }),
    ];

    const netAmount = calcNet(def);

    return {
      id,
      employeeId: def.employeeId,
      fiscalYearId: "fy-1", // Current FY placeholder
      effectiveFrom: EFF_FROM,
      basicSalary: def.basicSalary,
      gradePercent: def.gradePercent,
      gradeAmount: def.gradeAmount,
      salaryHeads,
      loan1Deduction: def.loan1Deduction,
      loan2Deduction: def.loan2Deduction,
      loan1Remaining: def.loan1Remaining,
      loan2Remaining: def.loan2Remaining,
      netAmount,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
    };
  });
}

// ---------------------------------------------------------------------------
// Seed the store
// ---------------------------------------------------------------------------

const SEED: SalaryMapping[] = buildSeedMappings();

SEED.forEach((m) => mockSalaryMappingStore.set(m.id, m));