/**
 * 기록 수정 페이지 `/record/:id/edit` — heal 패킷 (packet-heal-1-03)
 *
 * App.tsx는 이미 "/record/:id/edit"를 RecordForm.tsx(신규/수정 겸용)로 라우팅한다
 * (@ai-factory:wiring-first, 수정 금지). 이 패킷은 그 화면의 "수정" 경로가 아래 계약을
 * 만족하도록 정렬한다:
 * - useParams의 id로 기존 기록을 찾아 폼 초기값을 채운다. id에 해당하는 기록이 없으면
 *   안내 문구 + 목록(/records) 이동 Button만 렌더한다(크래시 0건).
 * - 검증 실패 시 인라인 에러 + editRecord 0회. 중복 체크에서 "자기 자신"은 중복으로
 *   치지 않는다(동일 시간 그대로 저장해도 editRecord가 호출돼야 한다).
 * - 삭제 Button은 AlertDialog 확인을 거쳐야만 removeRecord를 호출한다. 취소 시 0회.
 * - 저장·삭제 성공 시 navigate('/records', { state: { toast: '저장했어요' | '삭제했어요' } }).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Workplace, WorkRecord } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";

import { mockTds } from "@/__tests__/__helpers__/mocks";
mockTds();

// ── react-router-dom: 실제 MemoryRouter/Routes 유지, useNavigate만 대체 ──
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// ── @/hooks/useAppData — 시나리오 기반 mock ──
type WriteResult<T> = ({ ok: true } & T) | { ok: false; reason: string };
const mockEditRecord = vi.fn<(id: string, patch: Partial<WorkRecord>) => Promise<WriteResult<WorkRecord>>>();
const mockRemoveRecord = vi.fn<(id: string) => Promise<{ ok: boolean; reason?: string }>>();

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
      activeWorkplaceId: scenario.workplaces[0]?.id ?? null,
      rewardUnlocks: {},
      schemaVersion: 1,
    },
    addWorkplace: vi.fn(),
    editWorkplace: vi.fn(),
    removeWorkplace: vi.fn(),
    addRecord: vi.fn(),
    editRecord: mockEditRecord,
    removeRecord: mockRemoveRecord,
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

function makeRecord(overrides: Partial<WorkRecord> & Pick<WorkRecord, "id" | "workplaceId">): WorkRecord {
  return {
    date: "2026-03-05",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    isHoliday: false,
    memo: "",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderRecordEdit(id: string) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/record/${id}/edit`] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: "/record/:id/edit", element: React.createElement(RecordForm) })
      )
    )
  );
}

beforeEach(() => {
  scenario.workplaces = [];
  scenario.records = [];
  localStorage.clear();
  mockNavigate.mockClear();
  mockEditRecord.mockClear();
  mockRemoveRecord.mockClear();
  mockEditRecord.mockImplementation(async (id, patch) => ({
    ok: true,
    id,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-05T00:00:00.000Z",
    isHoliday: false,
    memo: "",
    workplaceId: "wp-1",
    date: "2026-03-05",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    ...patch,
  }) as WriteResult<WorkRecord>);
  mockRemoveRecord.mockResolvedValue({ ok: true });
});

describe("기록 수정 페이지 `/record/:id/edit`", () => {
  it("AC-1a[P0]: 기존 기록의 모든 필드가 초기값으로 채워진다", () => {
    const wp = makeWorkplace({ id: "wp-1" });
    const existing = makeRecord({
      id: "r-1",
      workplaceId: wp.id,
      date: "2026-03-05",
      startTime: "09:00",
      endTime: "18:00",
      breakMinutes: 45,
      isHoliday: true,
      memo: "마감 청소",
    });
    scenario.workplaces = [wp];
    scenario.records = [existing];

    renderRecordEdit("r-1");

    expect(screen.getByPlaceholderText("2026-03-02")).toHaveValue("2026-03-05");
    expect(screen.getByTestId("record-start-input")).toHaveValue("09:00");
    expect(screen.getByTestId("record-end-input")).toHaveValue("18:00");
    expect(screen.getByTestId("record-break-input")).toHaveValue("45");
    expect(screen.getByRole("switch")).toBeChecked();
    expect(screen.getByTestId("record-memo-input")).toHaveValue("마감 청소");
  });

  it("AC-1b[P0]: 존재하지 않는 id면 안내 문구와 목록 이동 Button만 렌더되고, 클릭 시 /records로 이동한다", () => {
    scenario.workplaces = [makeWorkplace({ id: "wp-1" })];
    scenario.records = [];

    renderRecordEdit("no-such-id");

    expect(screen.getByText("기록을 찾을 수 없어요")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);

    fireEvent.click(buttons[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/records");
  });

  it("AC-2a[P0]: 출근 시각을 비운 채 저장하면 인라인 에러가 뜨고 editRecord는 호출되지 않는다", () => {
    const wp = makeWorkplace({ id: "wp-1" });
    const existing = makeRecord({ id: "r-1", workplaceId: wp.id });
    scenario.workplaces = [wp];
    scenario.records = [existing];

    renderRecordEdit("r-1");

    fireEvent.change(screen.getByTestId("record-start-input"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    expect(screen.getByRole("alert")).toHaveTextContent("시각을 HH:mm 형식(00:00~23:59)으로 입력해주세요");
    expect(mockEditRecord).not.toHaveBeenCalled();
  });

  it("AC-2b[P0]: 값을 바꾸지 않고 그대로 저장해도 자기 자신은 중복으로 판정되지 않아 editRecord가 호출된다", async () => {
    const wp = makeWorkplace({ id: "wp-1" });
    const existing = makeRecord({
      id: "r-1",
      workplaceId: wp.id,
      date: "2026-03-05",
      startTime: "09:00",
      endTime: "18:00",
      breakMinutes: 60,
    });
    scenario.workplaces = [wp];
    scenario.records = [existing];
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify([existing]));

    renderRecordEdit("r-1");
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() => expect(mockEditRecord).toHaveBeenCalledTimes(1));
    expect(mockEditRecord).toHaveBeenCalledWith(
      "r-1",
      expect.objectContaining({ workplaceId: wp.id, date: "2026-03-05", startTime: "09:00", endTime: "18:00" })
    );
    expect(screen.queryByText(/같은.*기록이 있어요/)).not.toBeInTheDocument();
  });

  it("AC-3a[P0]: 삭제 Button은 AlertDialog 확인을 거쳐야 하고, 취소하면 removeRecord는 호출되지 않는다", () => {
    const wp = makeWorkplace({ id: "wp-1" });
    const existing = makeRecord({ id: "r-1", workplaceId: wp.id });
    scenario.workplaces = [wp];
    scenario.records = [existing];

    renderRecordEdit("r-1");

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("기록을 삭제할까요");

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mockRemoveRecord).not.toHaveBeenCalled();
  });

  it("AC-3b[P0]: AlertDialog에서 확인하면 removeRecord가 해당 id로 호출되고 /records로 '삭제했어요' 토스트와 함께 이동한다", async () => {
    const wp = makeWorkplace({ id: "wp-1" });
    const existing = makeRecord({ id: "r-1", workplaceId: wp.id });
    scenario.workplaces = [wp];
    scenario.records = [existing];

    renderRecordEdit("r-1");

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제하기" }));

    await waitFor(() => expect(mockRemoveRecord).toHaveBeenCalledTimes(1));
    expect(mockRemoveRecord).toHaveBeenCalledWith("r-1");
    expect(mockNavigate).toHaveBeenCalledWith("/records", { state: { toast: "삭제했어요" } });
  });

  it("AC-4[P0]: 저장 성공 시 editRecord가 정확한 값으로 호출되고 /records로 '저장했어요' 토스트와 함께 이동한다", async () => {
    const wp = makeWorkplace({ id: "wp-1" });
    const existing = makeRecord({ id: "r-1", workplaceId: wp.id, memo: "" });
    scenario.workplaces = [wp];
    scenario.records = [existing];

    renderRecordEdit("r-1");

    fireEvent.change(screen.getByTestId("record-memo-input"), { target: { value: "야근 수당 확인" } });
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() => expect(mockEditRecord).toHaveBeenCalledTimes(1));
    expect(mockEditRecord).toHaveBeenCalledWith(
      "r-1",
      expect.objectContaining({ memo: "야근 수당 확인", workplaceId: wp.id })
    );
    expect(mockNavigate).toHaveBeenCalledWith("/records", { state: { toast: "저장했어요" } });
  });
});
