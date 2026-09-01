import { db } from '../lib/db';
import { leaveTypes, leaveRules } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

const STATUTORY_LEAVES = [
  {
    name: "Home Leave (Annual)",
    code: "HOME",
    leaveType: "Pay",
    noOfDays: "18.0",
    carryForward: true,
    accumulationCap: "90.0",
    maxPaidDays: null,
    isStatutory: true,
    statutoryCode: "HOME",
    genderApplicable: "All",
    requiresDocument: false,
    documentThresholdDays: null,
    isEncashable: true,
    encashmentBasis: "BasicSalary",
    proRataForNewJoinees: true,
    rule: {
      ruleName: "Home Leave Statutory Accrual",
      accrualMethod: "DAYS_WORKED",
      accrualValue: "20.00", // 1 day per 20 days worked
      encashmentRate: "BASIC_DAILY",
      encashmentFixedAmount: "0.00",
      minServiceDaysForEligibility: 0,
    }
  },
  {
    name: "Sick Leave",
    code: "SICK",
    leaveType: "Pay",
    noOfDays: "12.0",
    carryForward: true,
    accumulationCap: "45.0",
    maxPaidDays: null,
    isStatutory: true,
    statutoryCode: "SICK",
    genderApplicable: "All",
    requiresDocument: true,
    documentThresholdDays: 3, // Required for > 3 days
    isEncashable: true,
    encashmentBasis: "BasicSalary",
    proRataForNewJoinees: true,
    rule: {
      ruleName: "Sick Leave Statutory Allocation",
      accrualMethod: "FIXED_ANNUAL",
      accrualValue: "12.00",
      encashmentRate: "BASIC_DAILY",
      encashmentFixedAmount: "0.00",
      minServiceDaysForEligibility: 0,
    }
  },
  {
    name: "Maternity Leave",
    code: "MATERNITY",
    leaveType: "Partial-Pay", // 60 days paid, rest unpaid
    noOfDays: "98.0",
    carryForward: false,
    accumulationCap: null,
    maxPaidDays: "60.0",
    isStatutory: true,
    statutoryCode: "MATERNITY",
    genderApplicable: "Female",
    requiresDocument: true,
    documentThresholdDays: 1,
    isEncashable: false,
    encashmentBasis: null,
    proRataForNewJoinees: false,
    rule: {
      ruleName: "Maternity Leave Statutory Allocation",
      accrualMethod: "FIXED_ANNUAL",
      accrualValue: "98.00",
      encashmentRate: "BASIC_DAILY",
      encashmentFixedAmount: "0.00",
      minServiceDaysForEligibility: 0,
    }
  },
  {
    name: "Paternity Leave",
    code: "PATERNITY",
    leaveType: "Pay",
    noOfDays: "15.0",
    carryForward: false,
    accumulationCap: null,
    maxPaidDays: null,
    isStatutory: true,
    statutoryCode: "PATERNITY",
    genderApplicable: "Male",
    requiresDocument: true,
    documentThresholdDays: 1,
    isEncashable: false,
    encashmentBasis: null,
    proRataForNewJoinees: false,
    rule: {
      ruleName: "Paternity Leave Statutory Allocation",
      accrualMethod: "FIXED_ANNUAL",
      accrualValue: "15.00",
      encashmentRate: "BASIC_DAILY",
      encashmentFixedAmount: "0.00",
      minServiceDaysForEligibility: 0,
    }
  },
  {
    name: "Mourning Leave",
    code: "MOURNING",
    leaveType: "Pay",
    noOfDays: "13.0",
    carryForward: false,
    accumulationCap: null,
    maxPaidDays: null,
    isStatutory: true,
    statutoryCode: "MOURNING",
    genderApplicable: "All",
    requiresDocument: false,
    documentThresholdDays: null,
    isEncashable: false,
    encashmentBasis: null,
    proRataForNewJoinees: false,
    rule: {
      ruleName: "Mourning Leave Statutory Allocation",
      accrualMethod: "FIXED_ANNUAL",
      accrualValue: "13.00",
      encashmentRate: "BASIC_DAILY",
      encashmentFixedAmount: "0.00",
      minServiceDaysForEligibility: 0,
    }
  },
  {
    name: "Substitute Leave",
    code: "SUBSTITUTE",
    leaveType: "Pay",
    noOfDays: "0.0", // Earned as worked
    carryForward: false,
    accumulationCap: null,
    maxPaidDays: null,
    isStatutory: true,
    statutoryCode: "SUBSTITUTE",
    genderApplicable: "All",
    requiresDocument: false,
    documentThresholdDays: null,
    isEncashable: false,
    encashmentBasis: null,
    proRataForNewJoinees: false,
    rule: {
      ruleName: "Substitute Leave Statutory Allocation",
      accrualMethod: "FIXED_ANNUAL",
      accrualValue: "0.00",
      encashmentRate: "BASIC_DAILY",
      encashmentFixedAmount: "0.00",
      minServiceDaysForEligibility: 0,
    }
  }
];

