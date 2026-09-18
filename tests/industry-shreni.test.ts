import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INDUSTRY_SECTORS,
  IndustrySectorKey,
  STANDARD_SHRENI_LEVELS,
  getStandardShreniLevels,
  getRecommendedShreniPresets,
  getAllShreniPresets,
} from "../lib/constants/industry-types";

describe("Organization Industry Sectors & Universal Shreni Levels Architecture", () => {
  it("should define all 10 standard organization sectors in Nepal for company classification", () => {
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

  it("should provide canonical Universal Shreni Levels from S1 through S15", () => {
    const levels = getStandardShreniLevels();
    assert.equal(levels.length, 15, "Standard scale must provide 15 levels (S1 to S15)");

    for (let i = 1; i <= 15; i++) {
      const code = `S${i}`;
      const item = levels.find((l) => l.code === code);
      assert.ok(item, `Level ${code} must exist in canonical levels`);
      assert.equal(item.levelNumber, i);
      assert.ok(item.name.includes(code), `Name must contain ${code}`);
      assert.ok(item.labelNepali.includes("तह"), "Nepali label must mention तह");
      assert.ok(item.description && item.description.length > 0, "Level must have a description");
    }
  });

  it("should decouple role titles from Shreni levels (roles belong to Designation)", () => {
    const levels = getStandardShreniLevels();
    // Shreni levels must be clean grade levels, not specific professional roles
    for (const lvl of levels) {
      assert.match(lvl.code, /^S\d+$/, "Code must follow the S1, S2, ... level pattern");
      assert.ok(lvl.name.startsWith("S"), "Level name must start with Level Code");
    }
  });

  it("should provide backward-compatible access through getRecommendedShreniPresets and getAllShreniPresets", () => {
    const bfiPresets = getRecommendedShreniPresets("BFIs");
    assert.equal(bfiPresets.length, 15);
    assert.equal(bfiPresets[0].code, "S1");
    assert.equal(bfiPresets[11].code, "S12");

    const nullPresets = getRecommendedShreniPresets(null);
    assert.equal(nullPresets.length, 15);

    const allPresets = getAllShreniPresets();
    assert.equal(allPresets.length, 15);
  });

  it("should contain unique codes and IDs without collision", () => {
    const seenCodes = new Set<string>();
    for (const lvl of STANDARD_SHRENI_LEVELS) {
      assert.ok(!seenCodes.has(lvl.code), `Duplicate level code found: ${lvl.code}`);
      seenCodes.add(lvl.code);
    }
    assert.equal(seenCodes.size, 15);
  });
});

