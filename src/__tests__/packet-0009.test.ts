/**
 * 홈 대시보드 `/` (packet 0009)
 *
 * 이 테스트가 강제하는 Home.tsx 계약(testId/aria):
 * - loading=true            → SummaryHero 자리 Skeleton 1개 + 목록 자리 Skeleton 3개 (data-skeleton="true" 총 4개)
 * - workplaces.length===0   → EmptyState("등록된 근무지가 없어요" + 버튼 "근무지 추가하기")만 렌더
 * - data-testid="home-hero"        → SummaryHero 카드(탭 시 /breakdown 이동)
 * - data-testid="home-hero-amount" → 히어로 안 예상 급여 금액(Amount/CountUp)
 * - data-testid="workplace-chip-{workplaceId}" → 근무지 전환 Chip
 * - aria-label="이전 달" / "다음 달"  → 월 네비게이션 버튼(44x44 이상, 현재월에서 다음 버튼 disabled)
 * - data-testid="cta-add-record"   → 기록 추가하기 CTA (탭 시 /record/new 이동)
 *
 * useAppData 훅(@/hooks/useAppData)을 직접 mock해 loading/workplaces/records/settings를
 * 시나리오별로 제어한다. calcMonthly는 실제 구현을 그대로 써서(mock 안 함) 기대값을 계산한다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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

// ── @/hooks/useAppData — 시나리오 기반 mock (React state로 activeWorkplaceId 재렌더 유발) ──
const setActiveWorkplaceSpy = vi.fn();
const scenario = {
  loading: false,
  workplaces: [] as Workplace[],
  records: [] as WorkRecord[],
  activeWorkplaceId: null as string | null,
};

vi.mock("@/hooks/useAppData", () => {
  return {
    useAppData: () => {
      const [activeWorkplaceId, setActiveWorkplaceId] = React.useState(scenario.activeWorkplaceId);
      return {
        loading: scenario.loading,
        workplaces: scenario.workplaces,
        records: scenario.records,
        payChecks: [],
        settings: {
          onboardingSeenAt: "2026-01-01T00:00:00.000Z",
          disclaimerAckAt: "2026-01-01T00:00:00.000Z",
          activeWorkplaceId,
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
        setActiveWorkplace: vi.fn(async (id: string | null) => {
          setActiveWorkplaceSpy(id);
          scenario.activeWorkplaceId = id;
          setActiveWorkplaceId(id);
          return {
            ok: true,
            onboardingSeenAt: null,
            disclaimerAckAt: null,
            activeWorkplaceId: id,
            rewardUnlocks: {},
            schemaVersion: 1,
          };
        }),
        patchSettings: vi.fn(),
      };
    },
    useMonthlyPayroll: (workplaceId: string | null, yearMonth: string) => {
      const workplace = scenario.workplaces.find((w) => w.id === workplaceId);
      if (!workplace) return null;
      const records = scenario.records.filter((r) => r.workplaceId === workplaceId);
      return calcMonthly(records, workplace, yearMonth);
    },
  };
});

import Home from "@/pages/Home";

function renderHome() {
  return render(React.createElement(MemoryRouter, null, React.createElement(Home)));
}

const WP1: Workplace = {
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

const WP2: Workplace = {
  id: "wp-2",
  name: "편의점",
  hourlyWage: 12000,
  isFiveOrMore: false,
  payday: 10,
  taxType: "none",
  colorToken: "green",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const REC1: WorkRecord = {
  id: "r-1",
  workplaceId: "wp-1",
  date: "2026-01-05",
  startTime: "09:00",
  endTime: "18:00",
  breakMinutes: 60,
  isHoliday: false,
  memo: "",
  createdAt: "2026-01-05T00:00:00.000Z",
  updatedAt: "2026-01-05T00:00:00.000Z",
};

const REC2: WorkRecord = {
  id: "r-2",
  workplaceId: "wp-2",
  date: "2026-01-06",
  startTime: "10:00",
  endTime: "19:00",
  breakMinutes: 60,
  isHoliday: false,
  memo: "",
  createdAt: "2026-01-06T00:00:00.000Z",
  updatedAt: "2026-01-06T00:00:00.000Z",
};

// "오늘"을 2026-01-15 정오(UTC)로 고정 — 로컬/UTC 어느 쪽으로 날짜를 뽑아도 같은 날짜가 되게(KST=UTC+9 기준 안전).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
  scenario.loading = false;
  scenario.workplaces = [];
  scenario.records = [];
  scenario.activeWorkplaceId = null;
  mockNavigate.mockClear();
  setActiveWorkplaceSpy.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("홈 대시보드 `/`", () => {
  it("AC-1[P0]: 로딩 중엔 히어로 자리 Skeleton 1개 + 목록 자리 Skeleton 3개만 보이고 금액이 미리 노출되지 않는다", () => {
    scenario.loading = true;
    scenario.workplaces = [WP1];
    scenario.records = [REC1];
    scenario.activeWorkplaceId = "wp-1";

    const { container } = renderHome();

    const skeletons = container.querySelectorAll('[data-skeleton="true"]');
    expect(skeletons.length).toBe(4);
    expect(screen.queryByTestId("home-hero-amount")).not.toBeInTheDocument();
    expect(screen.queryAllByText(/\d[\d,]*원/).length).toBe(0);
  });

  it("AC-2[P0]: 근무지가 0개면 근무지 추가 안내만 보이고 기록 추가 CTA는 렌더되지 않는다", () => {
    scenario.loading = false;
    scenario.workplaces = [];
    scenario.records = [];
    scenario.activeWorkplaceId = null;

    renderHome();

    expect(screen.getByText("등록된 근무지가 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "근무지 추가하기" })).toBeInTheDocument();
    expect(screen.queryByTestId("cta-add-record")).not.toBeInTheDocument();
    expect(screen.getAllByText(/없어요/).length).toBe(1);
  });

  it("AC-3[P0]: 근무지 Chip을 탭하면 활성 근무지가 바뀌고 히어로 금액이 해당 근무지 계산값으로 갱신된다", () => {
    scenario.loading = false;
    scenario.workplaces = [WP1, WP2];
    scenario.records = [REC1, REC2];
    scenario.activeWorkplaceId = "wp-1";

    const expectedWp1 = calcMonthly([REC1], WP1, "2026-01");
    const expectedWp2 = calcMonthly([REC2], WP2, "2026-01");
    expect(expectedWp1.gross).not.toBe(expectedWp2.gross);

    renderHome();

    expect(screen.getByTestId("home-hero-amount").textContent).toBe(
      `${formatNumber(expectedWp1.gross)}원`
    );

    fireEvent.click(screen.getByTestId("workplace-chip-wp-2"));

    expect(setActiveWorkplaceSpy).toHaveBeenCalledWith("wp-2");
    expect(screen.getByTestId("home-hero-amount").textContent).toBe(
      `${formatNumber(expectedWp2.gross)}원`
    );
  });

  it("AC-4: 현재 월에서는 다음 달 이동이 막히고, 이전/다음 버튼은 44×44px 이상의 터치 영역을 갖는다", () => {
    scenario.loading = false;
    scenario.workplaces = [WP1];
    scenario.records = [];
    scenario.activeWorkplaceId = "wp-1";

    renderHome();

    const prevBtn = screen.getByRole("button", { name: "이전 달" });
    const nextBtn = screen.getByRole("button", { name: "다음 달" });

    expect(nextBtn).toBeDisabled();
    expect(prevBtn).not.toBeDisabled();

    for (const btn of [prevBtn, nextBtn]) {
      const width = parseFloat(btn.style.minWidth || btn.style.width || "0");
      const height = parseFloat(btn.style.minHeight || btn.style.height || "0");
      expect(width).toBeGreaterThanOrEqual(44);
      expect(height).toBeGreaterThanOrEqual(44);
    }
  });

  it("AC-5: 히어로 탭 시 급여 상세로, 기록 추가 CTA 탭 시 새 기록 작성으로 이동한다", () => {
    scenario.loading = false;
    scenario.workplaces = [WP1];
    scenario.records = [REC1];
    scenario.activeWorkplaceId = "wp-1";

    renderHome();

    fireEvent.click(screen.getByTestId("home-hero"));
    expect(mockNavigate).toHaveBeenCalledWith("/breakdown", {
      state: { workplaceId: "wp-1", yearMonth: "2026-01" },
    });

    mockNavigate.mockClear();
    fireEvent.click(screen.getByTestId("cta-add-record"));
    expect(mockNavigate).toHaveBeenCalledWith("/record/new", {
      state: { workplaceId: "wp-1", date: "2026-01-15" },
    });
  });

  it("AC-6: TDS 컴포넌트에 인라인 padding/margin·Tailwind p-/m- 클래스·HEX 색상이 없다", () => {
    scenario.loading = false;
    scenario.workplaces = [WP1, WP2];
    scenario.records = [REC1, REC2];
    scenario.activeWorkplaceId = "wp-1";

    const { container } = renderHome();

    // Paragraph.Text([data-typography]) / ListRow([role="listitem"]) / Chip(button[aria-pressed]) — TDS mock 시그니처
    const tdsNodes = container.querySelectorAll(
      '[data-typography], [role="listitem"], button[aria-pressed]'
    );
    expect(tdsNodes.length).toBeGreaterThan(0);
    tdsNodes.forEach((el) => {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/padding|margin/);
      const cls = el.getAttribute("class") ?? "";
      expect(cls).not.toMatch(/(^|\s)[pm][trblxy]?-\d/);
    });
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("기록 0건 상태: 활성 근무지의 이번 달 기록이 없으면 예상 급여 0원과 빈 기록 안내를 함께 보여준다", () => {
    scenario.loading = false;
    scenario.workplaces = [WP1];
    scenario.records = [];
    scenario.activeWorkplaceId = "wp-1";

    renderHome();

    expect(screen.getByTestId("home-hero-amount").textContent).toBe(`${formatNumber(0)}원`);
    expect(screen.getByTestId("cta-add-record")).toBeInTheDocument();
    expect(screen.getAllByText(/없어요/).length).toBeGreaterThanOrEqual(1);
  });

  it("손상 상태: activeWorkplaceId가 존재하지 않는 근무지를 가리켜도 크래시 없이 유효한 근무지로 대체한다", () => {
    scenario.loading = false;
    scenario.workplaces = [WP1, WP2];
    scenario.records = [REC1, REC2];
    scenario.activeWorkplaceId = "wp-ghost";

    expect(() => renderHome()).not.toThrow();
    expect(screen.getByText("카페 알바")).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/NaN|undefined/);
  });
});
