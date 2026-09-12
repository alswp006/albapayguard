/**
 * 근무지 화면 `/workplace`, `/workplace/new`, `/workplace/:id/edit` 실구현 강화 +
 * 경로-라우트 정합성 가드 (packet heal-2-03)
 *
 * App.tsx는 이미 이 경로들을 src/pages/Workplace.tsx · src/pages/WorkplaceForm.tsx로 라우팅한다
 * (@ai-factory:wiring-first, 수정 금지). 이 패킷은 그 화면들이 아래 계약을 만족하는지 확인한다:
 * - 목록은 Card 기반으로 위계를 만들고(raw ListRow 나열 금지), 빈 상태·최대 개수 제약을 노출한다.
 * - 등록/수정 폼은 한 컴포넌트에서 id 유무로 모드를 분기하고 기존 값을 채운다.
 * - name/hourlyWage/payday/taxType/colorToken 제약 위반 시 인라인 에러로 저장을 막는다.
 * - 근무지 삭제는 연쇄 삭제(기록/분석) + 활성 근무지 포인터 재지정을 그대로 수행한다.
 * - scripts/check-routes.mjs가 ROUTES에 없는 경로 리터럴을 잡아내는 빌드 전 가드로 존재한다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Workplace, WorkRecord, PayCheck } from "@/lib/types";

import { mockTds } from "@/__tests__/__helpers__/mocks";
mockTds();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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
const mockAddWorkplace = vi.fn<(input: Partial<Workplace>) => Promise<WriteResult<Workplace>>>();
const mockEditWorkplace = vi.fn<(id: string, patch: Partial<Workplace>) => Promise<WriteResult<Workplace>>>();
const mockRemoveWorkplace = vi.fn<(id: string) => Promise<{ ok: boolean; reason?: string }>>();

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

import Workplace from "@/pages/Workplace";
import WorkplaceForm from "@/pages/WorkplaceForm";
import { ROUTES, toWorkplaceEdit } from "@/routes";
import { MAX_WORKPLACES } from "@/lib/types";
import { validateWorkplace, deleteWorkplace } from "@/lib/repository";
import { STORAGE_KEYS } from "@/lib/types";

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

function renderWorkplaceList() {
  return render(
    React.createElement(MemoryRouter, { initialEntries: ["/workplace"] }, React.createElement(Workplace))
  );
}

function renderWorkplaceForm(initialPath: string) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: "/workplace/new", element: React.createElement(WorkplaceForm) }),
        React.createElement(Route, { path: "/workplace/:id/edit", element: React.createElement(WorkplaceForm) })
      )
    )
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
  mockAddWorkplace.mockImplementation(async (input) => ({
    ok: true,
    id: "wp-new",
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
    ...input,
  }) as WriteResult<Workplace>);
  mockEditWorkplace.mockImplementation(async (id, patch) => ({
    ok: true,
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
    ...patch,
  }) as WriteResult<Workplace>);
});

describe("근무지 화면 실구현 강화 + 경로-라우트 정합성 가드", () => {
  it("AC-1[P0]: 근무지 목록은 각 항목을 Card(testId=workplace-card)로 감싸 렌더하고, 행 클릭 시 toWorkplaceEdit(id)로 이동한다", () => {
    scenario.workplaces = [
      makeWorkplace({ id: "wp-1", name: "편의점" }),
      makeWorkplace({ id: "wp-2", name: "카페" }),
    ];

    renderWorkplaceList();

    const cards = screen.getAllByTestId("workplace-card");
    expect(cards).toHaveLength(2);

    const rows = screen.getAllByTestId("workplace-row");
    expect(rows).toHaveLength(2);
    fireEvent.click(rows[0]);
    expect(mockNavigate).toHaveBeenCalledWith(toWorkplaceEdit("wp-1"));
  });

  it("AC-1b[P0]: 근무지가 0개면 빈 상태 아이콘+등록 버튼을, 5개(MAX_WORKPLACES)면 등록 버튼 비활성+안내 문구를 보여준다", () => {
    scenario.workplaces = [];
    const { unmount } = renderWorkplaceList();
    expect(screen.getByRole("img", { name: /근무지/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /근무지 추가/ })).not.toBeDisabled();
    unmount();

    expect(MAX_WORKPLACES).toBe(5);
    scenario.workplaces = Array.from({ length: MAX_WORKPLACES }, (_, i) =>
      makeWorkplace({ id: `wp-${i}`, name: `근무지${i}` })
    );
    renderWorkplaceList();
    const addButton = screen.getByTestId("workplace-add-button");
    expect(addButton).toBeDisabled();
    expect(screen.getByText(/최대\s*5개/)).toBeInTheDocument();
  });

  it("AC-2[P0]-a: `/workplace/new`는 생성 모드로 렌더되어 빈 이름/시급과 기본 지급일(25일) 필드를 보여준다", () => {
    renderWorkplaceForm("/workplace/new");

    expect(screen.getAllByText("근무지 추가").length).toBeGreaterThan(0);
    expect(screen.getByTestId("workplace-name-input")).toHaveValue("");
    expect(screen.getByTestId("workplace-wage-input")).toHaveValue("");
    expect(screen.getByTestId("workplace-payday-input")).toHaveValue("25");
  });

  it("AC-2[P0]-b: `/workplace/:id/edit`는 수정 모드로 렌더되어 기존 근무지 값(이름/시급/지급일)으로 필드를 채운다", () => {
    scenario.workplaces = [
      makeWorkplace({ id: "wp-1", name: "스타벅스", hourlyWage: 12000, payday: 10, taxType: "freelance3_3" }),
    ];

    renderWorkplaceForm("/workplace/wp-1/edit");

    expect(screen.getAllByText("근무지 수정").length).toBeGreaterThan(0);
    expect(screen.getByTestId("workplace-name-input")).toHaveValue("스타벅스");
    expect(screen.getByTestId("workplace-wage-input")).toHaveValue("12000");
    expect(screen.getByTestId("workplace-payday-input")).toHaveValue("10");
  });

  it("AC-3[P0]: name(1~20자)·hourlyWage(1~1,000,000)·payday(1~31) 제약 위반은 인라인 에러로 저장을 막고, 모두 유효하면 저장된다", async () => {
    renderWorkplaceForm("/workplace/new");

    const nameInput = screen.getByTestId("workplace-name-input");
    const wageInput = screen.getByTestId("workplace-wage-input");
    const paydayInput = screen.getByTestId("workplace-payday-input");
    const saveButton = screen.getByRole("button", { name: "저장" });

    // 1) 이름 21자 초과 — 저장 차단
    fireEvent.change(nameInput, { target: { value: "가".repeat(21) } });
    fireEvent.change(wageInput, { target: { value: "10000" } });
    fireEvent.click(saveButton);
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert").map((el) => el.textContent ?? "");
      expect(alerts.some((t) => t.includes("20자"))).toBe(true);
    });
    expect(mockAddWorkplace).not.toHaveBeenCalled();

    // 2) 이름 정상화, 시급 1,000,000 초과 — 저장 차단
    fireEvent.change(nameInput, { target: { value: "정상 근무지" } });
    fireEvent.change(wageInput, { target: { value: "1000001" } });
    fireEvent.click(saveButton);
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert").map((el) => el.textContent ?? "");
      expect(alerts.some((t) => t.includes("1,000,000"))).toBe(true);
    });
    expect(mockAddWorkplace).not.toHaveBeenCalled();

    // 3) 시급 정상화, 지급일 범위(1~31) 밖 — 저장 차단
    fireEvent.change(wageInput, { target: { value: "10000" } });
    fireEvent.change(paydayInput, { target: { value: "32" } });
    fireEvent.click(saveButton);
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert").map((el) => el.textContent ?? "");
      expect(alerts.some((t) => t.includes("1~31") || t.includes("1일") || t.includes("31일"))).toBe(true);
    });
    expect(mockAddWorkplace).not.toHaveBeenCalled();

    // 4) 모두 유효 — 저장 성공
    fireEvent.change(paydayInput, { target: { value: "15" } });
    fireEvent.click(saveButton);
    await waitFor(() => expect(mockAddWorkplace).toHaveBeenCalledTimes(1));
    expect(mockAddWorkplace).toHaveBeenCalledWith(
      expect.objectContaining({ name: "정상 근무지", hourlyWage: 10000, payday: 15 })
    );
  });

  it("AC-3b[P0]: validateWorkplace는 name/hourlyWage/payday/taxType/colorToken 제약을 모두 검증한다", () => {
    const base = { name: "정상 근무지", hourlyWage: 10000, payday: 15, taxType: "none", colorToken: "blue" };
    const call = (overrides: Record<string, unknown>) =>
      validateWorkplace({ ...base, ...overrides } as unknown as Parameters<typeof validateWorkplace>[0]);

    const nameError = call({ name: "가".repeat(21) });
    expect(nameError).not.toBeNull();
    expect(nameError as string).toContain("20자");

    const wageError = call({ hourlyWage: 1_000_001 });
    expect(wageError).not.toBeNull();
    expect(wageError as string).toContain("1,000,000");

    expect(call({ hourlyWage: 10000.5 })).not.toBeNull();
    expect(call({ payday: 0 })).not.toBeNull();
    expect(call({ payday: 32 })).not.toBeNull();
    expect(call({ taxType: "bogus" })).not.toBeNull();
    expect(call({ colorToken: "red" })).not.toBeNull();
    expect(call({})).toBeNull();
  });

  it("AC-4[P0]: 근무지 삭제는 연결된 기록·분석을 함께 지우고, 활성 근무지였다면 남은 근무지 중 가장 오래된 createdAt으로 재지정한다", async () => {
    const wp1 = makeWorkplace({ id: "wp-1", createdAt: "2026-01-01T00:00:00.000Z" });
    const wp2 = makeWorkplace({ id: "wp-2", createdAt: "2026-02-01T00:00:00.000Z" });
    const wp3 = makeWorkplace({ id: "wp-3", createdAt: "2026-01-15T00:00:00.000Z" });
    localStorage.setItem(STORAGE_KEYS.WORKPLACES, JSON.stringify([wp1, wp2, wp3]));
    localStorage.setItem(
      STORAGE_KEYS.RECORDS,
      JSON.stringify([
        { id: "r-1", workplaceId: "wp-1", date: "2026-03-01", startTime: "09:00", endTime: "18:00", breakMinutes: 60, isHoliday: false, memo: "", createdAt: "x", updatedAt: "x" },
        { id: "r-2", workplaceId: "wp-2", date: "2026-03-01", startTime: "09:00", endTime: "18:00", breakMinutes: 60, isHoliday: false, memo: "", createdAt: "x", updatedAt: "x" },
      ])
    );
    localStorage.setItem(
      STORAGE_KEYS.PAYCHECKS,
      JSON.stringify([
        { id: "p-1", workplaceId: "wp-1", yearMonth: "2026-03", actualPaidAmount: 100, calculatedGross: 100, calculatedNet: 100, diff: 0, suspects: [], createdAt: "x", updatedAt: "x" },
      ])
    );
    localStorage.setItem(
      STORAGE_KEYS.SETTINGS,
      JSON.stringify({ onboardingSeenAt: "x", disclaimerAckAt: "x", activeWorkplaceId: "wp-1", rewardUnlocks: {}, schemaVersion: 1 })
    );

    const result = await deleteWorkplace("wp-1");
    expect(result.ok).toBe(true);

    const workplaces = JSON.parse(localStorage.getItem(STORAGE_KEYS.WORKPLACES) ?? "[]");
    expect(workplaces.map((w: Workplace) => w.id)).toEqual(["wp-2", "wp-3"]);

    const records = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECORDS) ?? "[]");
    expect(records).toHaveLength(1);
    expect(records[0].workplaceId).toBe("wp-2");

    const payChecks = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYCHECKS) ?? "[]");
    expect(payChecks).toHaveLength(0);

    const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) ?? "{}");
    expect(settings.activeWorkplaceId).toBe("wp-3"); // wp-3 createdAt(01-15)이 wp-2(02-01)보다 이르다
  });

  it("AC-5[P0]-a: scripts/check-routes.mjs는 node 내장 모듈만 사용하며, 현재 코드베이스(src)에 대해 0으로 종료하고 build 파이프라인에 연결돼 있다", () => {
    const scriptPath = path.join(ROOT, "scripts/check-routes.mjs");
    expect(fs.existsSync(scriptPath)).toBe(true);

    const source = fs.readFileSync(scriptPath, "utf-8");
    const importSpecifiers = [...source.matchAll(/(?:from|import)\s*\(?['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
    for (const spec of importSpecifiers) {
      expect(spec.startsWith("node:") || spec.startsWith(".") || spec.startsWith("/")).toBe(true);
    }

    const run = spawnSync(process.execPath, [scriptPath, "src"], { cwd: ROOT, encoding: "utf-8" });
    expect(run.status, `stdout:\n${run.stdout}\nstderr:\n${run.stderr}`).toBe(0);

    const pkg = JSON.parse(readSrcFile("package.json"));
    const wired = String(pkg.scripts?.prebuild ?? "") + String(pkg.scripts?.build ?? "");
    expect(wired).toMatch(/check-routes\.mjs/);
  });

  it("AC-5[P0]-b: scripts/check-routes.mjs는 ROUTES에 없는 경로 리터럴을 발견하면 non-zero로 종료한다", () => {
    const scriptPath = path.join(ROOT, "scripts/check-routes.mjs");
    const fixtureDir = path.join(ROOT, ".tmp-check-routes-fixture");
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(
      path.join(fixtureDir, "Bad.tsx"),
      "import { useNavigate } from 'react-router-dom';\n" +
        "export function Bad() {\n" +
        "  const navigate = useNavigate();\n" +
        "  navigate('/definitely-not-a-real-route');\n" +
        "  return null;\n" +
        "}\n"
    );

    try {
      const run = spawnSync(process.execPath, [scriptPath, ".tmp-check-routes-fixture"], {
        cwd: ROOT,
        encoding: "utf-8",
      });
      expect(run.status).not.toBe(0);
      expect(run.stdout + run.stderr).toContain("/definitely-not-a-real-route");
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it("AC-6: Workplace·WorkplaceForm 소스에 '준비 중'류 플레이스홀더 마커가 없다", () => {
    const listSource = readSrcFile("src/pages/Workplace.tsx");
    const formSource = readSrcFile("src/pages/WorkplaceForm.tsx");
    for (const src of [listSource, formSource]) {
      expect(src.includes("준비 중이에요")).toBe(false);
      expect(src.includes("@ai-factory:placeholder")).toBe(false);
    }
  });
});
