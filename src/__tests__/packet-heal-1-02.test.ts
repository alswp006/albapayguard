/**
 * 기록 입력 페이지 `/record/new` — heal 패킷 (packet-heal-1-02)
 *
 * App.tsx는 이미 "/record/new"를 RecordForm.tsx(신규/수정 겸용)로 라우팅한다(@ai-factory:wiring-first,
 * 수정 금지). 이 패킷은 그 화면이 아래 계약을 만족하도록 정렬한다:
 * - 날짜·출근·퇴근·휴게시간·휴일 토글·메모 입력이 모두 제공되고, 출퇴근 시각을 바꾸면
 *   Card(record-preview) 안 실근로시간·예상 일급 미리보기가 즉시 갱신된다.
 * - 필수값 누락/잘못된 시간 입력은 validateRecord 메시지를 role="alert"로 보여주고 addRecord를
 *   0회 호출한다.
 * - 같은 근무지·같은 날짜·같은 출근시각 기록이 이미 있으면 중복 안내가 뜨고 addRecord는 0회다.
 * - 저장 성공 시 addRecord가 정확한 입력으로 1회 호출되고 navigate('/records', { state: { toast:
 *   '저장했어요' } })로 이동한다. addRecord가 quota 실패를 반환하면 이동하지 않고 저장 공간 부족
 *   안내가 표시된다.
 * - 1차 액션은 "저장하기" 버튼 정확히 1개이며 그 안에 중첩된 button이 없다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Workplace, WorkRecord } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";

import { mockTds } from "@/__tests__/__helpers__/mocks";
mockTds();

// ── react-router-dom: 실제 MemoryRouter 유지, useNavigate만 대체 ──
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// ── @/hooks/useAppData — 시나리오 기반 mock ──
type AddRecordResult = ({ ok: true } & WorkRecord) | { ok: false; reason: string };
const mockAddRecord = vi.fn<(input: Partial<WorkRecord>) => Promise<AddRecordResult>>(async (input) => ({
  ok: true,
  id: "r-new",
  createdAt: "2026-03-05T00:00:00.000Z",
  updatedAt: "2026-03-05T00:00:00.000Z",
  isHoliday: false,
  memo: "",
  ...input,
}) as AddRecordResult);

const scenario = {
  workplaces: [] as Workplace[],
};

vi.mock("@/hooks/useAppData", () => ({
  useAppData: () => ({
    loading: false,
    workplaces: scenario.workplaces,
    records: [] as WorkRecord[],
    payChecks: [],
    settings: {
      onboardingSeenAt: "2026-01-01T00:00:00.000Z",
      disclaimerAckAt: "2026-01-01T00:00:00.000Z",
      activeWorkplaceId: scenario.workplaces[0]?.id ?? null,
      rewardUnlocks: {},
      schemaVersion: 1,
    },
    addWorkplace: vi.fn(),
    editWorkplace: vi.fn(),
    removeWorkplace: vi.fn(),
    addRecord: mockAddRecord,
    editRecord: vi.fn(),
    removeRecord: vi.fn(),
    savePayCheck: vi.fn(),
    setActiveWorkplace: vi.fn(),
    patchSettings: vi.fn(),
  }),
  useMonthlyPayroll: () => null,
}));

import RecordForm from "@/pages/RecordForm";

function makeWorkplace(overrides: Partial<Workplace> & Pick<Workplace, "id">): Workplace {
  return {
    name: "편의점",
    hourlyWage: 10000,
    isFiveOrMore: false,
    payday: 25,
    taxType: "none",
    colorToken: "blue",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderRecordNew() {
  return render(
    React.createElement(MemoryRouter, { initialEntries: ["/record/new"] }, React.createElement(RecordForm))
  );
}

function fillValidRecord(date = "2026-03-05") {
  fireEvent.change(screen.getByPlaceholderText("2026-03-02"), { target: { value: date } });
  fireEvent.change(screen.getByTestId("record-start-input"), { target: { value: "09:00" } });
  fireEvent.change(screen.getByTestId("record-end-input"), { target: { value: "18:00" } });
  fireEvent.change(screen.getByTestId("record-break-input"), { target: { value: "60" } });
}

beforeEach(() => {
  scenario.workplaces = [];
  localStorage.clear();
  mockNavigate.mockClear();
  mockAddRecord.mockClear();
  mockAddRecord.mockImplementation(async (input) => ({
    ok: true,
    id: "r-new",
    createdAt: "2026-03-05T00:00:00.000Z",
    updatedAt: "2026-03-05T00:00:00.000Z",
    isHoliday: false,
    memo: "",
    ...input,
  }) as AddRecordResult);
});

describe("기록 입력 페이지 `/record/new`", () => {
  it("AC-1[P0]: 모든 입력이 렌더되고 출퇴근 시각 변경 시 실근로시간·예상 일급 미리보기가 즉시 갱신된다", () => {
    scenario.workplaces = [makeWorkplace({ id: "wp-1", hourlyWage: 10000, isFiveOrMore: false })];
    renderRecordNew();

    expect(screen.getByPlaceholderText("2026-03-02")).toBeInTheDocument();
    expect(screen.getByTestId("record-start-input")).toBeInTheDocument();
    expect(screen.getByTestId("record-end-input")).toBeInTheDocument();
    expect(screen.getByTestId("record-break-input")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
    expect(screen.getByTestId("record-memo-input")).toBeInTheDocument();
    expect(screen.getByTestId("record-preview")).toBeInTheDocument();
    expect(screen.getByText("출근·퇴근 시각을 입력하면 예상 일급을 보여드려요")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("record-start-input"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByTestId("record-end-input"), { target: { value: "18:00" } });
    fireEvent.change(screen.getByTestId("record-break-input"), { target: { value: "60" } });

    // 8시간 근무(480분) - 시급 10,000원 5인 미만: basePay = floor(480*10000/60) = 80,000원
    expect(screen.getByTestId("record-preview-worked")).toHaveTextContent("실근로 8시간");
    expect(screen.getByTestId("record-preview-pay")).toHaveTextContent("80,000원");
  });

  it("AC-2a[P0]: 출퇴근 시각이 비어있는 채로 저장하면 인라인 에러가 뜨고 addRecord는 호출되지 않는다", () => {
    scenario.workplaces = [makeWorkplace({ id: "wp-1" })];
    renderRecordNew();

    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    expect(screen.getByRole("alert")).toHaveTextContent("시각을 HH:mm 형식(00:00~23:59)으로 입력해주세요");
    expect(mockAddRecord).not.toHaveBeenCalled();
  });

  it("AC-2b[P0]: 유효한 시각·휴게시간을 입력하면 인라인 에러가 표시되지 않는다", () => {
    scenario.workplaces = [makeWorkplace({ id: "wp-1" })];
    renderRecordNew();

    fillValidRecord();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("AC-3[P0]: 같은 근무지·날짜·출근시각 기록이 이미 있으면 중복 안내가 뜨고 addRecord는 호출되지 않는다", async () => {
    const wp = makeWorkplace({ id: "wp-1" });
    scenario.workplaces = [wp];
    const existing: WorkRecord = {
      id: "r-existing",
      workplaceId: wp.id,
      date: "2026-03-05",
      startTime: "09:00",
      endTime: "18:00",
      breakMinutes: 60,
      isHoliday: false,
      memo: "",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    };
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify([existing]));

    renderRecordNew();
    fillValidRecord("2026-03-05");
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() => expect(screen.getByText(/같은.*기록이 있어요/)).toBeInTheDocument());
    expect(mockAddRecord).not.toHaveBeenCalled();
  });

  it("AC-4a[P0]: 유효한 입력으로 저장하면 addRecord가 정확한 값으로 1회 호출되고 /records로 성공 토스트와 함께 이동한다", async () => {
    const wp = makeWorkplace({ id: "wp-1", hourlyWage: 10000, isFiveOrMore: false });
    scenario.workplaces = [wp];
    renderRecordNew();

    fillValidRecord("2026-03-05");
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() => expect(mockAddRecord).toHaveBeenCalledTimes(1));
    expect(mockAddRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        workplaceId: wp.id,
        date: "2026-03-05",
        startTime: "09:00",
        endTime: "18:00",
        breakMinutes: 60,
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith("/records", { state: { toast: "저장했어요" } });
  });

  it("AC-4b[P0]: 저장 공간 부족(quota)으로 실패하면 이동하지 않고 저장 공간 부족 안내가 표시된다", async () => {
    mockAddRecord.mockResolvedValueOnce({ ok: false, reason: "quota" });
    const wp = makeWorkplace({ id: "wp-1" });
    scenario.workplaces = [wp];
    renderRecordNew();

    fillValidRecord("2026-03-05");
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() => expect(mockAddRecord).toHaveBeenCalledTimes(1));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByText("저장 공간이 부족합니다. 오래된 기록을 삭제해주세요")).toBeInTheDocument();
  });

  it("AC-5[P0]: 1차 액션은 '저장하기' 버튼 정확히 1개이며 button 중첩이 없다", () => {
    scenario.workplaces = [makeWorkplace({ id: "wp-1" })];
    renderRecordNew();

    const saveButtons = screen.getAllByRole("button", { name: "저장하기" });
    expect(saveButtons).toHaveLength(1);
    expect(saveButtons[0].querySelector("button")).toBeNull();
  });
});
