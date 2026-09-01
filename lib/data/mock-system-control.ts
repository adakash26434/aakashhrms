import type { SystemControlData } from "@/lib/types/system-control";

/**
 * Module-level mutable settings object. The repository reads from
 * and writes to this single record. There is exactly one
 * configuration record per system.
 *
 * **Why mutable?** The mock repository needs to update the
 * settings in place when the user clicks "Save Changes". When the
 * real DB is wired, this object is replaced by a Drizzle upsert
 * and the mutability goes away.
 */
export const mockSettings: SystemControlData = {
  officeTime: {
    inTime: { hour: 10, minute: 0, meridiem: "AM" },
    outTime: { hour: 4, minute: 0, meridiem: "PM" },
    calculateOtAndAbsent: true,
    applyGraceWindow: true,
    graceWindowMinutes: 40,
  },
  manualAttendance: {
    defaultWhenNotPosted: "Absent",
    yearlyInsurancePremiumLimit: 50000,
  },
  leavePermissions: {
    enabledCategories: {
      Permanent: true,
      Temporary: true,
      OutSource: false,
      Consultant: false,
      Trainee: false,
      Volunteer: false,
      Contract: false,
    },
  },
  statutoryDeductionLimits: {
    pfMaximumLimitPercent: 30,
    citLimitNpr: 300000,
    retirementFundLimitNpr: 500000,
    handicappedDeductionPercent: 50,
    companyHasSsf: true,
  },
  insuranceDiscounts: {
    medicalInsuranceNpr: 20000,
    houseInsuranceNpr: 5000,
    lifeInsuranceNpr: 25000,
    womenDiscountPercent: 10,
    remoteAllowanceNpr: 50000,
  },
};

/**
 * **Deprecated** snapshot view, kept for any old call site that
 * imported `mockSystemControlData` directly. New code should go
 * through the service layer.
 *
 * @deprecated Use `systemControlService.getSystemControlData()`.
 */
export const mockSystemControlData: SystemControlData = mockSettings;

/**
 * Async data getter used by the server component. Kept for
 * backwards-compat.
 *
 * @deprecated Use the service layer.
 */
export async function getSystemControlData(): Promise<SystemControlData> {
  return mockSettings;
}
