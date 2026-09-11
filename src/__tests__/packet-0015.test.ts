/**
 * [부가] 근무지 목록·등록·수정 페이지 `/workplace` (packet 0015)
 *
 * Workplace.tsx(목록)/WorkplaceForm.tsx(등록·수정)이 강제하는 계약:
 * - 근무지 5개(=MAX_WORKPLACES) 상태에서 '근무지 추가' Button은 disabled이고 화면에
 *   "근무지는 최대 5개까지 등록할 수 있어요" 문구가 렌더된다. 4개면 그 버튼은 disabled가 아니다.
 * - WorkplaceForm 저장 시 이름 공백/시급 0 이하면 TextField 옆 에러 문구("근무지 이름을
 *   입력해주세요"/"시급을 1원 이상 입력해주세요")가 표시되고 addWorkplace/editWorkplace는
 *   0번 호출된다(= repository.validateWorkplace와 동일한 메시지).
 * - 유효한 입력으로 저장하면 addWorkplace가 정확히 1회 호출되고, 성공 시
 *   navigate('/workplace', { state: { toast: '...' } })로 이동한다. Workplace.tsx는 그
 *   location.state.toast를 받아 Toast를 1회 노출한다.
 * - 근무지 삭제 AlertDialog의 description에는 연결된 기록 n건과 분석 m건이 숫자로
 *   표기되고, 확인(AlertButton) 클릭 시 removeWorkplace(id)가 호출되며 그 근무지는
 *   목록에서 사라진다(연쇄 삭제 반영).
 * - 목록 하단에 "데이터는 이 기기에만 저장돼요"로 시작하는 기기 저장 고지 문구가 렌더된다.
 * - 렌더된 HTML에 HEX 색상 리터럴(#fff 등)이 없고, 색상 선택 버튼의 터치 영역은
 *   44px 이상이다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Workplace, WorkRecord, PayCheck } from "@/lib/types";

import { mockTds } from "@/__tests__/__helpers__/mocks";
mockTds();

// ── react-router-dom: 실제 MemoryRouter 유지, useNavigate만 대체 ──
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// ── @/hooks/useAppData — 시나리오 기반 mock (mutable scenario로 재렌더 후 값 반영) ──
const mockAddWorkplace = vi.fn(async (_input: unknown) => ({ ok: true }) as const);
const mockEditWorkplace = vi.fn(async (_id: string, _input: unknown) => ({ ok: true }) as const);
const mockRemoveWorkplace = vi.fn(async (id: string) => {
  scenario.workplaces = scenario.workplaces.filter((w) => w.id !== id);
  scenario.records = scenario.records.filter((r) => r.workplaceId !== id);
  scenario.payChecks = scenario.payChecks.filter((p) => p.workplaceId !== id);
  return { ok: true };
});

const scenario = {
  workplaces: [] as Workplace[],
  records: [] as WorkRecord[],
  payChecks: [] as PayCheck[],
};

vi.mock("@/hooks/useAppData", () => ({
  useAppData: () => ({
    loading: false,
    workplaces: scenario.workplaces,
    records: scenario.records,
    payChecks: scenario.payChecks,
    settings: {
      onboardingSeenAt: "2026-01-01T00:00:00.000Z",
      disclaimerAckAt: "2026-01-01T00:00:00.000Z",
      activeWorkplaceId: scenario.workplaces[0]?.id ?? null,
      rewardUnlocks: {},
      schemaVersion: 1,
    },
    addWorkplace: mockAddWorkplace,
    editWorkplace: mockEditWorkplace,
    removeWorkplace: mockRemoveWorkplace,
    addRecord: vi.fn(),
    editRecord: vi.fn(),
    removeRecord: vi.fn(),
    savePayCheck: vi.fn(),
    setActiveWorkplace: vi.fn(),
    patchSettings: vi.fn(),
  }),
  useMonthlyPayroll: () => null,
}));

import WorkplacePage from "@/pages/Workplace";
import WorkplaceForm from "@/pages/WorkplaceForm";

function makeWorkplace(overrides: Partial<Workplace> & Pick<Workplace, "id">): Workplace {
  return {
    name: "편의점",
    hourlyWage: 10320,
    isFiveOrMore: false,
    payday: 25,
    taxType: "none",
    colorToken: "blue",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderWorkplaceList(initialEntries: Array<string | { pathname: string; state?: unknown }> = ["/workplace"]) {
  return render(
    React.createElement(MemoryRouter, { initialEntries }, React.createElement(WorkplacePage))
  );
}

function renderWorkplaceForm() {
  return render(
    React.createElement(MemoryRouter, { initialEntries: ["/workplace/new"] }, React.createElement(WorkplaceForm))
  );
}

beforeEach(() => {
  scenario.workplaces = [];
  scenario.records = [];
  scenario.payChecks = [];
  mockNavigate.mockClear();
  mockAddWorkplace.mockClear();
  mockEditWorkplace.mockClear();
  mockRemoveWorkplace.mockClear();
});

describe("[부가] 근무지 목록·등록·수정 페이지 `/workplace`", () => {
  it("AC-1a[P0]: 근무지가 5개면 '근무지 추가' 버튼이 비활성화되고 상한 안내 문구가 보인다", () => {
    scenario.workplaces = Array.from({ length: 5 }, (_, i) => makeWorkplace({ id: `wp-${i}` }));

    renderWorkplaceList();

    const addButton = screen.getByTestId("workplace-add-button") as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
    expect(screen.getByText("근무지는 최대 5개까지 등록할 수 있어요")).toBeInTheDocument();
  });

  it("AC-1b[P0]: 근무지가 4개면 '근무지 추가' 버튼이 활성 상태다", () => {
    scenario.workplaces = Array.from({ length: 4 }, (_, i) => makeWorkplace({ id: `wp-${i}` }));

    renderWorkplaceList();

    const addButton = screen.getByTestId("workplace-add-button") as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
  });

  it("AC-2[P0]: 이름이 비어있거나 시급이 0 이하면 인라인 에러가 표시되고 저장이 호출되지 않는다", () => {
    renderWorkplaceForm();

    const saveButton = screen.getByRole("button", { name: "저장" });
    fireEvent.click(saveButton);

    expect(screen.getByText("근무지 이름을 입력해주세요")).toBeInTheDocument();
    expect(screen.getByText("시급을 1원 이상 입력해주세요")).toBeInTheDocument();
    expect(mockAddWorkplace).not.toHaveBeenCalled();
    expect(mockEditWorkplace).not.toHaveBeenCalled();
  });

  it("AC-4[P0]: 유효한 입력으로 저장하면 addWorkplace가 1회 호출되고 toast state로 /workplace로 이동한다", async () => {
    renderWorkplaceForm();

    fireEvent.change(screen.getByTestId("workplace-name-input"), { target: { value: "카페" } });
    fireEvent.change(screen.getByTestId("workplace-wage-input"), { target: { value: "10320" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(mockAddWorkplace).toHaveBeenCalledTimes(1);
    });
    expect(mockAddWorkplace).toHaveBeenCalledWith(
      expect.objectContaining({ name: "카페", hourlyWage: 10320 })
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      "/workplace",
      expect.objectContaining({ state: expect.objectContaining({ toast: expect.any(String) }) })
    );
  });

  it("AC-4b: /workplace 진입 시 location.state.toast가 있으면 Toast가 1회 노출된다", () => {
    scenario.workplaces = [makeWorkplace({ id: "wp-1" })];

    renderWorkplaceList([{ pathname: "/workplace", state: { toast: "저장했어요" } }]);

    expect(screen.getAllByText("저장했어요")).toHaveLength(1);
  });

  it("AC-3[P0]: 삭제 다이얼로그에 연결 기록·분석 건수가 표기되고, 확인 시 삭제되어 목록에서 사라진다", async () => {
    scenario.workplaces = [makeWorkplace({ id: "wp-1", name: "편의점" })];
    scenario.records = [
      { id: "r-1", workplaceId: "wp-1", date: "2026-03-01", startTime: "09:00", endTime: "18:00", breakMinutes: 60, isHoliday: false, memo: "", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "r-2", workplaceId: "wp-1", date: "2026-03-02", startTime: "09:00", endTime: "18:00", breakMinutes: 60, isHoliday: false, memo: "", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    scenario.payChecks = [
      { id: "p-1", workplaceId: "wp-1", yearMonth: "2026-03", actualPaidAmount: 100000, calculatedGross: 120000, calculatedNet: 110000, diff: 10000, suspects: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];

    renderWorkplaceList();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("2");
    expect(dialog.textContent).toContain("1");

    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(mockRemoveWorkplace).toHaveBeenCalledWith("wp-1");
    });
    expect(screen.queryByText("편의점")).not.toBeInTheDocument();
  });

  it("AC-5: 목록 하단에 기기 저장 고지 문구가 렌더된다", () => {
    scenario.workplaces = [makeWorkplace({ id: "wp-1" })];

    renderWorkplaceList();

    expect(screen.getByText(/데이터는 이 기기에만 저장돼요/)).toBeInTheDocument();
  });

  it("AC-6: 색상 선택 버튼에 HEX 리터럴이 없고 터치 영역이 44px 이상이다", () => {
    const { container } = renderWorkplaceForm();

    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);

    const colorButtons = container.querySelectorAll('button[aria-pressed]');
    expect(colorButtons.length).toBeGreaterThan(0);
    colorButtons.forEach((btn) => {
      const style = (btn as HTMLElement).style;
      const width = parseInt(style.width || "0", 10);
      const height = parseInt(style.height || "0", 10);
      expect(width).toBeGreaterThanOrEqual(44);
      expect(height).toBeGreaterThanOrEqual(44);
    });
  });
});
