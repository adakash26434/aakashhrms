import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatDateInput,
  getMaxDaysInMonth,
} from "../lib/utils/date-input-formatter";

describe("Date Input Formatter & Validator (BS and AD)", () => {
  describe("Month Validation (Strict <= 12, never 00)", () => {
    it("should allow valid months 01 to 12", () => {
      const res = formatDateInput({
        raw: "2083/05/",
        prevValue: "2083/05",
        isBS: true,
      });
      assert.equal(res.formatted, "2083/05/");
      assert.equal(res.month, 5);
    });

    it("should auto-pad single digit months between 2 and 9", () => {
      const res = formatDateInput({
        raw: "2083/5",
        prevValue: "2083/",
        isBS: true,
      });
      assert.equal(res.formatted, "2083/05/");
      assert.equal(res.month, 5);
    });

    it("should strictly clamp month > 12 to 12 when typing 15", () => {
      const res = formatDateInput({
        raw: "2083/15",
        prevValue: "2083/1",
        isBS: true,
      });
      assert.equal(res.formatted, "2083/12/");
      assert.equal(res.month, 12);
    });

    it("should strictly clamp month > 12 to 12 when typing 99", () => {
      const res = formatDateInput({
        raw: "208399",
        prevValue: "2083",
        isBS: true,
      });
      assert.equal(res.formatted, "2083/12/");
      assert.equal(res.month, 12);
    });

    it("should clamp month 00 to 01", () => {
      const res = formatDateInput({
        raw: "208300",
        prevValue: "20830",
        isBS: true,
      });
      assert.equal(res.formatted, "2083/01/");
      assert.equal(res.month, 1);
    });
  });

  describe("Day Validation in AD Calendar", () => {
    it("should clamp February 2026 days to 28 max", () => {
      const res = formatDateInput({
        raw: "2026/02/30",
        prevValue: "2026/02/3",
        isBS: false,
      });
      assert.equal(res.formatted, "2026/02/28");
      assert.equal(res.day, 28);
      assert.equal(res.isValid, true);
    });

    it("should allow 29 days in leap year February 2024", () => {
      const res = formatDateInput({
        raw: "2024/02/29",
        prevValue: "2024/02/2",
        isBS: false,
      });
      assert.equal(res.formatted, "2024/02/29");
      assert.equal(res.day, 29);
      assert.equal(res.isValid, true);
    });

    it("should clamp February 2024 days to 29 when typing 30 or 31", () => {
      const res = formatDateInput({
        raw: "2024/02/31",
        prevValue: "2024/02/3",
        isBS: false,
      });
      assert.equal(res.formatted, "2024/02/29");
      assert.equal(res.day, 29);
    });

    it("should clamp 30-day AD months (April) to 30 when typing 31 or 32", () => {
      const res = formatDateInput({
        raw: "2026/04/31",
        prevValue: "2026/04/3",
        isBS: false,
      });
      assert.equal(res.formatted, "2026/04/30");
      assert.equal(res.day, 30);
      assert.equal(res.isValid, true);
    });

    it("should allow 31 days in 31-day AD months (May)", () => {
      const res = formatDateInput({
        raw: "2026/05/31",
        prevValue: "2026/05/3",
        isBS: false,
      });
      assert.equal(res.formatted, "2026/05/31");
      assert.equal(res.day, 31);
      assert.equal(res.isValid, true);
    });

    it("should clamp 32 days in 31-day AD months to 31", () => {
      const res = formatDateInput({
        raw: "2026/05/32",
        prevValue: "2026/05/3",
        isBS: false,
      });
      assert.equal(res.formatted, "2026/05/31");
      assert.equal(res.day, 31);
      assert.equal(res.isValid, true);
    });
  });

  describe("Day Validation in BS Calendar (28 to 32 days)", () => {
    it("should correctly resolve max days for BS months", () => {
      // 2083 BS Asar (month 3) has 32 days
      const asarDays = getMaxDaysInMonth(2083, 3, true);
      assert.equal(asarDays, 32);

      // 2083 BS Baishakh (month 1) has 31 days
      const baishakhDays = getMaxDaysInMonth(2083, 1, true);
      assert.equal(baishakhDays, 31);

      // 2083 BS Mangsir (month 8) has 29 days
      const mangsirDays = getMaxDaysInMonth(2083, 8, true);
      assert.equal(mangsirDays, 29);
    });

    it("should allow 32 days in BS Asar (month 3) when year has 32 days", () => {
      const res = formatDateInput({
        raw: "2083/03/32",
        prevValue: "2083/03/3",
        isBS: true,
      });
      assert.equal(res.formatted, "2083/03/32");
      assert.equal(res.day, 32);
      assert.equal(res.isValid, true);
    });

    it("should clamp day > 32 in BS Asar to 32", () => {
      const res = formatDateInput({
        raw: "2083/03/35",
        prevValue: "2083/03/3",
        isBS: true,
      });
      assert.equal(res.formatted, "2083/03/32");
      assert.equal(res.day, 32);
      assert.equal(res.isValid, true);
    });

    it("should clamp day 32 in a 31-day BS month (Baishakh) to 31", () => {
      const res = formatDateInput({
        raw: "2083/01/32",
        prevValue: "2083/01/3",
        isBS: true,
      });
      assert.equal(res.formatted, "2083/01/31");
      assert.equal(res.day, 31);
      assert.equal(res.isValid, true);
    });

    it("should clamp day 30 in a 29-day BS month (Mangsir) to 29", () => {
      const res = formatDateInput({
        raw: "2083/08/30",
        prevValue: "2083/08/3",
        isBS: true,
      });
      assert.equal(res.formatted, "2083/08/29");
      assert.equal(res.day, 29);
      assert.equal(res.isValid, true);
    });

    it("should clamp day 00 to 01", () => {
      const res = formatDateInput({
        raw: "2083/05/00",
        prevValue: "2083/05/0",
        isBS: true,
      });
      assert.equal(res.formatted, "2083/05/01");
      assert.equal(res.day, 1);
      assert.equal(res.isValid, true);
    });
  });

  describe("Devanagari Numerals & Pasting", () => {
    it("should convert Devanagari numerals to ASCII digits", () => {
      const res = formatDateInput({
        raw: "२०८३/०५/१५",
        prevValue: "",
        isBS: true,
      });
      assert.equal(res.formatted, "2083/05/15");
      assert.equal(res.year, 2083);
      assert.equal(res.month, 5);
      assert.equal(res.day, 15);
      assert.equal(res.isValid, true);
    });

    it("should handle pasted hyphens and single-digit values", () => {
      const res = formatDateInput({
        raw: "2083-5-8",
        prevValue: "",
        isBS: true,
      });
      assert.equal(res.formatted, "2083/05/08");
      assert.equal(res.year, 2083);
      assert.equal(res.month, 5);
      assert.equal(res.day, 8);
      assert.equal(res.isValid, true);
    });
  });

  describe("Full Bikram Sambat Year Range & Historical DOBs", () => {
    it("should validate historical adult birth years (e.g. 2035, 2045, 2055 BS)", () => {
      const dob1 = formatDateInput({
        raw: "2035/06/15",
        prevValue: "",
        isBS: true,
      });
      assert.equal(dob1.isValid, true);
      assert.equal(dob1.year, 2035);

      const dob2 = formatDateInput({
        raw: "2048/01/01",
        prevValue: "",
        isBS: true,
      });
      assert.equal(dob2.isValid, true);
      assert.equal(dob2.year, 2048);

      const dob3 = formatDateInput({
        raw: "2058/11/20",
        prevValue: "",
        isBS: true,
      });
      assert.equal(dob3.isValid, true);
      assert.equal(dob3.year, 2058);
    });

    it("should support BS boundaries 1976 BS to 2100 BS", () => {
      const minBS = formatDateInput({
        raw: "1976/01/01",
        prevValue: "",
        isBS: true,
      });
      assert.equal(minBS.isValid, true);
      assert.equal(minBS.year, 1976);

      const maxBS = formatDateInput({
        raw: "2100/01/15",
        prevValue: "",
        isBS: true,
      });
      assert.equal(maxBS.isValid, true);
      assert.equal(maxBS.year, 2100);

      // Pre-1976 should be invalid
      const preMin = formatDateInput({
        raw: "1975/12/30",
        prevValue: "",
        isBS: true,
      });
      assert.equal(preMin.isValid, false);

      // Post-2100 should be invalid
      const postMax = formatDateInput({
        raw: "2101/01/01",
        prevValue: "",
        isBS: true,
      });
      assert.equal(postMax.isValid, false);
    });
  });
});