async function seed() {
  console.log("🌱 Starting Statutory Leave Policies Seed...");

  for (const item of STATUTORY_LEAVES) {
    // Check if leave type already exists
    const existingType = await db
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.code, item.code));

    let typeId: string;

    if (existingType.length > 0) {
      console.log(`Type ${item.code} already exists. Updating properties...`);
      typeId = existingType[0].id;
      await db
        .update(leaveTypes)
        .set({
          name: item.name,
          leaveType: item.leaveType,
          noOfDays: item.noOfDays,
          carryForward: item.carryForward,
          accumulationCap: item.accumulationCap,
          maxPaidDays: item.maxPaidDays,
          isStatutory: item.isStatutory,
          statutoryCode: item.statutoryCode,
          genderApplicable: item.genderApplicable,
          requiresDocument: item.requiresDocument,
          documentThresholdDays: item.documentThresholdDays,
          isEncashable: item.isEncashable,
          encashmentBasis: item.encashmentBasis,
          proRataForNewJoinees: item.proRataForNewJoinees,
          updatedAt: new Date(),
        })
        .where(eq(leaveTypes.id, typeId));
    } else {
      console.log(`Creating statutory leave type: ${item.name} (${item.code})`);
      const inserted = await db
        .insert(leaveTypes)
        .values({
          name: item.name,
          code: item.code,
          leaveType: item.leaveType,
          noOfDays: item.noOfDays,
          carryForward: item.carryForward,
          accumulationCap: item.accumulationCap,
          maxPaidDays: item.maxPaidDays,
          isStatutory: item.isStatutory,
          statutoryCode: item.statutoryCode,
          genderApplicable: item.genderApplicable,
          requiresDocument: item.requiresDocument,
          documentThresholdDays: item.documentThresholdDays,
          isEncashable: item.isEncashable,
          encashmentBasis: item.encashmentBasis,
          proRataForNewJoinees: item.proRataForNewJoinees,
        })
        .returning();
      typeId = inserted[0].id;
    }

    // Now seed corresponding leave rule
    const existingRule = await db
      .select()
      .from(leaveRules)
      .where(eq(leaveRules.leaveTypeId, typeId));

    if (existingRule.length > 0) {
      console.log(`Statutory leave rule for ${item.code} already exists. Updating...`);
      await db
        .update(leaveRules)
        .set({
          ruleName: item.rule.ruleName,
          ruleCategory: "STATUTORY",
          accrualMethod: item.rule.accrualMethod,
          accrualValue: item.rule.accrualValue,
          encashmentRate: item.rule.encashmentRate,
          encashmentFixedAmount: item.rule.encashmentFixedAmount,
          minServiceDaysForEligibility: item.rule.minServiceDaysForEligibility,
          updatedAt: new Date(),
        })
        .where(eq(leaveRules.id, existingRule[0].id));
    } else {
      console.log(`Creating statutory leave rule for: ${item.code}`);
      await db.insert(leaveRules).values({
        leaveTypeId: typeId,
        ruleName: item.rule.ruleName,
        ruleCategory: "STATUTORY",
        accrualMethod: item.rule.accrualMethod,
        accrualValue: item.rule.accrualValue,
        encashmentRate: item.rule.encashmentRate,
        encashmentFixedAmount: item.rule.encashmentFixedAmount,
        minServiceDaysForEligibility: item.rule.minServiceDaysForEligibility,
        isActive: true,
      });
    }
  }

  console.log("✅ Statutory Leave Policies Seed Completed successfully.");
}

seed()
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
