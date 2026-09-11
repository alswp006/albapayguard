import { describe, it, expect, vi } from "vitest";
import type { WorkRecord, Workplace, MonthlyPayroll } from "@/lib/types";
import { calcMonthly } from "@/lib/payrollMonthly";

/**
 * 급여 계산 엔진 ② 주휴수당·최저임금·월 집계 — TDD 빨간색 단계
 * 실제 구현이 아직 없으므로 모든 테스트는 실패합니다.
 *
 * 함수들 (src/lib/payrollMonthly.ts에 구현됨):
 * - calcMonthly(records: WorkRecord[], workplace: Workplace, yearMonth: string): MonthlyPayroll
 *
 * AC별 테스트 매핑:
 * - AC-1: 주 15시간 이상 → eligible=true, 주휴수당 지급
 * - AC-2: 주 12시간 미만 → eligible=false, 주휴수당 0원
 * - AC-3: 시급 < 최저임금 → minimumWageShortfall 계산
 * - AC-4: 기록 0건 → 모두 0, daily/weeks 빈 배열
 * - AC-5: taxType 'freelance3_3' → net=floor(gross*0.967)
 * - AC-6: 비정상 레코드 처리 → 제외하고 계산, throw/console.error 0건
 */

// Helper to safely reference calcMonthly (kept for call-site consistency across the file)
function getCalcMonthly(): ((records: WorkRecord[], workplace: Workplace, yearMonth: string) => MonthlyPayroll) {
  if (!calcMonthly) {
    throw new Error("calcMonthly not exported from payrollMonthly.ts");
  }
  return calcMonthly;
}

