/**
 * 기록 수정 화면 `/record/:id/edit` — 근무지 필드 계약.
 *
 * 수정 폼은 날짜·시각·휴게·휴일·메모만 보여주고 **근무지는 화면에 없었다**. 예상 일급은
 * 근무지 시급으로 계산되므로, 무엇으로 계산 중인지 보이지 않으면 사용자는 금액의 근거를
 * 알 수 없고 잘못된 근무지로 기록된 항목을 고칠 방법도 없다. 이 파일이 그 계약을 고정한다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Workplace, WorkRecord } from "@/lib/types";

import { mockTds } from "@/__tests__/__helpers__/mocks";
mockTds();

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

const mockEditRecord = vi.fn();
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
    removeRecord: vi.fn(),
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
  mockEditRecord.mockResolvedValue({ ok: true });
});

describe("기록 수정 화면 — 근무지 필드", () => {
  it("기록이 속한 근무지 이름과 시급이 초기값으로 보인다", () => {
    scenario.workplaces = [makeWorkplace({ id: "wp-1", name: "카페 알바", hourlyWage: 11000 })];
    scenario.records = [makeRecord({ id: "r-1", workplaceId: "wp-1" })];

    renderRecordEdit("r-1");

    expect(screen.getByText("근무지")).toBeInTheDocument();
    expect(screen.getByText("카페 알바 · 시급 11,000원")).toBeInTheDocument();
  });

  it("근무지가 2곳 이상이면 칩으로 전환할 수 있고, 바꾼 근무지로 저장된다", async () => {
    scenario.workplaces = [
      makeWorkplace({ id: "wp-1", name: "카페 알바", hourlyWage: 11000 }),
      makeWorkplace({ id: "wp-2", name: "편의점 야간", hourlyWage: 13000 }),
    ];
    scenario.records = [makeRecord({ id: "r-1", workplaceId: "wp-1" })];

    renderRecordEdit("r-1");

    expect(screen.getByTestId("record-workplace-chip-wp-1")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("record-workplace-chip-wp-2"));

    expect(screen.getByText("편의점 야간 · 시급 13,000원")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));
    await waitFor(() => expect(mockEditRecord).toHaveBeenCalledTimes(1));
    expect(mockEditRecord).toHaveBeenCalledWith("r-1", expect.objectContaining({ workplaceId: "wp-2" }));
  });

  it("근무지가 1곳뿐이면 전환 칩을 띄우지 않는다", () => {
    scenario.workplaces = [makeWorkplace({ id: "wp-1" })];
    scenario.records = [makeRecord({ id: "r-1", workplaceId: "wp-1" })];

    renderRecordEdit("r-1");

    expect(screen.queryByTestId("record-workplace-chips")).not.toBeInTheDocument();
  });
});
