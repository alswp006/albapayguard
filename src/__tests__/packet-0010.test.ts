/**
 * 기록 입력/수정 페이지 `/record/new`, `/record/:id/edit` (packet 0010)
 *
 * 이 테스트가 강제하는 RecordForm.tsx 계약(testId/aria):
 * - data-testid="record-start-input" / "record-end-input" / "record-break-input" / "record-memo-input"
 *   → TextField 입력(TDS mock이 ...props를 그대로 <input>에 전달하므로 data-testid로 직접 조회)
 * - data-testid="record-preview"         → 미리보기 컨테이너(Card) — 익일 안내 문구 포함
 * - data-testid="record-preview-worked"  → 실근로시간 텍스트("N시간" 포함)
 * - data-testid="record-preview-pay"     → 예상 일급(payrollDaily.calcDaily 기준) — `${formatNumber(total)}원`
 * - 저장 버튼: role="button" name에 "저장" 포함 (SubmitFooter/FixedBottomCTA)
 * - 삭제 트리거: role="button" name="삭제" (Top 우상단 IconButton)
 * - 삭제 확인 AlertDialog: role="alertdialog" 내부에 name="닫기"(기본 dismiss) + name="삭제하기"(확인) 버튼
 * - 시각 형식 에러: role="alert" 텍스트 = validateRecord()의 정확한 메시지
 * - 중복 저장 거부: 화면에 "같은 시간에 저장된 기록이 있어요" 텍스트 노출
 *
 * useAppData 훅(@/hooks/useAppData)을 mock해 addRecord/editRecord/removeRecord를 스파이로 검증하고,
 * isDuplicateRecord는 실제 repository 구현이 실제 localStorage를 읽으므로 STORAGE_KEYS.RECORDS에도
 * 동일한 데이터를 시딩해 어떤 구현 경로(컨텍스트 vs storage 직접 조회)든 동일하게 검증되게 한다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Workplace, WorkRecord } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { calcDaily } from "@/lib/payrollDaily";

import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
mockTds();
mockAppsInToss();

// ── react-router-dom: 실제 MemoryRouter/Routes/useParams/useLocation 유지, useNavigate만 대체 ──
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// ── @/hooks/useAppData — 시나리오 기반 mock ──
const addRecordSpy = vi.fn(async (input: any) => ({
  ok: true,
  id: "new-id",
  createdAt: "2026-03-02T00:00:00.000Z",
  updatedAt: "2026-03-02T00:00:00.000Z",
  isHoliday: false,
  memo: "",
  ...input,
}));
const editRecordSpy = vi.fn(async (id: string, patch: any) => ({ ok: true, id, ...patch }));
const removeRecordSpy = vi.fn(async (id: string) => ({ ok: true }));

const scenario = {
  workplaces: [] as Workplace[],
  records: [] as WorkRecord[],
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
      activeWorkplaceId: null,
      rewardUnlocks: {},
      schemaVersion: 1,
    },
    addWorkplace: vi.fn(),
    editWorkplace: vi.fn(),
    removeWorkplace: vi.fn(),
    addRecord: addRecordSpy,
    editRecord: editRecordSpy,
    removeRecord: removeRecordSpy,
    savePayCheck: vi.fn(),
    setActiveWorkplace: vi.fn(),
    patchSettings: vi.fn(),
  }),
}));

import RecordForm from "@/pages/RecordForm";

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

const EXISTING: WorkRecord = {
  id: "r-1",
  workplaceId: "wp-1",
  date: "2026-03-02",
  startTime: "09:00",
  endTime: "18:00",
  breakMinutes: 60,
  isHoliday: false,
  memo: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderNew(state: { workplaceId: string; date: string } = { workplaceId: "wp-1", date: "2026-03-02" }) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: "/record/new", state }] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: "/record/new", element: React.createElement(RecordForm) })
      )
    )
  );
}

function renderEdit(recordId: string) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: `/record/${recordId}/edit`, state: { recordId } }] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: "/record/:id/edit", element: React.createElement(RecordForm) })
      )
    )
  );
}

beforeEach(() => {
  scenario.workplaces = [WP1];
  scenario.records = [];
  addRecordSpy.mockClear();
  editRecordSpy.mockClear();
  removeRecordSpy.mockClear();
  mockNavigate.mockClear();
});

describe("기록 입력/수정 페이지 `/record/new`, `/record/:id/edit`", () => {
  it("AC-1[P0]: 출근 19:00·퇴근 02:00 입력 시 익일 안내와 실근로 7시간(휴게 0)이 미리보기에 표시된다", () => {
    renderNew();

    fireEvent.change(screen.getByTestId("record-start-input"), { target: { value: "19:00" } });
    fireEvent.change(screen.getByTestId("record-end-input"), { target: { value: "02:00" } });
    fireEvent.change(screen.getByTestId("record-break-input"), { target: { value: "0" } });

    expect(screen.getByTestId("record-preview").textContent).toMatch(/익일/);
    expect(screen.getByTestId("record-preview-worked").textContent).toMatch(/7시간/);

    const expectedTotal = calcDaily(
      { startTime: "19:00", endTime: "02:00", breakMinutes: 0 },
      { wage: WP1.hourlyWage, isFiveOrMore: WP1.isFiveOrMore }
    )!.total;
    expect(screen.getByTestId("record-preview-pay").textContent).toBe(`${formatNumber(expectedTotal)}원`);
  });

  it("AC-2[P0]: 시각 형식이 올바르지 않으면 에러 문구가 뜨고 저장 시도해도 저장 0건이다", () => {
    renderNew();

    fireEvent.change(screen.getByTestId("record-start-input"), { target: { value: "9시" } });
    fireEvent.change(screen.getByTestId("record-end-input"), { target: { value: "18:00" } });

    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    expect(screen.getByRole("alert").textContent).toBe(
      "시각을 HH:mm 형식(00:00~23:59)으로 입력해주세요"
    );
    expect(addRecordSpy).not.toHaveBeenCalled();
  });

  it("AC-3[P0]: 동일 (workplaceId,date,startTime) 기록이 있으면 신규 저장이 거부되고 안내 토스트가 뜬다", async () => {
    scenario.records = [EXISTING];
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify([EXISTING]));

    renderNew({ workplaceId: "wp-1", date: "2026-03-02" });

    fireEvent.change(screen.getByTestId("record-start-input"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByTestId("record-end-input"), { target: { value: "20:00" } });
    fireEvent.change(screen.getByTestId("record-break-input"), { target: { value: "30" } });

    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    await screen.findByText("같은 시간에 저장된 기록이 있어요");
    expect(addRecordSpy).not.toHaveBeenCalled();
  });

  it("AC-3: 수정 모드에서 자기 자신과만 충돌하면(값 변경 없이) 저장에 성공한다", async () => {
    scenario.records = [EXISTING];
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify([EXISTING]));

    renderEdit("r-1");

    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => expect(editRecordSpy).toHaveBeenCalledTimes(1));
    expect(editRecordSpy.mock.calls[0][0]).toBe("r-1");
    expect(screen.queryByText("같은 시간에 저장된 기록이 있어요")).not.toBeInTheDocument();
  });

  it("AC-4: 휴게시간 미입력 시 근무 4h 이상은 30분·8h 이상은 60분이 자동 채워져 미리보기에 반영된다", () => {
    const { unmount } = renderNew();

    fireEvent.change(screen.getByTestId("record-start-input"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByTestId("record-end-input"), { target: { value: "13:30" } });

    expect((screen.getByTestId("record-break-input") as HTMLInputElement).value).toBe("30");
    expect(screen.getByTestId("record-preview-worked").textContent).toMatch(/4시간/);

    unmount();

    renderNew();
    fireEvent.change(screen.getByTestId("record-start-input"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByTestId("record-end-input"), { target: { value: "18:00" } });

    expect((screen.getByTestId("record-break-input") as HTMLInputElement).value).toBe("60");
    expect(screen.getByTestId("record-preview-worked").textContent).toMatch(/8시간/);
  });

  it("AC-5: 삭제 버튼 → AlertDialog(닫기 버튼 포함) → 확인 시 삭제 후 /records로 이동한다", async () => {
    scenario.records = [EXISTING];
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify([EXISTING]));

    renderEdit("r-1");

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "닫기" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "삭제하기" }));

    await waitFor(() => expect(removeRecordSpy).toHaveBeenCalledWith("r-1"));
    expect(mockNavigate).toHaveBeenCalledWith("/records", { state: { toast: "삭제했어요" } });
  });

  it("AC-6: 저장 버튼 안에 <button> 중첩이 없고(button>button 무효 HTML 금지) HEX 색상이 없다", () => {
    const { container } = renderNew();

    const saveButton = screen.getByRole("button", { name: /저장/ });
    expect(saveButton.tagName).toBe("BUTTON");
    expect(saveButton.querySelector("button")).toBeNull();

    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
