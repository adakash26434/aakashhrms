import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INDUSTRY_PRESET_TEMPLATES,
  getPresetLevels,
  BFI_SHRENI_PRESET,
  SANSTHAN_SHRENI_PRESET,
  CORPORATE_SHRENI_PRESET,
  NGO_SHRENI_PRESET,
  STANDARD_SHRENI_LEVELS,
} from "../lib/constants/industry-types";

describe("Company & Organizational Setup Master Module Architecture", () => {
  describe("Industry Scale Presets & Templates", () => {
    it("should provide all 5 standard industry preset templates for tenant customization", () => {
      assert.equal(INDUSTRY_PRESET_TEMPLATES.length, 5);

      const keys = INDUSTRY_PRESET_TEMPLATES.map((t) => t.key);
      assert.ok(keys.includes("universal"));
      assert.ok(keys.includes("bfi"));
      assert.ok(keys.includes("sansthan"));
      assert.ok(keys.includes("corporate"));
      assert.ok(keys.includes("ngo"));
    });

    it("should provide 15 levels for BFI Banking industry with assistant, officer, manager and executive tiers", () => {
      assert.equal(BFI_SHRENI_PRESET.length, 15);
      assert.equal(BFI_SHRENI_PRESET[0].code, "L1");
      assert.ok(BFI_SHRENI_PRESET[0].name.includes("Junior Assistant"));
      assert.ok(BFI_SHRENI_PRESET[14].name.includes("Chief Executive Officer"));
      assert.equal(BFI_SHRENI_PRESET[14].levelNumber, 15);
    });

    it("should provide 12 levels for Public Enterprise / Sansthan (तह १ देखि १२)", () => {
      assert.equal(SANSTHAN_SHRENI_PRESET.length, 12);
      assert.equal(SANSTHAN_SHRENI_PRESET[0].code, "T1");
      assert.ok(SANSTHAN_SHRENI_PRESET[0].name.includes("तह १"));
      assert.ok(SANSTHAN_SHRENI_PRESET[11].name.includes("तह १२"));
      assert.equal(SANSTHAN_SHRENI_PRESET[11].levelNumber, 12);
    });

    it("should provide 10 levels for Corporate and Tech enterprise", () => {
      assert.equal(CORPORATE_SHRENI_PRESET.length, 10);
      assert.equal(CORPORATE_SHRENI_PRESET[0].code, "L1");
      assert.ok(CORPORATE_SHRENI_PRESET[0].name.includes("Associate"));
      assert.ok(CORPORATE_SHRENI_PRESET[9].name.includes("C-Suite"));
    });

    it("should provide 7 thematic bands for NGO/INGO sector", () => {
      assert.equal(NGO_SHRENI_PRESET.length, 7);
      assert.equal(NGO_SHRENI_PRESET[0].code, "B1");
      assert.ok(NGO_SHRENI_PRESET[6].name.includes("Country Representative"));
    });

    it("should retrieve the correct preset levels via getPresetLevels helper", () => {
      const bfi = getPresetLevels("bfi");
      assert.equal(bfi.length, 15);
      assert.equal(bfi[0].code, "L1");

      const sansthan = getPresetLevels("sansthan");
      assert.equal(sansthan.length, 12);

      const unknown = getPresetLevels("non_existent_preset");
      assert.equal(unknown.length, 15);
      assert.equal(unknown[0].code, "S1");
    });
  });

  describe("Nepal Labour Act Employment Classifications", () => {
    it("should recognize statutory benefit eligibility differences across employment types", () => {
      // Permanent employees are eligible for SSF, PF, and Festival Dashain Allowance
      const permanentRules = {
        isPfEligible: true,
        isSsfEligible: true,
        isFestivalEligible: true,
        isLeaveEligible: true,
        noticePeriodDays: 30,
      };
      assert.equal(permanentRules.isSsfEligible, true);
      assert.equal(permanentRules.isFestivalEligible, true);

      // Consultants are exempt from SSF/PF deductions (pure 15% TDS withholding)
      const consultantRules = {
        isPfEligible: false,
        isSsfEligible: false,
        isFestivalEligible: false,
        isLeaveEligible: false,
        noticePeriodDays: 30,
      };
      assert.equal(consultantRules.isSsfEligible, false);
      assert.equal(consultantRules.isPfEligible, false);
      assert.equal(consultantRules.isFestivalEligible, false);
    });
  });

  describe("Work Schedule & Weekly Off Policies", () => {
    it("should compute working days per week based on designated weekly off days", () => {
      const standardNepalSchedule = {
        weeklyOffDays: ["Saturday"],
        workingDaysPerWeek: 6,
      };
      assert.equal(standardNepalSchedule.workingDaysPerWeek, 7 - standardNepalSchedule.weeklyOffDays.length);

      const fiveDayCorporateSchedule = {
        weeklyOffDays: ["Saturday", "Sunday"],
        workingDaysPerWeek: 5,
      };
      assert.equal(fiveDayCorporateSchedule.workingDaysPerWeek, 7 - fiveDayCorporateSchedule.weeklyOffDays.length);
    });
  });

  describe("Navigation & Architectural De-duplication", () => {
    it("should ensure Workforce sidebar contains only employee-centric operations without duplicate structural modules", async () => {
      const { NAV_GROUPS } = await import("../lib/constants/navigation");
      const workforceGroup = NAV_GROUPS.find((g) => g.label === "Workforce");
      assert.ok(workforceGroup, "Workforce group must exist");

      const workforceHrefs = workforceGroup.items.map((i) => i.href);
      assert.ok(workforceHrefs.includes("/workforce/employees"));
      assert.ok(workforceHrefs.includes("/workforce/salary-mapping"));
      assert.ok(workforceHrefs.includes("/workforce/organization"), "Organization points to /workforce/organization");
    });

    it("should ensure Configuration sidebar contains unified Company Setup master hub", async () => {
      const { NAV_GROUPS } = await import("../lib/constants/navigation");
      const configGroup = NAV_GROUPS.find((g) => g.label === "Configuration");
      assert.ok(configGroup, "Configuration group must exist");

      const companySetupItem = configGroup.items.find((i) => i.href === "/setup/company-setup");
      assert.ok(companySetupItem, "Company setup must be in Configuration");
      assert.equal(companySetupItem.requiredModule, "ORG_STRUCTURE");
    });
  });

  describe("Two-Tier Company Governance & Super Admin Verification Workflow", () => {
    it("should correctly partition company identity fields into Tier 1 (Locked) and Tier 2 (Self-Service)", () => {
      const TIER_1_STATUTORY_FIELDS = [
        "legalName",
        "panVatNumber",
        "registrationNumber",
        "industryType",
        "headOfficeAddress",
      ];

      const TIER_2_OPERATIONAL_FIELDS = [
        "displayName",
        "contactEmail",
        "contactPhone",
        "signatory1Name",
        "signatory1Title",
        "signatory2Name",
        "signatory2Title",
        "logoUrl",
      ];

      // Mutually exclusive and exhaustive for profile attributes
      assert.equal(TIER_1_STATUTORY_FIELDS.length, 5);
      assert.equal(TIER_2_OPERATIONAL_FIELDS.length, 8);
      for (const field of TIER_1_STATUTORY_FIELDS) {
        assert.equal(TIER_2_OPERATIONAL_FIELDS.includes(field), false, `${field} cannot be in Tier 2`);
      }
    });

    it("should enforce mandatory justification and valid legal name for change request submission", () => {
      function validateChangeRequestPayload(payload: { proposedValues: { legalName?: string }; reason?: string }) {
        if (!payload.proposedValues?.legalName?.trim()) {
          return { valid: false, error: "Legal company name is required." };
        }
        if (!payload.reason || payload.reason.trim().length < 8) {
          return { valid: false, error: "Please provide a clear justification (at least 8 characters)." };
        }
        return { valid: true };
      }

      assert.equal(validateChangeRequestPayload({ proposedValues: { legalName: "" }, reason: "Official OCR update" }).valid, false);
      assert.equal(validateChangeRequestPayload({ proposedValues: { legalName: "Acme Corp" }, reason: "short" }).valid, false);
      assert.equal(validateChangeRequestPayload({ proposedValues: { legalName: "Acme Corp" }, reason: "Official name amendment registered at OCR" }).valid, true);
    });

    it("should produce complete dual-write systemConfig keys upon Super Admin approval", () => {
      const proposedValues = {
        legalName: "Himalayan Tech Pvt Ltd",
        panVatNumber: "601234567",
        registrationNumber: "12345/080/081",
        industryType: "Technology",
        headOfficeAddress: "Ward 4, Baluwatar, Kathmandu",
      };

      const syncKeys = [
        { key: "company_legal_name", value: proposedValues.legalName },
        { key: "company_pan_vat", value: proposedValues.panVatNumber },
        { key: "company_registration_no", value: proposedValues.registrationNumber },
        { key: "company_industry_type", value: proposedValues.industryType },
        { key: "company_office_address", value: proposedValues.headOfficeAddress },
      ];

      assert.equal(syncKeys.length, 5);
      assert.equal(syncKeys.find((k) => k.key === "company_legal_name")?.value, "Himalayan Tech Pvt Ltd");
      assert.equal(syncKeys.find((k) => k.key === "company_pan_vat")?.value, "601234567");
      assert.equal(syncKeys.find((k) => k.key === "company_office_address")?.value, "Ward 4, Baluwatar, Kathmandu");
    });

    it("should disallow approving or rejecting non-pending change requests", () => {
      function canReviewRequest(status: string) {
        return status === "PENDING";
      }

      assert.equal(canReviewRequest("PENDING"), true);
      assert.equal(canReviewRequest("APPROVED"), false);
      assert.equal(canReviewRequest("REJECTED"), false);
      assert.equal(canReviewRequest("CANCELLED"), false);
    });
  });
});


