/**
 * [부가] 기록 목록 페이지 `/records` (packet 0014)
 *
 * 이 테스트가 강제하는 Records.tsx 계약(testId/aria):
 * - data-testid={`records-row-${record.id}`}    → 기록 한 건을 나타내는 ListRow(행)
 *   textContent에 날짜·시간·실근로·일급(`${formatNumber(daily.total)}원`)이 포함된다.
 *   휴일 기록은 행 안에 "휴일" 텍스트(Badge)가 포함된다.
 * - data-testid={`records-delete-${record.id}`} → 행 내부 삭제 버튼(행 탭과 별개, stopPropagation 필요)
 * - data-testid="records-load-more"             → "더보기" 버튼(role="button", name="더보기").
 *   20건 단위로 페이지네이션하며, 더 불러올 기록이 없으면 렌더되지 않는다.
 * - data-testid="records-summary-card" / "records-summary-total"
 *   → 월 합계 요약 Card, textContent가 정확히 `${formatNumber(gross)}원`
 * - data-testid="records-empty" → EmptyState(해당 근무지·월 기록 0건일 때)
 *   "이 달에는 기록이 없어요" 텍스트 + role="button" name="기록 추가하기"
 * - 행 탭(삭제 버튼 제외) → navigate(`/record/${id}/edit`)
 * - 삭제 버튼 탭 → AlertDialog(role="alertdialog") 오픈, "삭제하기" 확인 시 즉시 목록에서 제거 +
 *   요약 합계 재계산. 확인 전까지는 navigate 호출 없음(stopPropagation).
 *
 * useAppData/useMonthlyPayroll(@/hooks/useAppData)을 시나리오 기반으로 mock하되,
 * calcMonthly/calcDaily는 실제 구현을 그대로 사용해 화면에 표시될 기대값을 계산한다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Workplace, WorkRecord } from "@/lib/types";
import { calcMonthly } from "@/lib/payrollMonthly";
import { calcDaily } from "@/lib/payrollDaily";
import { formatNumber } from "@/lib/utils";

import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
mockTds();
mockAppsInToss();

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

const removeRecordMock = vi.fn(async (id: string) => {
  scenario.records = scenario.records.filter((r) => r.id !== id);
  return { ok: true };
});

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
    removeRecord: removeRecordMock,
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

import Records from "@/pages/Records";

function renderRecords(state?: { workplaceId: string; yearMonth?: string }) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [state ? { pathname: "/records", state } : "/records"] },
      React.createElement(Records)
    )
  );
}

const WP: Workplace = {
  id: "wp-1",
  name: "카페 알바",
  hourlyWage: 10000,
  isFiveOrMore: true,
  payday: 25,
  taxType: "none",
  colorToken: "blue",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const WP_OTHER: Workplace = {
  id: "wp-2",
  name: "편의점",
  hourlyWage: 11000,
  isFiveOrMore: true,
  payday: 10,
  taxType: "none",
  colorToken: "green",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function rec(overrides: Partial<WorkRecord> & Pick<WorkRecord, "id" | "workplaceId" | "date" | "startTime" | "endTime">): WorkRecord {
  return {
    breakMinutes: 60,
    isHoliday: false,
    memo: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const YEAR_MONTH = "2026-02";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-02-15T12:00:00.000Z"));
  scenario.workplaces = [WP, WP_OTHER];
  scenario.records = [];
  scenario.activeWorkplaceId = WP.id;
  mockNavigate.mockClear();
  removeRecordMock.mockClear();
});

describe("[부가] 기록 목록 페이지 `/records`", () => {
  it("AC-1: 기록 45건 중 최초 20건만 렌더하고, '더보기'를 탭할 때마다 20건씩 추가되어 3회째(모두 로드) 버튼이 사라진다", () => {
    scenario.records = Array.from({ length: 45 }, (_, i) => {
      const day = String(1 + (i % 28)).padStart(2, "0");
      const hour = String(6 + (i % 14)).padStart(2, "0");
      return rec({
        id: `r-${i}`,
        workplaceId: WP.id,
        date: `2026-02-${day}`,
        startTime: `${hour}:00`,
        endTime: "18:00",
      });
    });

    renderRecords({ workplaceId: WP.id, yearMonth: YEAR_MONTH });

    expect(screen.getAllByTestId(/^records-row-/)).toHaveLength(20);
    const loadMore = screen.getByRole("button", { name: "더보기" });

    fireEvent.click(loadMore);
    expect(screen.getAllByTestId(/^records-row-/)).toHaveLength(40);
    expect(screen.getByRole("button", { name: "더보기" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "더보기" }));
    expect(screen.getAllByTestId(/^records-row-/)).toHaveLength(45);
    expect(screen.queryByRole("button", { name: "더보기" })).not.toBeInTheDocument();
  });

  it("AC-2: 목록은 date 내림차순, 같은 날짜는 startTime 내림차순으로 정렬되며 각 행에 일급과 휴일 배지가 표시된다", () => {
    const r1 = rec({ id: "r-1", workplaceId: WP.id, date: "2026-02-10", startTime: "09:00", endTime: "14:00" });
    const r2 = rec({ id: "r-2", workplaceId: WP.id, date: "2026-02-12", startTime: "08:00", endTime: "12:00" });
    const r3 = rec({ id: "r-3", workplaceId: WP.id, date: "2026-02-12", startTime: "14:00", endTime: "20:00", isHoliday: true });
    const r4 = rec({ id: "r-4", workplaceId: WP.id, date: "2026-02-05", startTime: "09:00", endTime: "13:00" });
    scenario.records = [r1, r2, r3, r4];

    const { container } = renderRecords({ workplaceId: WP.id, yearMonth: YEAR_MONTH });

    const rows = Array.from(container.querySelectorAll('[data-testid^="records-row-"]'));
    expect(rows.map((el) => el.getAttribute("data-testid"))).toEqual([
      "records-row-r-3",
      "records-row-r-2",
      "records-row-r-1",
      "records-row-r-4",
    ]);

    const dailyR3 = calcDaily(
      { startTime: r3.startTime, endTime: r3.endTime, breakMinutes: r3.breakMinutes },
      { wage: WP.hourlyWage, isFiveOrMore: WP.isFiveOrMore }
    )!;
    expect(screen.getByTestId("records-row-r-3").textContent).toContain(`${formatNumber(dailyR3.total)}원`);
    expect(screen.getByTestId("records-row-r-3").textContent).toContain("휴일");
    expect(screen.getByTestId("records-row-r-1").textContent).not.toContain("휴일");
  });

  it("AC-3a: 행(삭제 버튼 제외)을 탭하면 해당 기록의 수정 화면으로 이동한다", () => {
    const r1 = rec({ id: "r-edit", workplaceId: WP.id, date: "2026-02-10", startTime: "09:00", endTime: "14:00" });
    scenario.records = [r1];

    renderRecords({ workplaceId: WP.id, yearMonth: YEAR_MONTH });

    fireEvent.click(screen.getByTestId("records-row-r-edit"));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate.mock.calls[0][0]).toBe("/record/r-edit/edit");
  });

  it("AC-3b: 삭제 버튼 → AlertDialog 확인 후 목록에서 즉시 제거되고 합계 Card 금액이 재계산된다", async () => {
    const r1 = rec({ id: "r-del", workplaceId: WP.id, date: "2026-02-10", startTime: "09:00", endTime: "18:00" });
    scenario.records = [r1];

    const expectedBefore = calcMonthly([r1], WP, YEAR_MONTH);
    renderRecords({ workplaceId: WP.id, yearMonth: YEAR_MONTH });

    expect(screen.getByTestId("records-summary-total").textContent).toBe(`${formatNumber(expectedBefore.gross)}원`);

    fireEvent.click(screen.getByTestId("records-delete-r-del"));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "삭제하기" }));

    await waitFor(() => {
      expect(screen.queryByTestId("records-row-r-del")).not.toBeInTheDocument();
    });
    expect(removeRecordMock).toHaveBeenCalledWith("r-del");
    expect(screen.getByTestId("records-summary-total").textContent).toBe(`${formatNumber(0)}원`);
  });

  it("AC-4: 해당 월 기록이 0건이면 EmptyState와 '기록 추가하기' 버튼이 뜬다", () => {
    scenario.records = [];

    renderRecords({ workplaceId: WP.id, yearMonth: YEAR_MONTH });

    const empty = screen.getByTestId("records-empty");
    expect(empty.textContent).toContain("이 달에는 기록이 없어요");
    expect(screen.getByRole("button", { name: "기록 추가하기" })).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^records-row-/)).toHaveLength(0);
  });

  it("AC-5a: location.state의 workplaceId가 실재하지 않으면 활성 근무지 기록으로 폴백해 크래시 없이 렌더한다", () => {
    const r1 = rec({ id: "r-active", workplaceId: WP.id, date: "2026-02-10", startTime: "09:00", endTime: "18:00" });
    scenario.records = [r1];
    scenario.activeWorkplaceId = WP.id;

    renderRecords({ workplaceId: "ghost-workplace-id", yearMonth: YEAR_MONTH });

    expect(screen.getByTestId("records-row-r-active")).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^records-row-/)).toHaveLength(1);
  });

  it("AC-5b: location.state 없이 직접 진입해도 활성 근무지·이번 달로 폴백해 크래시 없이 렌더한다", () => {
    const r1 = rec({ id: "r-current", workplaceId: WP.id, date: "2026-02-10", startTime: "09:00", endTime: "18:00" });
    scenario.records = [r1];
    scenario.activeWorkplaceId = WP.id;

    renderRecords(undefined);

    expect(screen.getByTestId("records-row-r-current")).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^records-row-/)).toHaveLength(1);
  });
});
