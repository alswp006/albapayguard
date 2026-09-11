/**
 * 급여 상세 페이지 `/breakdown` (packet 0011)
 *
 * 이 테스트가 강제하는 Breakdown.tsx 계약(testId/aria):
 * - data-testid="breakdown-item-base"          → ListRow, 기본급
 * - data-testid="breakdown-item-night"         → ListRow, 야간가산
 * - data-testid="breakdown-item-overtime"      → ListRow, 연장가산
 * - data-testid="breakdown-item-holiday"       → ListRow, 휴일가산
 * - data-testid="breakdown-item-weeklyHoliday" → ListRow, 주휴수당
 * - data-testid="breakdown-item-tax"           → ListRow, 세금공제
 * - data-testid="breakdown-item-net"           → ListRow, 실수령액
 *   → 각 ListRow의 textContent에 `${formatNumber(amount)}원`이 포함된다.
 *   → 문서 순서(DOM order)가 위 나열 순서(기본급→야간→연장→휴일→주휴→세금→실수령액)와 같다.
 * - data-testid="breakdown-minwage-warning"    → 최저임금 미달 경고 Card
 *   ("최저임금보다 낮아요" + `${formatNumber(shortfall)}원` 포함). 미달 아니면 렌더 안 함(queryBy null).
 * - data-testid="breakdown-five-note-night" / "-overtime" / "-holiday"
 *   → 5인 미만 사업장일 때만 각 항목 옆/안에 렌더되는 보조문구("5인 미만 사업장은 가산수당 의무가 없어요" 포함)
 * - data-testid={`breakdown-week-${weekStart}`} → 주차별 판정 목록의 각 행 (주 근로시간·주휴 지급여부 텍스트 포함)
 * - data-testid="breakdown-attendance-note"    → 개근 요건 한계 보조 텍스트("개근" 포함)
 * - data-testid="breakdown-disclaimer"         → 법적 효력 고지, 정확히
 *   "법정 기준 자동 계산 결과이며 법적 효력이 없습니다"
 * - 기록이 하나도 없으면 EmptyState + role="button" name="기록 추가하기"
 *
 * useAppData/useMonthlyPayroll(@/hooks/useAppData)을 시나리오 기반으로 mock하되,
 * calcMonthly는 실제 구현을 그대로 사용해(mock 안 함) 화면에 표시될 기대값을 계산한다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Workplace, WorkRecord } from "@/lib/types";
import { calcMonthly } from "@/lib/payrollMonthly";
import { formatNumber } from "@/lib/utils";

import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
mockTds();
mockAppsInToss();

// ── react-router-dom: MemoryRouter 실 구현 유지, useNavigate만 대체 ──
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// ── @/hooks/useAppData — 시나리오 기반 mock. calcMonthly는 실제 구현 사용 ──
const scenario = {
  workplaces: [] as Workplace[],
  records: [] as WorkRecord[],
  activeWorkplaceId: null as string | null,
};

vi.mock("@/hooks/useAppData", () => ({
  useAppData: () => ({
    loading: false,
    workplaces: scenario.workplaces,
    records: scenario.records,
    payChecks: [],
    settings: {
      onboardingSeenAt: "2026-01-01T00:00:00.000Z",
      disclaimerAckAt: "2026-01-01T00:00:00.000Z",
      activeWorkplaceId: scenario.activeWorkplaceId,
      rewardUnlocks: {},
      schemaVersion: 1,
    },
    addWorkplace: vi.fn(),
    editWorkplace: vi.fn(),
    removeWorkplace: vi.fn(),
    addRecord: vi.fn(),
    editRecord: vi.fn(),
    removeRecord: vi.fn(),
    savePayCheck: vi.fn(),
    setActiveWorkplace: vi.fn(),
    patchSettings: vi.fn(),
  }),
  useMonthlyPayroll: (workplaceId: string | null, yearMonth: string) => {
    const workplace = scenario.workplaces.find((w) => w.id === workplaceId);
    if (!workplace) return null;
    const records = scenario.records.filter((r) => r.workplaceId === workplaceId);
    return calcMonthly(records, workplace, yearMonth);
  },
}));

import Breakdown from "@/pages/Breakdown";

function renderBreakdown(state?: { workplaceId: string; yearMonth?: string }) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [state ? { pathname: "/breakdown", state } : "/breakdown"] },
      React.createElement(Breakdown)
    )
  );
}

// 5인 이상·프리랜서 3.3% 원천징수 — 야간/연장/주휴 전부 발생 + 세금공제 확인용
const WP_FIVE: Workplace = {
  id: "wp-five",
  name: "카페 알바",
  hourlyWage: 10000, // 2026년 최저임금(10,320원) 미만 → 경고 대상
  isFiveOrMore: true,
  payday: 25,
  taxType: "freelance3_3",
  colorToken: "blue",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// 최저임금 이상 — 경고 없음 확인용
const WP_HIGH: Workplace = {
  id: "wp-high",
  name: "편의점",
  hourlyWage: 12000,
  isFiveOrMore: true,
  payday: 10,
  taxType: "none",
  colorToken: "green",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// 5인 미만 — 가산수당 의무 없음 확인용
const WP_UNDER5: Workplace = {
  id: "wp-under5",
  name: "동네 서점",
  hourlyWage: 11000,
  isFiveOrMore: false,
  payday: 5,
  taxType: "none",
  colorToken: "purple",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function rec(overrides: Partial<WorkRecord> & Pick<WorkRecord, "id" | "workplaceId" | "date" | "startTime" | "endTime">): WorkRecord {
  return {
    breakMinutes: 0,
    isHoliday: false,
    memo: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// 2026-02 = 월요일 시작 주: 2/2(월)~2/8, 2/9(월)~2/15
const RECORDS_FIVE: WorkRecord[] = [
  // 1주차(2/2~2/8): 09-19(휴게60→540분) + 22-02(야간240분) = 주 780분 < 900분 → 주휴 미지급
  rec({ id: "r-1", workplaceId: "wp-five", date: "2026-02-02", startTime: "09:00", endTime: "19:00", breakMinutes: 60 }),
  rec({ id: "r-2", workplaceId: "wp-five", date: "2026-02-03", startTime: "22:00", endTime: "02:00", breakMinutes: 0 }),
  // 2주차(2/9~2/15): 09-19(휴게60) x3 = 주 1620분 ≥ 900분 → 주휴 지급
  rec({ id: "r-3", workplaceId: "wp-five", date: "2026-02-09", startTime: "09:00", endTime: "19:00", breakMinutes: 60 }),
  rec({ id: "r-4", workplaceId: "wp-five", date: "2026-02-10", startTime: "09:00", endTime: "19:00", breakMinutes: 60 }),
  rec({ id: "r-5", workplaceId: "wp-five", date: "2026-02-11", startTime: "09:00", endTime: "19:00", breakMinutes: 60 }),
];

const RECORDS_HIGH: WorkRecord[] = [
  rec({ id: "r-h1", workplaceId: "wp-high", date: "2026-02-02", startTime: "09:00", endTime: "18:00", breakMinutes: 60 }),
];

const RECORDS_UNDER5: WorkRecord[] = [
  // 20-23시(야간대 포함) — isFiveOrMore=false라 엔진 자체가 nightPay/overtimePay/holidayPay를 0으로 계산
  rec({ id: "r-u1", workplaceId: "wp-under5", date: "2026-02-02", startTime: "20:00", endTime: "23:00", breakMinutes: 0 }),
];

const YEAR_MONTH = "2026-02";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-02-15T12:00:00.000Z"));
  scenario.workplaces = [];
  scenario.records = [];
  scenario.activeWorkplaceId = null;
  mockNavigate.mockClear();
});

const ITEM_ORDER = ["base", "night", "overtime", "holiday", "weeklyHoliday", "tax", "net"] as const;

describe("급여 상세 페이지 `/breakdown`", () => {
  it("AC-1[P0]: 항목이 기본급→야간→연장→휴일→주휴→세금→실수령액 순으로 표시되고 합이 gross/net과 일치한다", () => {
    scenario.workplaces = [WP_FIVE];
    scenario.records = RECORDS_FIVE;

    const { container } = renderBreakdown({ workplaceId: "wp-five", yearMonth: YEAR_MONTH });

    const expected = calcMonthly(RECORDS_FIVE, WP_FIVE, YEAR_MONTH);
    const tax = expected.gross - expected.net;

    // 표시 순서
    const rows = Array.from(container.querySelectorAll('[data-testid^="breakdown-item-"]'));
    expect(rows.map((el) => el.getAttribute("data-testid"))).toEqual(
      ITEM_ORDER.map((key) => `breakdown-item-${key}`)
    );

    // 각 금액
    expect(screen.getByTestId("breakdown-item-base").textContent).toContain(`${formatNumber(expected.basePay)}원`);
    expect(screen.getByTestId("breakdown-item-night").textContent).toContain(`${formatNumber(expected.nightPay)}원`);
    expect(screen.getByTestId("breakdown-item-overtime").textContent).toContain(`${formatNumber(expected.overtimePay)}원`);
    expect(screen.getByTestId("breakdown-item-holiday").textContent).toContain(`${formatNumber(expected.holidayPay)}원`);
    expect(screen.getByTestId("breakdown-item-weeklyHoliday").textContent).toContain(
      `${formatNumber(expected.weeklyHolidayPay)}원`
    );
    expect(screen.getByTestId("breakdown-item-tax").textContent).toContain(`${formatNumber(tax)}원`);
    expect(screen.getByTestId("breakdown-item-net").textContent).toContain(`${formatNumber(expected.net)}원`);

    // 합계 정합성 — 5개 가산 항목의 합에서 세금을 빼면 실수령액과 같다
    const sumBeforeTax =
      expected.basePay + expected.nightPay + expected.overtimePay + expected.holidayPay + expected.weeklyHolidayPay;
    expect(sumBeforeTax).toBe(expected.gross);
    expect(sumBeforeTax - tax).toBe(expected.net);
  });

  it("AC-2[P0]: 시급이 최저임금 미만이면 부족액과 함께 경고가 뜨고, 아니면 경고가 0건이다", () => {
    scenario.workplaces = [WP_FIVE];
    scenario.records = RECORDS_FIVE;
    const { unmount } = renderBreakdown({ workplaceId: "wp-five", yearMonth: YEAR_MONTH });

    const expected = calcMonthly(RECORDS_FIVE, WP_FIVE, YEAR_MONTH);
    expect(expected.isBelowMinimumWage).toBe(true);
    const warning = screen.getByTestId("breakdown-minwage-warning");
    expect(warning.textContent).toContain("최저임금보다 낮아요");
    expect(warning.textContent).toContain(`${formatNumber(expected.minimumWageShortfall)}원`);
    unmount();

    scenario.workplaces = [WP_HIGH];
    scenario.records = RECORDS_HIGH;
    renderBreakdown({ workplaceId: "wp-high", yearMonth: YEAR_MONTH });
    expect(screen.queryAllByTestId("breakdown-minwage-warning")).toHaveLength(0);
  });

  it("AC-3: 5인 미만 사업장은 야간·연장·휴일 항목이 0원이고 가산수당 의무가 없다는 보조문구가 뜬다", () => {
    scenario.workplaces = [WP_UNDER5];
    scenario.records = RECORDS_UNDER5;

    renderBreakdown({ workplaceId: "wp-under5", yearMonth: YEAR_MONTH });

    expect(screen.getByTestId("breakdown-item-night").textContent).toContain("0원");
    expect(screen.getByTestId("breakdown-item-overtime").textContent).toContain("0원");
    expect(screen.getByTestId("breakdown-item-holiday").textContent).toContain("0원");

    expect(screen.getByTestId("breakdown-five-note-night").textContent).toContain(
      "5인 미만 사업장은 가산수당 의무가 없어요"
    );
    expect(screen.getByTestId("breakdown-five-note-overtime").textContent).toContain(
      "5인 미만 사업장은 가산수당 의무가 없어요"
    );
    expect(screen.getByTestId("breakdown-five-note-holiday").textContent).toContain(
      "5인 미만 사업장은 가산수당 의무가 없어요"
    );
  });

  it("AC-4: 주차별 목록에 주 근로시간과 주휴 판정이 표시되고, 개근 요건 한계 안내가 노출된다", () => {
    scenario.workplaces = [WP_FIVE];
    scenario.records = RECORDS_FIVE;

    renderBreakdown({ workplaceId: "wp-five", yearMonth: YEAR_MONTH });

    const expected = calcMonthly(RECORDS_FIVE, WP_FIVE, YEAR_MONTH);
    expect(expected.weeks).toHaveLength(2);

    const ineligibleWeek = expected.weeks.find((w) => !w.eligible)!;
    const eligibleWeek = expected.weeks.find((w) => w.eligible)!;
    expect(ineligibleWeek.weeklyMinutes).toBe(780);
    expect(eligibleWeek.weeklyMinutes).toBe(1620);

    const ineligibleRow = screen.getByTestId(`breakdown-week-${ineligibleWeek.weekStart}`);
    expect(ineligibleRow.textContent).toMatch(/13시간/); // 780분 = 13시간
    expect(ineligibleRow.textContent).toMatch(/미지급/);

    const eligibleRow = screen.getByTestId(`breakdown-week-${eligibleWeek.weekStart}`);
    expect(eligibleRow.textContent).toMatch(/27시간/); // 1620분 = 27시간
    expect(eligibleRow.textContent).toMatch(/지급/);

    expect(screen.getByTestId("breakdown-attendance-note").textContent).toMatch(/개근/);
  });

  it("AC-5: 화면 하단에 법적 효력 고지가 항상 렌더된다", () => {
    scenario.workplaces = [WP_FIVE];
    scenario.records = RECORDS_FIVE;

    renderBreakdown({ workplaceId: "wp-five", yearMonth: YEAR_MONTH });

    expect(screen.getByTestId("breakdown-disclaimer").textContent).toBe(
      "법정 기준 자동 계산 결과이며 법적 효력이 없습니다"
    );
  });

  it("AC-6: 기록이 0건이면 EmptyState와 '기록 추가하기' 버튼이 뜨고 HEX 색상·Tailwind 여백 클래스가 없다", () => {
    scenario.workplaces = [WP_FIVE];
    scenario.records = [];

    const { container } = renderBreakdown({ workplaceId: "wp-five", yearMonth: YEAR_MONTH });

    expect(screen.getByRole("button", { name: "기록 추가하기" })).toBeInTheDocument();
    expect(screen.queryByTestId("breakdown-item-base")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(container.innerHTML).not.toMatch(/class="[^"]*\b[pm]-\d+\b/);
  });

  it("폴백: location.state 없이 진입하면 활성 근무지와 이번 달로 계산한다", () => {
    scenario.workplaces = [WP_FIVE];
    scenario.records = RECORDS_FIVE;
    scenario.activeWorkplaceId = "wp-five";

    renderBreakdown(undefined);

    const expected = calcMonthly(RECORDS_FIVE, WP_FIVE, YEAR_MONTH); // 시스템 시각 2026-02-15 → 이번 달 = 2026-02
    expect(screen.getByTestId("breakdown-item-base").textContent).toContain(`${formatNumber(expected.basePay)}원`);
    expect(screen.getByTestId("breakdown-item-net").textContent).toContain(`${formatNumber(expected.net)}원`);
  });
});
