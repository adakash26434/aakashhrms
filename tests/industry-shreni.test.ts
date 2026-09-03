import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INDUSTRY_SECTORS,
  IndustrySectorKey,
  SHRENI_PRESETS_BY_SECTOR,
  getRecommendedShreniPresets,
  getAllShreniPresets,
} from "../lib/constants/industry-types";

describe("Organization Industry Sectors & Adaptive Shreni Presets", () => {
  it("should define all 10 standard organization sectors in Nepal", () => {
    const expectedSectors: IndustrySectorKey[] = [
      "BFIs",
      "Cooperatives",
      "Corporate",
      "Healthcare",
      "Education",
      "Manufacturing",
      "Hospitality",
      "NGO_INGO",
      "Government",
      "General",
    ];

    const actualKeys = Object.keys(INDUSTRY_SECTORS) as IndustrySectorKey[];
    assert.equal(actualKeys.length, 10);
    for (const key of expectedSectors) {
      assert.ok(INDUSTRY_SECTORS[key], `Sector ${key} should be defined`);
      assert.ok(INDUSTRY_SECTORS[key].label, `Sector ${key} should have an English label`);
      assert.ok(INDUSTRY_SECTORS[key].labelNepali, `Sector ${key} should have a Nepali label`);
      assert.ok(INDUSTRY_SECTORS[key].description, `Sector ${key} should have a description`);
    }
  });

  it("should provide NRB Banking Levels 1 to 11 for BFIs", () => {
    const bfiPresets = getRecommendedShreniPresets("BFIs");
    assert.ok(bfiPresets.length >= 8);
    const hasExecutive = bfiPresets.some((p) => p.name.includes("Level 10-11"));
    const hasOfficer = bfiPresets.some((p) => p.name.includes("Level 6"));
    const hasAssistant = bfiPresets.some((p) => p.name.includes("Level 4"));
    const hasSupport = bfiPresets.some((p) => p.name.includes("Level 1-2"));

    assert.ok(hasExecutive, "BFIs must include Level 10-11 Executive");
    assert.ok(hasOfficer, "BFIs must include Level 6 Officer");
    assert.ok(hasAssistant, "BFIs must include Level 4 Assistant");
    assert.ok(hasSupport, "BFIs must include Level 1-2 Support");
  });

  it("should provide standard cooperative functional tiers for Cooperatives", () => {
    const coopPresets = getRecommendedShreniPresets("Cooperatives");
    assert.ok(coopPresets.length >= 6);
    const hasCeo = coopPresets.some((p) => p.name.includes("व्यवस्थापक / मुख्य कार्यकारी"));
    const hasOfficer = coopPresets.some((p) => p.name.includes("अधिकृत तह"));
    const hasSeniorAssistant = coopPresets.some((p) => p.name.includes("वरिष्ठ सहायक"));
    const hasCollector = coopPresets.some((p) => p.name.includes("कनिष्ठ सहायक / बजार प्रतिनिधि"));
    const hasSupport = coopPresets.some((p) => p.name.includes("सहयोगी तह"));

    assert.ok(hasCeo, "Cooperatives must include CEO / General Manager");
    assert.ok(hasOfficer, "Cooperatives must include Officer");
    assert.ok(hasSeniorAssistant, "Cooperatives must include Senior Assistant");
    assert.ok(hasCollector, "Cooperatives must include Field Collector");
    assert.ok(hasSupport, "Cooperatives must include Support Staff");
  });

  it("should provide the MAXIMUM UNIVERSAL 12-TIER scale for General / Unclassified organizations", () => {
    const generalPresets = getRecommendedShreniPresets("General");
    assert.equal(generalPresets.length, 12, "General must provide exactly 12 universal levels");

    // Verify all 12 levels exist in order from Level 12 down to Level 1
    for (let lvl = 1; lvl <= 12; lvl++) {
      const item = generalPresets.find((p) => p.levelNumber === lvl);
      assert.ok(item, `General sector must provide Level ${lvl}`);
      assert.ok(item.name.includes(`Level ${lvl}:`));
    }
  });

  it("should fall back to General Maximum scale when sector is null, undefined, or invalid", () => {
    const nullPresets = getRecommendedShreniPresets(null);
    assert.equal(nullPresets.length, 12);
    assert.equal(nullPresets[0].levelNumber, 12);

    const undefinedPresets = getRecommendedShreniPresets(undefined);
    assert.equal(undefinedPresets.length, 12);

    const invalidPresets = getRecommendedShreniPresets("unknown_sector_xyz");
    assert.equal(invalidPresets.length, 12);
  });

  it("should contain unique preset IDs across all sectors without collision", () => {
    const allPresets = getAllShreniPresets();
    const seenIds = new Set<string>();

    for (const preset of allPresets) {
      assert.ok(!seenIds.has(preset.id), `Duplicate preset id found: ${preset.id}`);
      seenIds.add(preset.id);
      assert.ok(preset.name.trim().length > 0, "Preset name must not be empty");
    }
  });
});
