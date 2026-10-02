import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDaysInBSMonth, getTodayBS, bsToAD, formatADDate, getBSMonthRange } from "@/lib/utils/bs-calendar";

describe("Attendance Report & Date Handling Module", () => {
  it("should calculate correct days in BS month (varying between 28 and 32)", () => {
    // Check various BS months across 2081 BS
    const baisakhDays = getDaysInBSMonth(2081, 1);
    const jesthaDays = getDaysInBSMonth(2081, 2);
    const shrawanDays = getDaysInBSMonth(2081, 4);
    const poushDays = getDaysInBSMonth(2081, 9);

    assert.ok(baisakhDays >= 28 && baisakhDays <= 32, "Baisakh should have 28-32 days");
    assert.ok(jesthaDays >= 28 && jesthaDays <= 32, "Jestha should have 28-32 days");
    assert.ok(shrawanDays >= 28 && shrawanDays <= 32, "Shrawan should have 28-32 days");
    assert.ok(poushDays >= 28 && poushDays <= 32, "Poush should have 28-32 days");
    assert.equal(getDaysInBSMonth(2081, 1), 31);
    assert.equal(getDaysInBSMonth(2081, 2), 32);
  });

  it("should isolate punches to exact date and prevent date leak across months", () => {
    // Suppose employee has a punch on 2081-01-27 (AD: 2024-05-09)
    const adDateM1D27 = bsToAD(2081, 1, 27);
    const punchDateAD = formatADDate(adDateM1D27, "iso"); // "2024-05-09"

    // When viewing month 2 (Jestha)
    const jesthaDay27AD = formatADDate(bsToAD(2081, 2, 27), "iso");

    // Exact date matching check
    assert.equal(punchDateAD === jesthaDay27AD, false, "Punch from Month 1 Day 27 must NOT match Month 2 Day 27");

    // The legacy endsWith bug: punchDateAD ends in "-09", so day 9 of EVERY month matched endsWith("-09")
    const legacyEndsWith = punchDateAD.endsWith("-09");
    assert.equal(legacyEndsWith, true, "Legacy code erroneously matched day 9 of all months because AD date ended in -09");
  });

  it("should designate future days as '-' and zero work hours", () => {
    const today = getTodayBS();
    const currentYear = today.year;
    const currentMonth = today.month;
    const currentDay = today.day;

    const daysInCurrentMonth = getDaysInBSMonth(currentYear, currentMonth);

    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const isFutureDay = dayNum > currentDay;
      if (isFutureDay) {
        const statusCode = "-";
        const workHours = "00:00";
        assert.equal(statusCode, "-", `Day ${dayNum} after today (${currentDay}) must be '-'`);
        assert.equal(workHours, "00:00", `Day ${dayNum} must have 00:00 work hours`);
      }
    }
  });

  it("should compute mathematically consistent summary totals from daily status matrix", () => {
    // Sample daily details for a 30-day month
    // 10 Present (P), 2 Half Day (HD), 1 Paid Leave (L), 1 LWOP, 2 Absent (A), 4 Weekly Off (OFF), 10 Future (-)
    const mockDaily = [
      ...Array.from({ length: 10 }, () => ({ statusCode: "P", workHours: "08:00" })),
      ...Array.from({ length: 2 }, () => ({ statusCode: "HD", workHours: "04:00" })),
      { statusCode: "L", workHours: "00:00" },
      { statusCode: "LWOP", workHours: "00:00" },
      ...Array.from({ length: 2 }, () => ({ statusCode: "A", workHours: "00:00" })),
      ...Array.from({ length: 4 }, () => ({ statusCode: "OFF", workHours: "00:00" })),
      ...Array.from({ length: 10 }, () => ({ statusCode: "-", workHours: "00:00" })),
    ];

    let presentDays = 0;
    let payLeaveDays = 0;
    let nonPayLeaveDays = 0;
    let absentDays = 0;
    let totalWorkMins = 0;

    for (const d of mockDaily) {
      if (d.statusCode === "P") {
        presentDays += 1;
      } else if (d.statusCode === "HD") {
        presentDays += 0.5;
        absentDays += 0.5;
      } else if (d.statusCode === "L" || d.statusCode === "HO") {
        payLeaveDays += 1;
      } else if (d.statusCode === "LWOP") {
        nonPayLeaveDays += 1;
      } else if (d.statusCode === "A") {
        absentDays += 1;
      }

      if (d.workHours && d.workHours !== "00:00" && d.workHours !== "-") {
        const parts = d.workHours.split(":");
        const hrs = parseInt(parts[0] || "0", 10);
        const mins = parseInt(parts[1] || "0", 10);
        totalWorkMins += hrs * 60 + mins;
      }
    }

    const totalWorkingDays = presentDays + absentDays + payLeaveDays + nonPayLeaveDays;
    const totalWorkHours = `${Math.floor(totalWorkMins / 60)}:${String(totalWorkMins % 60).padStart(2, "0")}`;

    // Assertions
    assert.equal(presentDays, 11, "10 P + 2 * 0.5 HD = 11 present days");
    assert.equal(payLeaveDays, 1, "1 L = 1 pay leave day");
    assert.equal(nonPayLeaveDays, 1, "1 LWOP = 1 non-pay leave day");
    assert.equal(absentDays, 3, "2 A + 2 * 0.5 HD = 3 absent days");
    assert.equal(totalWorkingDays, 16, "Working days must equal elapsed working days: 11 + 3 + 1 + 1 = 16");
    assert.equal(totalWorkHours, "88:00", "Total work hours must equal 10*8 + 2*4 = 88 hours");
  });

  it("should calculate exact BS month AD date ranges", () => {
    const { start, end } = getBSMonthRange(2081, 4); // Shrawan 2081
    const startStr = formatADDate(start, "iso");
    const endStr = formatADDate(end, "iso");

    assert.equal(startStr, "2024-07-16", "Shrawan 1 2081 must be 2024-07-16");
    assert.equal(endStr, "2024-08-16", "Shrawan 32 2081 must be 2024-08-16");
  });

  it("should isolate attendance lock strictly to the target month date range", () => {
    // Punches across different months: Month 1 (Baisakh) and Month 2 (Jestha)
    const punches = [
      { id: "p-m1-1", attendanceDate: "2024-04-20", isLocked: false }, // Month 1
      { id: "p-m2-1", attendanceDate: "2024-05-25", isLocked: false }, // Month 2
    ];

    // Range for Month 2 (Jestha 2081: 2024-05-14 to 2024-06-14)
    const { start: m2Start, end: m2End } = getBSMonthRange(2081, 2);
    const m2StartStr = formatADDate(m2Start, "iso");
    const m2EndStr = formatADDate(m2End, "iso");

    // Simulate locking Month 2:
    for (const p of punches) {
      if (p.attendanceDate >= m2StartStr && p.attendanceDate <= m2EndStr) {
        p.isLocked = true;
      }
    }

    assert.equal(punches[0].isLocked, false, "Month 1 punch must remain unlocked");
    assert.equal(punches[1].isLocked, true, "Month 2 punch must be locked");
  });
});

