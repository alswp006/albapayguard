/**
 * 기록 수정 화면 `/record/:id/edit` 실구현 — 플레이스홀더 제거 (packet heal-2-02)
 *
 * App.tsx는 이미 "/record/:id/edit"를 src/pages/RecordEdit.tsx로 라우팅한다
 * (@ai-factory:wiring-first, 수정 금지). 이 패킷은 RecordEdit 엔트리(및 그것이 위임하는
 * RecordForm)가 아래 계약을 만족하는지 확인한다:
 * - '준비 중'류 플레이스홀더가 없고 실제 폼이 렌더된다.
 * - URL 파라미터 id로 기존 기록을 조회해 모든 필드를 초기값으로 채운다.
 * - 존재하지 않는 id는 빈 상태 UI + 목록 복귀 경로를 제공하고 크래시가 없다.
 * - 저장 중 editRecord가 QuotaExceededError를 throw하면 try/catch로 잡아 Toast를 띄우고
 *   navigate를 호출하지 않는다(상태 롤백 — 사용자가 입력을 잃지 않는다).
 * - ScreenScaffold/Top/Card/Spacing(size)/SubmitFooter로만 구성되고 HEX 하드코딩이 없다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Workplace, WorkRecord } from "@/lib/types";

import { mockTds } from "@/__tests__/__helpers__/mocks";
mockTds();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;

function readSrcFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

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

import RecordEdit from "@/pages/RecordEdit";

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
        React.createElement(Route, { path: "/record/:id/edit", element: React.createElement(RecordEdit) })
      )
    )
  );
}

beforeEach(() => {
  scenario.workplaces = [];
  scenario.records = [];
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

describe("기록 수정 화면 `/record/:id/edit` 실구현 — 플레이스홀더 제거", () => {
  it("AC-1[P0]: RecordEdit 소스에 '준비 중'류 플레이스홀더 마커가 없고, 렌더 결과에 실제 입력 폼(출근/퇴근 시각)이 나타난다", () => {
    const wp = makeWorkplace({ id: "wp-1" });
    const existing = makeRecord({ id: "r-1", workplaceId: wp.id });
    scenario.workplaces = [wp];
    scenario.records = [existing];

    const editSource = readSrcFile("src/pages/RecordEdit.tsx");
    expect(editSource.includes("준비 중이에요")).toBe(false);
    expect(editSource.includes("@ai-factory:placeholder")).toBe(false);

    renderRecordEdit("r-1");

    expect(screen.getByTestId("record-start-input")).toBeInTheDocument();
    expect(screen.getByTestId("record-end-input")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장하기" })).toBeInTheDocument();
  });

  it("AC-2[P0]: URL 파라미터 id로 조회한 기존 기록의 모든 필드(날짜/시각/휴게시간/휴일/메모)가 초기값으로 채워진다", () => {
    const wp = makeWorkplace({ id: "wp-1" });
    const existing = makeRecord({
      id: "r-1",
      workplaceId: wp.id,
      date: "2026-03-07",
      startTime: "10:00",
      endTime: "19:30",
      breakMinutes: 45,
      isHoliday: true,
      memo: "재고 정리",
    });
    scenario.workplaces = [wp];
    scenario.records = [existing];

    renderRecordEdit("r-1");

    expect(screen.getByPlaceholderText("2026-03-02")).toHaveValue("2026-03-07");
    expect(screen.getByTestId("record-start-input")).toHaveValue("10:00");
    expect(screen.getByTestId("record-end-input")).toHaveValue("19:30");
    expect(screen.getByTestId("record-break-input")).toHaveValue("45");
    expect(screen.getByRole("switch")).toBeChecked();
    expect(screen.getByTestId("record-memo-input")).toHaveValue("재고 정리");
  });

  it("AC-3[P0]: 존재하지 않는 id로 접근하면 빈 상태 안내와 목록 복귀 버튼만 렌더되고, 런타임 에러 없이 클릭 시 /records로 이동한다", () => {
    scenario.workplaces = [makeWorkplace({ id: "wp-1" })];
    scenario.records = [];

    expect(() => renderRecordEdit("no-such-id")).not.toThrow();

    expect(screen.getByText("기록을 찾을 수 없어요")).toBeInTheDocument();
    // 존재하지 않는 id에서는 편집 폼(저장 버튼)이 렌더되지 않는다 — 빈 상태 버튼만 존재.
    expect(screen.queryByRole("button", { name: "저장하기" })).not.toBeInTheDocument();

    const backButton = screen.getByRole("button", { name: "돌아가기" });
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith("/records");
  });

  it("AC-4a[P0]: editRecord가 QuotaExceededError를 throw하면 try/catch로 잡아 저장 공간 부족 Toast를 띄우고 /records로 이동하지 않는다(상태 롤백)", async () => {
    const wp = makeWorkplace({ id: "wp-1" });
    const existing = makeRecord({ id: "r-1", workplaceId: wp.id, memo: "" });
    scenario.workplaces = [wp];
    scenario.records = [existing];
    mockEditRecord.mockRejectedValueOnce(
      new DOMException("Quota exceeded", "QuotaExceededError")
    );

    renderRecordEdit("r-1");
    fireEvent.change(screen.getByTestId("record-memo-input"), { target: { value: "야근 확인" } });
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() =>
      expect(screen.getByText("저장 공간이 부족합니다. 오래된 기록을 삭제해주세요")).toBeInTheDocument()
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    // 롤백 확인: 사용자가 입력한 값은 화면에 그대로 남아 재시도 가능해야 한다.
    expect(screen.getByTestId("record-memo-input")).toHaveValue("야근 확인");
  });

  it("AC-4b[P0]: editRecord가 정상적으로 성공하면(quota 아님) Toast 없이 /records로 '저장했어요' 토스트와 함께 이동한다", async () => {
    const wp = makeWorkplace({ id: "wp-1" });
    const existing = makeRecord({ id: "r-1", workplaceId: wp.id, memo: "" });
    scenario.workplaces = [wp];
    scenario.records = [existing];

    renderRecordEdit("r-1");
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() => expect(mockEditRecord).toHaveBeenCalledTimes(1));
    expect(mockNavigate).toHaveBeenCalledWith("/records", { state: { toast: "저장했어요" } });
    expect(screen.queryByText("저장 공간이 부족합니다. 오래된 기록을 삭제해주세요")).not.toBeInTheDocument();
  });

  it("AC-5[P0]: 렌더된 화면은 Top(nav)·Card(record-preview)·전체폭 SubmitFooter로 구성되고 HEX 색상 하드코딩이 없다", () => {
    const wp = makeWorkplace({ id: "wp-1" });
    const existing = makeRecord({ id: "r-1", workplaceId: wp.id });
    scenario.workplaces = [wp];
    scenario.records = [existing];

    const { container } = renderRecordEdit("r-1");

    expect(container.querySelector('[role="navigation"]')).not.toBeNull();
    expect(screen.getByTestId("record-preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장하기" })).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(HEX_RE);
  });

  it("AC-6: RecordEdit 모듈은 콘솔 에러 없이 마운트/언마운트된다", () => {
    const wp = makeWorkplace({ id: "wp-1" });
    const existing = makeRecord({ id: "r-1", workplaceId: wp.id });
    scenario.workplaces = [wp];
    scenario.records = [existing];

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = renderRecordEdit("r-1");
    unmount();

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
