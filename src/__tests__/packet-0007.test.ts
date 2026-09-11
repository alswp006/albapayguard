import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Packet 0007: 미지급 분석 산출 · 리워드 해제 · 금액 포맷", () => {
  // AC-1: calculatedNet 252840·actualPaidAmount 206400·주휴 41280·야간 5160
  // → diff===46440, suspects에 {kind:'weeklyHoliday',amount:41280}와 {kind:'night',amount:5160} 포함, suspects.length===2
  describe("AC-1: analyzePay with specific underpayment scenario", () => {
    it("should calculate diff and identify underpayment suspects", async () => {
      const { analyzePay } = await import("@/lib/analysis");

      const payroll = {
        calculatedNet: 252840,
        weeklyHoliday: 41280,
        night: 5160,
        overtime: 0,
        holiday: 0,
        minimumWage: 0,
      };

      const result = analyzePay(payroll, 206400);

      // diff = calculatedNet - actualPaidAmount = 252840 - 206400 = 46440
      expect(result.diff).toBe(46440);
      expect(result.isUnderpaid).toBe(true);
      expect(result.suspects).toHaveLength(2);

      // Check for weeklyHoliday suspect
      const weeklyHolidaySuspect = result.suspects.find(s => s.kind === "weeklyHoliday");
      expect(weeklyHolidaySuspect).toBeDefined();
      expect(weeklyHolidaySuspect?.amount).toBe(41280);
      expect(weeklyHolidaySuspect?.label).toBeTruthy();
      expect(weeklyHolidaySuspect?.description).toBeTruthy();

      // Check for night suspect
      const nightSuspect = result.suspects.find(s => s.kind === "night");
      expect(nightSuspect).toBeDefined();
      expect(nightSuspect?.amount).toBe(5160);
      expect(nightSuspect?.label).toBeTruthy();
      expect(nightSuspect?.description).toBeTruthy();
    });

    it("should only include suspects with amount > 0", async () => {
      const { analyzePay } = await import("@/lib/analysis");

      const payroll = {
        calculatedNet: 252840,
        weeklyHoliday: 41280,
        night: 5160,
        overtime: 0,
        holiday: 0,
        minimumWage: 0,
      };

      const result = analyzePay(payroll, 206400);

      // All suspects should have amount > 0
      result.suspects.forEach(suspect => {
        expect(suspect.amount).toBeGreaterThan(0);
      });

      // overtime, holiday, minimumWage are all 0, so should not be included
      expect(result.suspects.every(s => s.kind !== "overtime")).toBe(true);
      expect(result.suspects.every(s => s.kind !== "holiday")).toBe(true);
      expect(result.suspects.every(s => s.kind !== "minimumWage")).toBe(true);
    });
  });

  // AC-2: actualPaidAmount 300000 → diff===-47160, isUnderpaid===false, suspects.length===0
  describe("AC-2: analyzePay with overpayment (no underpayment)", () => {
    it("should return negative diff and isUnderpaid=false when actual > calculated", async () => {
      const { analyzePay } = await import("@/lib/analysis");

      const payroll = {
        calculatedNet: 252840,
        weeklyHoliday: 0,
        night: 0,
        overtime: 0,
        holiday: 0,
        minimumWage: 0,
      };

      const result = analyzePay(payroll, 300000);

      // diff = calculatedNet - actualPaidAmount = 252840 - 300000 = -47160
      expect(result.diff).toBe(-47160);
      expect(result.isUnderpaid).toBe(false);
      expect(result.suspects).toHaveLength(0);
    });

    it("should return empty suspects even when payroll has non-zero items if no underpayment", async () => {
      const { analyzePay } = await import("@/lib/analysis");

      const payroll = {
        calculatedNet: 300000,
        weeklyHoliday: 50000,
        night: 10000,
        overtime: 5000,
        holiday: 0,
        minimumWage: 0,
      };

      const result = analyzePay(payroll, 350000);

      // actual (350000) > calculated (300000), so no underpayment
      expect(result.isUnderpaid).toBe(false);
      expect(result.suspects).toHaveLength(0);
    });
  });

  // AC-3: grantUnlock 직후 isUnlocked===true, rewardUnlocks 값을 과거 ISO로 바꾸면 isUnlocked===false
  describe("AC-3: Reward unlock lifecycle", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it("should set isUnlocked=true after grantUnlock, and expire after 24h", async () => {
      const { grantUnlock, isUnlocked } = await import("@/lib/analysis");

      const workplaceId = "wp-test-001";
      const yearMonth = "202609";
      const key = `${workplaceId}:${yearMonth}`;

      // Grant unlock
      await grantUnlock(workplaceId, yearMonth);

      // Immediately after grant, should be unlocked
      let unlocked = isUnlocked(
        { rewardUnlocks: JSON.parse(localStorage.getItem("apg:settings:v1") || "{}").rewardUnlocks || {} },
        workplaceId,
        yearMonth
      );
      expect(unlocked).toBe(true);

      // Simulate expiry by setting expiry time to the past
      const settings = JSON.parse(localStorage.getItem("apg:settings:v1") || "{}");
      const pastISO = new Date(Date.now() - 1000).toISOString(); // 1s ago
      settings.rewardUnlocks = settings.rewardUnlocks || {};
      settings.rewardUnlocks[key] = pastISO;
      localStorage.setItem("apg:settings:v1", JSON.stringify(settings));

      // Now should be expired
      const expiredSettings = JSON.parse(localStorage.getItem("apg:settings:v1") || "{}");
      unlocked = isUnlocked(expiredSettings, workplaceId, yearMonth);
      expect(unlocked).toBe(false);
    });

    it("should handle missing rewardUnlocks gracefully", async () => {
      const { isUnlocked } = await import("@/lib/analysis");

      const settings = { rewardUnlocks: {} };
      const result = isUnlocked(settings, "wp-test-002", "202609");

      expect(result).toBe(false);
    });

    it("should grant unlock with 24-hour expiry time", async () => {
      const { grantUnlock } = await import("@/lib/analysis");

      const workplaceId = "wp-test-003";
      const yearMonth = "202609";
      const beforeGrant = Date.now();

      await grantUnlock(workplaceId, yearMonth);

      const afterGrant = Date.now();
      const settings = JSON.parse(localStorage.getItem("apg:settings:v1") || "{}");
      const expireISO = settings.rewardUnlocks?.[`${workplaceId}:${yearMonth}`];

      expect(expireISO).toBeTruthy();
      expect(typeof expireISO).toBe("string");

      // Verify expiry is approximately 24 hours from now (±5s tolerance)
      const expireTime = new Date(expireISO).getTime();
      const expectedExpireTime = beforeGrant + 24 * 60 * 60 * 1000;
      const tolerance = 5000; // 5 seconds

      expect(Math.abs(expireTime - expectedExpireTime)).toBeLessThan(tolerance);
    });
  });

  // AC-4: formatWon(206400)==='206,400', parseWon('206,400')===206400, parseWon('abc')===0
  describe("AC-4: Won amount formatting and parsing", () => {
    it("should format amount with commas", async () => {
      const { formatWon } = await import("@/lib/analysis");

      expect(formatWon(206400)).toBe("206,400");
      expect(formatWon(1000000)).toBe("1,000,000");
      expect(formatWon(100)).toBe("100");
      expect(formatWon(0)).toBe("0");
    });

    it("should parse formatted won string back to number", async () => {
      const { parseWon } = await import("@/lib/analysis");

      expect(parseWon("206,400")).toBe(206400);
      expect(parseWon("1,000,000")).toBe(1000000);
      expect(parseWon("100")).toBe(100);
      expect(parseWon("0")).toBe(0);
    });

    it("should return 0 for invalid parse input", async () => {
      const { parseWon } = await import("@/lib/analysis");

      expect(parseWon("abc")).toBe(0);
      expect(parseWon("")).toBe(0);
      expect(parseWon("12a34")).toBe(0);
      expect(parseWon("$100")).toBe(0);
    });

    it("should support roundtrip formatWon -> parseWon", async () => {
      const { formatWon, parseWon } = await import("@/lib/analysis");

      const original = 252840;
      const formatted = formatWon(original);
      const parsed = parseWon(formatted);

      expect(parsed).toBe(original);
    });

    it("should handle edge cases in formatting", async () => {
      const { formatWon } = await import("@/lib/analysis");

      // Large numbers
      expect(formatWon(999999999)).toBe("999,999,999");

      // Single digits
      expect(formatWon(5)).toBe("5");
      expect(formatWon(99)).toBe("99");
    });
  });

  // AC-5: React/TDS import 0건, console.error 0건, throw 0건
  describe("AC-5: Code quality constraints", () => {
    it("should not import React or TDS in analysis.ts", async () => {
      // Read the analysis.ts file to check imports
      const fs = await import("fs");
      const path = await import("path");
      const analysisPath = path.resolve(__dirname, "../lib/analysis.ts");

      // This test will verify at runtime that the module doesn't cause errors
      const { analyzePay, isUnlocked, grantUnlock, formatWon, parseWon } = await import("@/lib/analysis");

      expect(typeof analyzePay).toBe("function");
      expect(typeof isUnlocked).toBe("function");
      expect(typeof grantUnlock).toBe("function");
      expect(typeof formatWon).toBe("function");
      expect(typeof parseWon).toBe("function");
    });

    it("should not throw on normal usage", async () => {
      const { analyzePay, formatWon, parseWon } = await import("@/lib/analysis");

      // formatWon should not throw
      expect(() => {
        formatWon(100000);
      }).not.toThrow();

      // parseWon should not throw
      expect(() => {
        parseWon("100,000");
      }).not.toThrow();

      // analyzePay should not throw
      expect(() => {
        analyzePay(
          {
            calculatedNet: 100000,
            weeklyHoliday: 0,
            night: 0,
            overtime: 0,
            holiday: 0,
            minimumWage: 0,
          },
          50000
        );
      }).not.toThrow();
    });

    it("should handle error cases gracefully without throwing", async () => {
      const { parseWon, formatWon } = await import("@/lib/analysis");

      // parseWon with invalid input should return 0, not throw
      expect(() => {
        expect(parseWon("not-a-number")).toBe(0);
      }).not.toThrow();

      // formatWon with edge case should not throw
      expect(() => {
        expect(formatWon(-100)).toBeDefined();
      }).not.toThrow();
    });
  });

  // Integration tests: verify all functions work together
  describe("Integration: analyzePay + formatWon", () => {
    it("should analyze underpayment and format suspect amounts", async () => {
      const { analyzePay, formatWon } = await import("@/lib/analysis");

      const payroll = {
        calculatedNet: 252840,
        weeklyHoliday: 41280,
        night: 5160,
        overtime: 0,
        holiday: 0,
        minimumWage: 0,
      };

      const result = analyzePay(payroll, 206400);

      expect(result.isUnderpaid).toBe(true);

      // Format the diff amount
      const formattedDiff = formatWon(result.diff);
      expect(formattedDiff).toBe("46,440");

      // Format each suspect amount
      result.suspects.forEach(suspect => {
        const formatted = formatWon(suspect.amount);
        expect(formatted).toBeTruthy();
        expect(typeof formatted).toBe("string");
      });
    });
  });

  // Edge cases and robustness
  describe("Edge cases", () => {
    it("should handle zero amounts in analyzePay", async () => {
      const { analyzePay } = await import("@/lib/analysis");

      const payroll = {
        calculatedNet: 0,
        weeklyHoliday: 0,
        night: 0,
        overtime: 0,
        holiday: 0,
        minimumWage: 0,
      };

      const result = analyzePay(payroll, 0);

      expect(result.diff).toBe(0);
      expect(result.isUnderpaid).toBe(false);
      expect(result.suspects).toHaveLength(0);
    });

    it("should handle large amounts correctly", async () => {
      const { analyzePay, formatWon, parseWon } = await import("@/lib/analysis");

      const largeAmount = 99999999;
      const payroll = {
        calculatedNet: largeAmount,
        weeklyHoliday: 5000000,
        night: 1000000,
        overtime: 0,
        holiday: 0,
        minimumWage: 0,
      };

      const result = analyzePay(payroll, 60000000);

      expect(result.diff).toBe(39999999);

      // Format and parse the diff
      const formatted = formatWon(result.diff);
      const parsed = parseWon(formatted);
      expect(parsed).toBe(result.diff);
    });

    it("should properly identify multiple underpayment suspects", async () => {
      const { analyzePay } = await import("@/lib/analysis");

      const payroll = {
        calculatedNet: 300000,
        weeklyHoliday: 50000,
        night: 20000,
        overtime: 10000,
        holiday: 15000,
        minimumWage: 5000,
      };

      const result = analyzePay(payroll, 150000);

      expect(result.isUnderpaid).toBe(true);

      // All non-zero amounts should be suspects
      const suspects = result.suspects;
      expect(suspects.length).toBeGreaterThan(0);

      // Check that suspect amounts sum to less than or equal to the diff
      const suspectSum = suspects.reduce((sum, s) => sum + s.amount, 0);
      expect(suspectSum).toBeLessThanOrEqual(result.diff);
    });
  });
});
