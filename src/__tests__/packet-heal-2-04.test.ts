/**
 * 기록 화면(`/record/new`, `/record/:id/edit`) — 빠져나갈 길 보장 (packet heal-2-04)
 *
 * App.tsx는 `/record/*`에서 하단 탭바를 숨긴다(SPEC S8). 그래서 이 두 화면에는
 * 저장·삭제 말고 화면을 떠날 방법이 헤더에 있어야 한다 — 없으면 막다른 길이 된다.
 * 이 파일이 고정하는 계약:
 * - 두 화면 모두 상단에 '뒤로'가 있고, 누르면 기록 목록(/records)으로 간다.
 * - 삭제는 수정 화면에만 있고(신규에는 지울 것이 없다), 확인 다이얼로그를 거친다.
 * - 헤더는 raw div 골격이 아니라 TDS TopNavigation + Top 조합이고 HEX 하드코딩이 없다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Workplace, WorkRecord } from "@/lib/types";

import { mockTds } from "@/__tests__/__helpers__/mocks";
mockTds();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

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
    editRecord: vi.fn(),
    removeRecord: vi.fn(async () => ({ ok: true })),
    savePayCheck: vi.fn(),
    setActiveWorkplace: vi.fn(),
    patchSettings: vi.fn(),
  }),
  useMonthlyPayroll: () => null,
}));

import RecordEdit from "@/pages/RecordEdit";
import RecordForm from "@/pages/RecordForm";

function makeWorkplace(id: string): Workplace {
  return {
    id,
    name: "편의점",
    hourlyWage: 10000,
    isFiveOrMore: false,
    payday: 25,
    taxType: "none",
    colorToken: "blue",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeRecord(id: string, workplaceId: string): WorkRecord {
  return {
    id,
    workplaceId,
    date: "2026-03-05",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    isHoliday: false,
    memo: "",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  };
}

function renderEdit(id: string) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/record/${id}/edit`] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: "/record/:id/edit", element: React.createElement(RecordEdit) }),
      ),
    ),
  );
}

function renderNew() {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/record/new"] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: "/record/new", element: React.createElement(RecordForm) }),
      ),
    ),
  );
}

beforeEach(() => {
  scenario.workplaces = [makeWorkplace("wp-1")];
  scenario.records = [makeRecord("r-1", "wp-1")];
  mockNavigate.mockClear();
});

describe("기록 화면 — 헤더 내비게이션(막다른 길 방지)", () => {
  it("AC-1[P0]: 기록 수정 화면 헤더의 '뒤로'를 누르면 기록 목록으로 나간다", () => {
    renderEdit("r-1");

    const back = screen.getByRole("button", { name: "뒤로" });
    fireEvent.click(back);

    expect(mockNavigate).toHaveBeenCalledWith("/records");
  });

  it("AC-2[P0]: 기록 입력 화면(/record/new)에도 '뒤로'가 있고, 지울 기록이 없으므로 삭제는 없다", () => {
    renderNew();

    expect(screen.getByRole("button", { name: "뒤로" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });

  it("AC-3[P0]: 수정 화면의 삭제는 헤더에 남아 있고 확인 다이얼로그를 거친다", () => {
    renderEdit("r-1");

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("기록을 삭제할까요");
    expect(screen.getByRole("button", { name: "삭제하기" })).toBeInTheDocument();
  });

  it("AC-4: 기록을 찾을 수 없는 화면에서도 목록으로 돌아가는 경로가 있다", () => {
    scenario.records = [];

    renderEdit("gone");

    fireEvent.click(screen.getByRole("button", { name: "돌아가기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/records");
  });

  it("AC-5: 헤더는 TDS TopNavigation + Top 조합이고 소스에 HEX 색상 하드코딩이 없다", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/pages/RecordForm.tsx"), "utf-8");

    expect(source).toContain("TopNavigation");
    expect(source).toContain("TopNavigationBackButton");
    // 헤더를 손수 flex div로 짜서 Top을 감싸던 골격은 제거됐다.
    expect(source).not.toMatch(/justifyContent:\s*'space-between'/);
    expect(source).not.toMatch(HEX_RE);
  });
});
