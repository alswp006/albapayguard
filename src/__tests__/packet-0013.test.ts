/**
 * 미지급 분석 결과 페이지 `/check/result` (packet 0013, 리워드 광고 게이트)
 *
 * 이 테스트가 강제하는 CheckResult.tsx 계약:
 * - 미해제 상태(rewardUnlocks 없음/만료)로 진입하면 결과 Card는 렌더되지 않고
 *   TossRewardAd(실제 컴포넌트, `.reward-ad-gate` 클래스)가 노출된다. 광고 로드는
 *   loadFullScreenAd(mock, setTimeout 0으로 onEvent 발화)로 완료되며, `.reward-ad-button`
 *   클릭 시 showFullScreenAd(mock, setTimeout 0으로 onEvent 'rewarded' 발화)가 시청 완료를
 *   알리고, onRewarded 콜백에서 `useAppData().patchSettings`가
 *   `{ rewardUnlocks: { ...settings.rewardUnlocks, "{workplaceId}:{yearMonth}": <now+24h ISO> } }`
 *   형태로 호출된다.
 * - `settings.rewardUnlocks["{workplaceId}:{yearMonth}"]`가 미래 시각이면 TossRewardAd 자체를
 *   렌더하지 않고(= loadFullScreenAd 호출 0건) 결과를 즉시 보여준다. 과거 시각(만료)이면 다시
 *   게이트가 노출된다.
 * - data-testid="diff-hero"    → CountUp 차액 히어로(금액 텍스트에 formatNumber(diff) + "원" 포함)
 * - data-testid="suspect-card" → 미지급 의심 항목별 TDS Card. suspects.length 만큼 렌더되고
 *   각 카드 텍스트에 label, `${formatNumber(amount)}원`, description이 포함된다.
 * - 차액 > 0(미지급 의심)이면 화면 전체 텍스트에 `"{formatNumber(diff)}원"`과
 *   `"덜 받았을 수 있어요"`가 포함된다.
 * - 차액 ≤ 0(정상 지급)이면 화면 전체 텍스트에 `"정상 지급으로 보여요"`가 포함되고
 *   suspect-card는 0개다.
 * - 결과가 표시되면(=해제 상태 렌더 시) `useAppData().savePayCheck(workplaceId, yearMonth, {
 *   actualPaidAmount, calculatedGross, calculatedNet, diff, suspects })`가 정확히 1회 호출된다
 *   (repository.upsertPayCheck가 동일 workplaceId+yearMonth 행을 1건으로 유지·updatedAt 갱신하는
 *   로직은 이미 구현·검증돼 있으므로, 이 페이지 테스트는 올바른 인자로 정확히 1회 호출되는지만 본다).
 * - 화면 어딘가에 정확히 "법정 기준 자동 계산 결과이며 법적 효력이 없습니다" 텍스트와, 고용노동부
 *   임금체불 신고 관련 안내 텍스트(외부 링크 없이)가 렌더된다. window.open/location.href 변경은
 *   0건이다.
 * - 렌더된 HTML에 HEX 색상 리터럴과 Tailwind 여백 클래스(`p-\d+`/`m-\d+`)가 없다.
 *
 * useAppData/useMonthlyPayroll(@/hooks/useAppData)을 시나리오 기반으로 mock하되,
 * calcMonthly/analyzePay는 실제 구현을 그대로 사용해 화면에 표시될 기대값을 계산한다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Workplace, WorkRecord, AppSettings } from "@/lib/types";
import { calcMonthly } from "@/lib/payrollMonthly";
import { analyzePay, type PayrollForAnalysis } from "@/lib/analysis";
import { formatNumber } from "@/lib/utils";

import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
mockTds();
mockAppsInToss();

import { loadFullScreenAd } from "@apps-in-toss/web-framework";

// ── react-router-dom: 실제 MemoryRouter/useLocation 유지, useNavigate만 대체 ──
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// ── @/hooks/useAppData — 시나리오 기반 mock. calcMonthly는 실제 구현 사용 ──
const mockSavePayCheck = vi.fn(async (..._args: unknown[]) => ({ ok: true }) as const);
const mockPatchSettings = vi.fn(async (_patch: Partial<AppSettings>) => ({ ok: true }) as const);

const scenario = {
  workplaces: [] as Workplace[],
  records: [] as WorkRecord[],
  rewardUnlocks: {} as AppSettings["rewardUnlocks"],
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
      activeWorkplaceId: scenario.workplaces[0]?.id ?? null,
      rewardUnlocks: scenario.rewardUnlocks,
      schemaVersion: 1,
    },
    addWorkplace: vi.fn(),
    editWorkplace: vi.fn(),
    removeWorkplace: vi.fn(),
    addRecord: vi.fn(),
    editRecord: vi.fn(),
    removeRecord: vi.fn(),
    savePayCheck: mockSavePayCheck,
    setActiveWorkplace: vi.fn(),
    patchSettings: mockPatchSettings,
  }),
  useMonthlyPayroll: (workplaceId: string | null, yearMonth: string) => {
    const workplace = scenario.workplaces.find((w) => w.id === workplaceId);
    if (!workplace) return null;
    const records = scenario.records.filter((r) => r.workplaceId === workplaceId);
    return calcMonthly(records, workplace, yearMonth);
  },
}));

import CheckResult from "@/pages/CheckResult";

// 5인 이상·프리랜서 3.3% 원천징수 — 야간·주휴수당은 발생하되 연장·휴일·최저임금 미달은 0으로 고정
const WP: Workplace = {
  id: "wp-1",
  name: "편의점",
  hourlyWage: 12000, // 2026년 최저임금(10,320원) 이상 → 미지급 의심 항목에서 minimumWage 제외
  isFiveOrMore: true,
  payday: 10,
  taxType: "freelance3_3",
  colorToken: "blue",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function rec(overrides: Partial<WorkRecord> & Pick<WorkRecord, "id" | "date" | "startTime" | "endTime">): WorkRecord {
  return {
    workplaceId: "wp-1",
    breakMinutes: 60,
    isHoliday: false,
    memo: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// 2026-03-02(월)~03-08(일) 주: 09-18(480분) x3 + 22-02 야간(240분) = 주 1680분 ≥ 900분 → 주휴 지급
// 매일 근로 ≤ 480분(8시간)이라 연장수당은 0, isHoliday 없음이라 휴일수당도 0
const RECORDS: WorkRecord[] = [
  rec({ id: "r-1", date: "2026-03-02", startTime: "09:00", endTime: "18:00" }),
  rec({ id: "r-2", date: "2026-03-03", startTime: "09:00", endTime: "18:00" }),
  rec({ id: "r-3", date: "2026-03-04", startTime: "09:00", endTime: "18:00" }),
  rec({ id: "r-4", date: "2026-03-05", startTime: "22:00", endTime: "02:00", breakMinutes: 0 }),
];

const YEAR_MONTH = "2026-03";
const UNLOCK_KEY = `${WP.id}:${YEAR_MONTH}`;

const PAYROLL = calcMonthly(RECORDS, WP, YEAR_MONTH);
const PAYROLL_FOR_ANALYSIS: PayrollForAnalysis = {
  calculatedNet: PAYROLL.net,
  weeklyHoliday: PAYROLL.weeklyHolidayPay,
  night: PAYROLL.nightPay,
  overtime: PAYROLL.overtimePay,
  holiday: PAYROLL.holidayPay,
  minimumWage: PAYROLL.minimumWageShortfall,
};

const UNDERPAID_AMOUNT = 380000; // calculatedNet(413,102)보다 적게 받음 → 미지급 의심
const OVERPAID_AMOUNT = PAYROLL.net + 5000; // calculatedNet보다 많이 받음 → 정상 지급

function routeState(actualPaidAmount: number) {
  return { workplaceId: WP.id, yearMonth: YEAR_MONTH, actualPaidAmount };
}

function renderResult(actualPaidAmount: number) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: "/check/result", state: routeState(actualPaidAmount) }] },
      React.createElement(CheckResult)
    )
  );
}

beforeEach(() => {
  scenario.workplaces = [WP];
  scenario.records = RECORDS;
  scenario.rewardUnlocks = {};
  mockNavigate.mockClear();
  mockSavePayCheck.mockClear();
  mockPatchSettings.mockClear();
});

describe("미지급 분석 결과 페이지 `/check/result` (리워드 광고 게이트)", () => {
  it("AC-1[P0]: 최초 진입 시 결과가 가려지고, 광고 시청 완료 후 결과가 노출되며 rewardUnlocks에 24시간 뒤 만료가 저장된다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

    const { container } = renderResult(UNDERPAID_AMOUNT);

    // 초기: 광고 게이트 노출, 결과 숨김
    expect(container.querySelector(".reward-ad-gate")).not.toBeNull();
    expect(screen.queryByTestId("diff-hero")).not.toBeInTheDocument();

    // 광고 로드 완료(loadFullScreenAd mock의 setTimeout(0) onEvent) 대기 후 시청 버튼 클릭
    const watchButton = await waitFor(() => {
      const btn = container.querySelector<HTMLButtonElement>(".reward-ad-button");
      expect(btn).not.toBeNull();
      expect(btn!.disabled).toBe(false);
      return btn!;
    });
    fireEvent.click(watchButton);

    await waitFor(() => {
      expect(screen.getByTestId("diff-hero")).toBeInTheDocument();
    });

    const call = mockPatchSettings.mock.calls.find(
      (args) => (args[0] as { rewardUnlocks?: Record<string, string> })?.rewardUnlocks?.[UNLOCK_KEY]
    );
    expect(call).toBeDefined();
    const iso = (call![0] as { rewardUnlocks: Record<string, string> }).rewardUnlocks[UNLOCK_KEY];
    const expireTime = new Date(iso).getTime();
    expect(expireTime).toBeGreaterThan(Date.now());
    expect(expireTime).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000 + 1000);
  });

  it("AC-2[P0]: 24시간 내 재진입 시 광고 없이 즉시 결과가 표시되고, 만료 후 재진입 시 다시 게이트가 노출된다", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

    // 유효(미래) 해제 — 광고 없이 즉시 결과
    scenario.rewardUnlocks = { [UNLOCK_KEY]: "2026-03-16T00:00:00.000Z" };
    const first = renderResult(UNDERPAID_AMOUNT);
    expect(first.container.querySelector(".reward-ad-gate")).toBeNull();
    expect(screen.getByTestId("diff-hero")).toBeInTheDocument();
    expect(loadFullScreenAd).not.toHaveBeenCalled();
    first.unmount();

    // 만료(과거) 해제 — 다시 게이트 노출
    scenario.rewardUnlocks = { [UNLOCK_KEY]: "2026-03-14T00:00:00.000Z" };
    const second = renderResult(UNDERPAID_AMOUNT);
    expect(second.container.querySelector(".reward-ad-gate")).not.toBeNull();
    expect(screen.queryByTestId("diff-hero")).not.toBeInTheDocument();
  });

  it("AC-3a[P0]: 차액이 양수면 히어로 문구와 미지급 의심 항목 카드가 표시된다", () => {
    scenario.rewardUnlocks = { [UNLOCK_KEY]: "2099-01-01T00:00:00.000Z" };
    const { diff, suspects } = analyzePay(PAYROLL_FOR_ANALYSIS, UNDERPAID_AMOUNT);
    expect(diff).toBeGreaterThan(0);
    expect(suspects.length).toBeGreaterThanOrEqual(2); // weeklyHoliday, night

    const { container } = renderResult(UNDERPAID_AMOUNT);

    expect(container.textContent).toContain(`${formatNumber(diff)}원`);
    expect(container.textContent).toContain("덜 받았을 수 있어요");

    const cards = screen.getAllByTestId("suspect-card");
    expect(cards).toHaveLength(suspects.length);
    suspects.forEach((suspect, i) => {
      expect(cards[i].textContent).toContain(suspect.label);
      expect(cards[i].textContent).toContain(`${formatNumber(suspect.amount)}원`);
      expect(cards[i].textContent).toContain(suspect.description);
    });
  });

  it("AC-3b[P0]: 차액이 0 이하면 '정상 지급으로 보여요' 상태가 표시되고 의심 항목은 0건이다", () => {
    scenario.rewardUnlocks = { [UNLOCK_KEY]: "2099-01-01T00:00:00.000Z" };
    const { diff, suspects } = analyzePay(PAYROLL_FOR_ANALYSIS, OVERPAID_AMOUNT);
    expect(diff).toBeLessThanOrEqual(0);
    expect(suspects).toHaveLength(0);

    const { container } = renderResult(OVERPAID_AMOUNT);

    expect(container.textContent).toContain("정상 지급으로 보여요");
    expect(screen.queryAllByTestId("suspect-card")).toHaveLength(0);
  });

  it("AC-4[P0]: 결과가 표시되면 PayCheck가 upsert 형태로 정확히 1회 저장된다", () => {
    scenario.rewardUnlocks = { [UNLOCK_KEY]: "2099-01-01T00:00:00.000Z" };
    const { diff, suspects } = analyzePay(PAYROLL_FOR_ANALYSIS, UNDERPAID_AMOUNT);

    renderResult(UNDERPAID_AMOUNT);

    expect(mockSavePayCheck).toHaveBeenCalledTimes(1);
    expect(mockSavePayCheck).toHaveBeenCalledWith(
      WP.id,
      YEAR_MONTH,
      expect.objectContaining({
        actualPaidAmount: UNDERPAID_AMOUNT,
        calculatedGross: PAYROLL.gross,
        calculatedNet: PAYROLL.net,
        diff,
        suspects,
      })
    );
  });

  it("AC-5[P0]: 법적 효력 고지와 임금체불 신고 안내 텍스트가 렌더되고 외부 이동이 발생하지 않는다", () => {
    scenario.rewardUnlocks = { [UNLOCK_KEY]: "2099-01-01T00:00:00.000Z" };
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const originalHref = window.location.href;

    renderResult(UNDERPAID_AMOUNT);

    expect(
      screen.getByText("법정 기준 자동 계산 결과이며 법적 효력이 없습니다")
    ).toBeInTheDocument();
    expect(screen.getByText(/고용노동부/)).toBeInTheDocument();

    expect(openSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(originalHref);
  });

  it("AC-6: HEX 색상과 Tailwind 여백 클래스가 없다", () => {
    scenario.rewardUnlocks = { [UNLOCK_KEY]: "2099-01-01T00:00:00.000Z" };
    const { container } = renderResult(UNDERPAID_AMOUNT);

    expect(screen.getByTestId("diff-hero")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(container.innerHTML).not.toMatch(/class="[^"]*\b[pm]-\d+\b/);
  });
});