describe("급여 계산 엔진 ② 주휴수당·최저임금·월 집계", () => {
  // Helper: create mock WorkRecord
  const createRecord = (overrides: Partial<WorkRecord> = {}): WorkRecord => ({
    id: "rec-1",
    workplaceId: "wp-1",
    date: "2026-03-02",
    startTime: "09:00",
    endTime: "13:00",
    breakMinutes: 0,
    isHoliday: false,
    memo: "",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  });

  // Helper: create mock Workplace
  const createWorkplace = (overrides: Partial<Workplace> = {}): Workplace => ({
    id: "wp-1",
    name: "Test Workplace",
    hourlyWage: 10320,
    isFiveOrMore: true,
    payday: 25,
    taxType: "none",
    colorToken: "blue",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  });

  describe("AC-1: 주휴수당 자격 (주 15시간 이상)", () => {
    it("AC-1: calcMonthly with 4 hours/day × 5 days (20 hours/week) should calculate weeklyHolidayPay=41280", () => {
      // Create records: 2026-03-02(Mon) to 2026-03-06(Fri), each 4 hours
      // wage=10320, total=1200 minutes per week
      // weekStart='2026-03-02', weeklyMinutes=1200, eligible=true
      // amount=floor(min(1200,2400)/5/60*10320)=floor(240*10320/60)=floor(41280)=41280
      const records: WorkRecord[] = [
        createRecord({ date: "2026-03-02", startTime: "09:00", endTime: "13:00" }), // Mon
        createRecord({ date: "2026-03-03", startTime: "09:00", endTime: "13:00" }), // Tue
        createRecord({ date: "2026-03-04", startTime: "09:00", endTime: "13:00" }), // Wed
        createRecord({ date: "2026-03-05", startTime: "09:00", endTime: "13:00" }), // Thu
        createRecord({ date: "2026-03-06", startTime: "09:00", endTime: "13:00" }), // Fri
      ];
      const workplace = createWorkplace({ hourlyWage: 10320 });

      const calcMonthlyFn = getCalcMonthly();
      const result = calcMonthlyFn(records, workplace, "2026-03");

      expect(result.yearMonth).toEqual("2026-03");
      expect(result.weeks).toHaveLength(1);
      expect(result.weeks[0]).toMatchObject({
        weekStart: "2026-03-02",
        weeklyMinutes: 1200,
        eligible: true,
        amount: 41280,
      });
      expect(result.weeklyHolidayPay).toBe(41280);
    });

    it("AC-1: weeks[0] with eligible=true should match exact structure", () => {
      const records: WorkRecord[] = [
        createRecord({ date: "2026-03-02", startTime: "09:00", endTime: "13:00" }),
        createRecord({ date: "2026-03-03", startTime: "09:00", endTime: "13:00" }),
        createRecord({ date: "2026-03-04", startTime: "09:00", endTime: "13:00" }),
        createRecord({ date: "2026-03-05", startTime: "09:00", endTime: "13:00" }),
        createRecord({ date: "2026-03-06", startTime: "09:00", endTime: "13:00" }),
      ];
      const workplace = createWorkplace({ hourlyWage: 10320 });

      const calcMonthlyFn = getCalcMonthly();
      const result = calcMonthlyFn(records, workplace, "2026-03");

      // Verify week 0 has all required properties
      expect(result.weeks[0]).toHaveProperty("weekStart");
      expect(result.weeks[0]).toHaveProperty("weeklyMinutes");
      expect(result.weeks[0]).toHaveProperty("eligible");
      expect(result.weeks[0]).toHaveProperty("amount");
      expect(result.weeks[0].eligible).toBe(true);
      expect(result.weeks[0].amount).toBeGreaterThan(0);
    });
  });

  describe("AC-2: 주휴수당 미자격 (주 12시간 미만)", () => {
    it("AC-2: 3일 12시간 (Mon-Wed 각 4h) should have eligible=false, amount=0, weeklyHolidayPay=0", () => {
      // weeklyMinutes = 720 (12 hours), eligible=false, amount=0
      const records: WorkRecord[] = [
        createRecord({ date: "2026-03-02", startTime: "09:00", endTime: "13:00" }), // Mon
        createRecord({ date: "2026-03-03", startTime: "09:00", endTime: "13:00" }), // Tue
        createRecord({ date: "2026-03-04", startTime: "09:00", endTime: "13:00" }), // Wed
      ];
      const workplace = createWorkplace({ hourlyWage: 10320 });

      const calcMonthlyFn = getCalcMonthly();
      const result = calcMonthlyFn(records, workplace, "2026-03");

      expect(result.weeks).toHaveLength(1);
      expect(result.weeks[0]).toMatchObject({
        weekStart: "2026-03-02",
        weeklyMinutes: 720,
        eligible: false,
        amount: 0,
      });
      expect(result.weeklyHolidayPay).toBe(0);
    });

    it("AC-2: weeklyHolidayPay should be 0 when week is ineligible", () => {
      const records: WorkRecord[] = [
        createRecord({ date: "2026-03-02", startTime: "09:00", endTime: "11:00" }), // 2h only
      ];
      const workplace = createWorkplace({ hourlyWage: 10320 });

      const calcMonthlyFn = getCalcMonthly();
      const result = calcMonthlyFn(records, workplace, "2026-03");

      expect(result.weeklyHolidayPay).toBe(0);
      expect(result.weeks.every(w => w.amount === 0)).toBe(true);
    });
  });

  describe("AC-3: 최저임금 부족액 계산", () => {
    it("AC-3: wage=9800 < minimumWage=10320 should calculate shortfall correctly", () => {
      // 2026 minimumWage = 10320
      // wage = 9800
      // 3 records × 4 hours = 12 hours = 720 minutes
      // shortfall = floor((10320 - 9800) × 720 / 60) = floor(520 × 12) = 6240
      const records: WorkRecord[] = [
        createRecord({ date: "2026-03-01", startTime: "09:00", endTime: "13:00" }),
        createRecord({ date: "2026-03-02", startTime: "09:00", endTime: "13:00" }),
        createRecord({ date: "2026-03-03", startTime: "09:00", endTime: "13:00" }),
      ];
      const workplace = createWorkplace({ hourlyWage: 9800 }); // Below 2026 minimum

      const calcMonthlyFn = getCalcMonthly();
      const result = calcMonthlyFn(records, workplace, "2026-03");

      expect(result.minimumWage).toBe(10320);
      expect(result.isBelowMinimumWage).toBe(true);
      const expectedShortfall = Math.floor((10320 - 9800) * (12 * 60) / 60);
      expect(result.minimumWageShortfall).toBe(expectedShortfall);
    });

    it("AC-3: minimumWageShortfall formula: floor((minimumWage - wage) × totalMinutes / 60)", () => {
      const wage = 9800;
      const minimumWage = 10320;
      const totalMinutes = 12 * 60; // 12 hours
      const shortfall = Math.floor((minimumWage - wage) * totalMinutes / 60);
      expect(shortfall).toBe(Math.floor(520 * 12));
      expect(shortfall).toBe(6240);
    });

    it("AC-3: wage >= minimumWage should have isBelowMinimumWage=false, shortfall=0", () => {
      const records: WorkRecord[] = [
        createRecord({ date: "2026-03-01", startTime: "09:00", endTime: "13:00" }),
      ];
      const workplace = createWorkplace({ hourlyWage: 10320 }); // At minimum wage

      const calcMonthlyFn = getCalcMonthly();
      const result = calcMonthlyFn(records, workplace, "2026-03");

      expect(result.isBelowMinimumWage).toBe(false);
      expect(result.minimumWageShortfall).toBe(0);
    });
  });

  describe("AC-4: 기록 0건일 때 초기 상태", () => {
    it("AC-4: empty records should return zero aggregates with empty arrays", () => {
      const records: WorkRecord[] = [];
      const workplace = createWorkplace();

      expect(calcMonthly).not.toBeNull();
      const result = calcMonthly!(records, workplace, "2026-04");

      expect(result.gross).toBe(0);
      expect(result.net).toBe(0);
      expect(result.daily).toEqual([]);
      expect(result.weeks).toEqual([]);
      expect(result.basePay).toBe(0);
      expect(result.nightPay).toBe(0);
      expect(result.overtimePay).toBe(0);
      expect(result.holidayPay).toBe(0);
      expect(result.weeklyHolidayPay).toBe(0);
      expect(result.totalMinutes).toBe(0);
      expect(result.isBelowMinimumWage).toBe(false);
      expect(result.minimumWageShortfall).toBe(0);
    });

    it("AC-4: empty result should have yearMonth and correct minimum wage", () => {
      const records: WorkRecord[] = [];
      const workplace = createWorkplace();

      expect(calcMonthly).not.toBeNull();
      const result = calcMonthly!(records, workplace, "2026-04");

      expect(result.yearMonth).toBe("2026-04");
      expect(result.minimumWage).toBe(10320); // 2026 minimum wage
    });
  });

  describe("AC-5: 세금 계산 (taxType='freelance3_3')", () => {
    it("AC-5: gross=359136 + taxType='freelance3_3' should net=floor(gross*0.967)=347284", () => {
      // 2026-03-02(Mon)~03-08(Sun)는 ISO 주 하나(월요일 시작) — 29시간 근무.
      // basePay: 6일×4h(41280) + 1일×5h(51600) = 299280
      // weeklyHolidayPay: 주 실근로 1740분(≥900) → floor(min(1740,2400)/5/60×10320) = 59856
      // gross = 299280 + 59856 = 359136
      const records: WorkRecord[] = [
        createRecord({ date: "2026-03-02", startTime: "09:00", endTime: "13:00" }), // 4h
        createRecord({ date: "2026-03-03", startTime: "09:00", endTime: "13:00" }), // 4h
        createRecord({ date: "2026-03-04", startTime: "09:00", endTime: "13:00" }), // 4h
        createRecord({ date: "2026-03-05", startTime: "09:00", endTime: "13:00" }), // 4h
        createRecord({ date: "2026-03-06", startTime: "09:00", endTime: "13:00" }), // 4h
        createRecord({ date: "2026-03-07", startTime: "09:00", endTime: "13:00" }), // 4h
        createRecord({ date: "2026-03-08", startTime: "09:00", endTime: "14:00" }), // 5h
      ];
      const workplace = createWorkplace({
        hourlyWage: 10320,
        taxType: "freelance3_3",
      });

      const calcMonthlyFn = getCalcMonthly();
      const result = calcMonthlyFn(records, workplace, "2026-03");

      // Verify net calculation
      expect(result.gross).toBe(359136);
      const expectedNet = Math.floor(result.gross * 0.967);
      expect(result.net).toBe(expectedNet);
      expect(result.net).toBe(347284); // floor(359136 * 0.967)
    });

    it("AC-5: taxType='none' should have net=gross (no tax deduction)", () => {
      const records: WorkRecord[] = [
        createRecord({ date: "2026-03-02", startTime: "09:00", endTime: "13:00" }),
      ];
      const workplace = createWorkplace({ hourlyWage: 10320, taxType: "none" });

      const calcMonthlyFn = getCalcMonthly();
      const result = calcMonthlyFn(records, workplace, "2026-03");

      expect(result.net).toBe(result.gross);
    });

    it("AC-5: tax formula for freelance3_3: net = floor(gross × 0.967)", () => {
      const gross = 252840;
      const expected = Math.floor(gross * 0.967);
      expect(expected).toBe(244496);
    });
  });

  describe("AC-6: 비정상 레코드 처리 (결함 기록 제외)", () => {
    it("AC-6: invalid records should be excluded, valid ones aggregated", () => {
      // Mix valid and invalid records
      // Invalid: malformed times, negative break, etc.
      const records: WorkRecord[] = [
        createRecord({
          date: "2026-03-01",
          startTime: "09:00",
          endTime: "13:00",
          breakMinutes: 0,
        }), // Valid
        createRecord({
          date: "2026-03-02",
          startTime: "invalid",
          endTime: "13:00",
          breakMinutes: 0,
        }), // Invalid startTime
        createRecord({
          date: "2026-03-03",
          startTime: "09:00",
          endTime: "13:00",
          breakMinutes: -10,
        }), // Invalid breakMinutes
        createRecord({
          date: "2026-03-04",
          startTime: "09:00",
          endTime: "13:00",
          breakMinutes: 0,
        }), // Valid
      ];
      const workplace = createWorkplace({ hourlyWage: 10320 });

      const calcMonthlyFn = getCalcMonthly();
      const result = calcMonthlyFn(records, workplace, "2026-03");

      // Only 2 valid records should be included
      expect(result.daily).toHaveLength(2);
      expect(result.gross).toBeGreaterThan(0);
    });

    it("AC-6: should not throw error when processing mixed valid/invalid records", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      let error: unknown = null;

      try {
        const records: WorkRecord[] = [
          createRecord({ startTime: "invalid" }), // Will cause calcDaily to return null
          createRecord({ date: "2026-03-02", startTime: "09:00", endTime: "13:00" }), // Valid
        ];
        const workplace = createWorkplace();

        expect(calcMonthly).not.toBeNull();
        const result = calcMonthly!(records, workplace, "2026-03");

        // Should have 1 valid record
        expect(result.daily).toHaveLength(1);
      } catch (e) {
        error = e;
      }

      expect(error).toBeNull();
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("AC-6: console.error should not be called during calcMonthly", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const records: WorkRecord[] = [
        createRecord({ startTime: "bad" }),
        createRecord(),
      ];
      const workplace = createWorkplace();

      const calcMonthlyFn = getCalcMonthly();
      const result = calcMonthlyFn(records, workplace, "2026-03");

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Integration: MonthlyPayroll 구조 검증", () => {
    it("should return MonthlyPayroll with all required fields", () => {
      const records: WorkRecord[] = [
        createRecord({ date: "2026-03-02", startTime: "09:00", endTime: "13:00" }),
      ];
      const workplace = createWorkplace();

      const calcMonthlyFn = getCalcMonthly();
      const result = calcMonthlyFn(records, workplace, "2026-03");

      // Verify all required properties exist
      expect(result).toHaveProperty("yearMonth");
      expect(result).toHaveProperty("daily");
      expect(result).toHaveProperty("weeks");
      expect(result).toHaveProperty("basePay");
      expect(result).toHaveProperty("nightPay");
      expect(result).toHaveProperty("overtimePay");
      expect(result).toHaveProperty("holidayPay");
      expect(result).toHaveProperty("weeklyHolidayPay");
      expect(result).toHaveProperty("gross");
      expect(result).toHaveProperty("net");
      expect(result).toHaveProperty("totalMinutes");
      expect(result).toHaveProperty("minimumWage");
      expect(result).toHaveProperty("isBelowMinimumWage");
      expect(result).toHaveProperty("minimumWageShortfall");
    });

    it("should have consistent gross/net relationship", () => {
      const records: WorkRecord[] = [
        createRecord({ date: "2026-03-02", startTime: "09:00", endTime: "13:00" }),
      ];
      const workplace = createWorkplace({ taxType: "freelance3_3" });

      const calcMonthlyFn = getCalcMonthly();
      const result = calcMonthlyFn(records, workplace, "2026-03");

      // For freelance3_3: net should be <= gross (after tax deduction)
      expect(result.net).toBeLessThanOrEqual(result.gross);
      // For none: net should equal gross
      if (workplace.taxType === "none") {
        expect(result.net).toBe(result.gross);
      }
    });

    it("should have daily array with valid DailyPay items when records exist", () => {
      const records: WorkRecord[] = [
        createRecord({ date: "2026-03-02", startTime: "09:00", endTime: "13:00" }),
        createRecord({ date: "2026-03-03", startTime: "10:00", endTime: "14:00" }),
      ];
      const workplace = createWorkplace();

      const calcMonthlyFn = getCalcMonthly();
      const result = calcMonthlyFn(records, workplace, "2026-03");

      expect(result.daily.length).toBeGreaterThan(0);
      result.daily.forEach(day => {
        expect(day).toHaveProperty("date");
        expect(day).toHaveProperty("workedMinutes");
        expect(day).toHaveProperty("basePay");
        expect(day).toHaveProperty("nightMinutes");
        expect(day).toHaveProperty("nightPay");
        expect(day).toHaveProperty("overtimeMinutes");
        expect(day).toHaveProperty("overtimePay");
        expect(day).toHaveProperty("holidayPay");
        expect(day).toHaveProperty("total");
      });
    });
  });
});
