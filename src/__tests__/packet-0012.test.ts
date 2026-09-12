/**
 * 미지급 분석 입력 페이지 `/check` (packet 0012)
 *
 * 이 테스트가 강제하는 Check.tsx 계약(testId/aria):
 * - data-testid="check-amount-input"   → 실지급액 TextField(raw <input>, TDS mock이 ...props 그대로 전달)
 *   입력 시 천 단위 콤마로 즉시 재포맷되어 표시된다("206400" 입력 → "206,400" 표시).
 * - 검증 실패 시 TextField의 hasError+help로 role="alert" 텍스트가 뜨고("실제 받은 금액을
 *   입력해주세요"=미입력, "0원 이상 1억원 이하로 입력해주세요"=범위 초과), "분석하기" 버튼을
 *   눌러도 navigate가 호출되지 않는다.
 * - data-testid="check-summary-card"   → 계산된 실수령액 요약 Card
 * - data-testid="check-summary-amount" → 카드 내부, 텍스트가 정확히 `${formatNumber(net)}원`
 * - 해당 근무지·월 기록이 0건이면 EmptyState + role="button" name="기록 추가하기" (요약 금액 대신)
 * - 1차 CTA: role="button" name="분석하기" (SubmitFooter/FixedBottomCTA — 자체가 <button>)
 *   탭 시 generateHapticFeedback({type:"success"}) 호출 후
 *   navigate("/check/result", {state:{workplaceId, yearMonth, actualPaidAmount}}) 호출.
 *
 * useAppData/useMonthlyPayroll(@/hooks/useAppData)을 시나리오 기반으로 mock하되,
 * calcMonthly는 실제 구현을 그대로 사용해 화면에 표시될 기대값을 계산한다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Workplace, WorkRecord } from "@/lib/types";
import { calcMonthly } from "@/lib/payrollMonthly";
import { formatNumber } from "@/lib/utils";

import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
mockTds();
mockAppsInToss();

import { generateHapticFeedback } from "@apps-in-toss/web-framework";

// ── react-router-dom: 실제 MemoryRouter/useLocation 유지, useNavigate만 대체 ──
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

import Check from "@/pages/Check";

function renderCheck(state?: { workplaceId: string; yearMonth?: string }) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [state ? { pathname: "/check", state } : "/check"] },
      React.createElement(Check)
    )
  );
}

const WP: Workplace = {
  id: "wp-1",
  name: "편의점",
  hourlyWage: 12000,
  isFiveOrMore: true,
  payday: 10,
  taxType: "none",
  colorToken: "blue",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const RECORDS: WorkRecord[] = [
  {
    id: "r-1",
    workplaceId: "wp-1",
    date: "2026-02-02",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    isHoliday: false,
    memo: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const YEAR_MONTH = "2026-02";

beforeEach(() => {
  scenario.workplaces = [];
  scenario.records = [];
  scenario.activeWorkplaceId = null;
  mockNavigate.mockClear();
  vi.mocked(generateHapticFeedback).mockClear();
});

describe("미지급 분석 입력 페이지 `/check`", () => {
  it("AC-1: 실지급액 입력창에 '206400'을 입력하면 즉시 '206,400'으로 콤마 포맷되어 표시된다", () => {
    scenario.workplaces = [WP];
    scenario.records = RECORDS;

    renderCheck({ workplaceId: "wp-1", yearMonth: YEAR_MONTH });

    const input = screen.getByTestId("check-amount-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "206400" } });

    expect(input.value).toBe("206,400");
  });

  it("AC-2a: 금액을 입력하지 않고 '분석하기'를 누르면 에러가 뜨고 navigate는 호출되지 않는다", () => {
    scenario.workplaces = [WP];
    scenario.records = RECORDS;

    renderCheck({ workplaceId: "wp-1", yearMonth: YEAR_MONTH });

    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));

    expect(screen.getByRole("alert").textContent).toBe("실제 받은 금액을 입력해주세요");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("AC-2b: 1억원(100,000,000) 초과 금액을 입력하고 '분석하기'를 누르면 에러가 뜨고 navigate는 호출되지 않는다", () => {
    scenario.workplaces = [WP];
    scenario.records = RECORDS;

    renderCheck({ workplaceId: "wp-1", yearMonth: YEAR_MONTH });

    const input = screen.getByTestId("check-amount-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "100000001" } });
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));

    expect(screen.getByRole("alert").textContent).toBe("0원 이상 1억원 이하로 입력해주세요");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("AC-3a: 요약 Card에 해당 월 계산된 실수령액이 원 단위 콤마 포맷으로 표시된다", () => {
    scenario.workplaces = [WP];
    scenario.records = RECORDS;

    renderCheck({ workplaceId: "wp-1", yearMonth: YEAR_MONTH });

    const expected = calcMonthly(RECORDS, WP, YEAR_MONTH);
    expect(screen.getByTestId("check-summary-card")).toBeInTheDocument();
    expect(screen.getByTestId("check-summary-amount").textContent).toBe(
      `${formatNumber(expected.net)}원`
    );
  });

  it("AC-3b: 해당 근무지·월 기록이 0건이면 EmptyState와 '기록 추가하기' 버튼이 뜬다", () => {
    scenario.workplaces = [WP];
    scenario.records = [];

    renderCheck({ workplaceId: "wp-1", yearMonth: YEAR_MONTH });

    expect(screen.getByRole("button", { name: "기록 추가하기" })).toBeInTheDocument();
    expect(screen.queryByTestId("check-summary-amount")).not.toBeInTheDocument();
  });

  it("AC-4: 유효한 금액 입력 후 '분석하기' 탭 → haptic('success') → /check/result로 정확한 state와 함께 이동한다", () => {
    scenario.workplaces = [WP];
    scenario.records = RECORDS;

    renderCheck({ workplaceId: "wp-1", yearMonth: YEAR_MONTH });

    const input = screen.getByTestId("check-amount-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "150000" } });
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));

    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
    expect(mockNavigate).toHaveBeenCalledWith("/check/result", {
      state: { workplaceId: "wp-1", yearMonth: YEAR_MONTH, actualPaidAmount: 150000 },
    });
  });

  it("AC-5: 1차 액션은 중첩 없는 단일 버튼이고(HTML 무효 없음) HEX 색상이 없다", () => {
    scenario.workplaces = [WP];
    scenario.records = RECORDS;

    const { container } = renderCheck({ workplaceId: "wp-1", yearMonth: YEAR_MONTH });

    const submitButton = screen.getByRole("button", { name: "분석하기" });
    expect(submitButton.tagName).toBe("BUTTON");
    expect(submitButton.querySelector("button")).toBeNull();
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
