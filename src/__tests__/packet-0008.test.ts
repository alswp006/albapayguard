import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Workplace, WorkRecord, PayCheck, AppSettings } from "@/lib/types";

// ── TDS mock (Toast/기타 컴포넌트가 jsdom에서 크래시하므로 필수) ──
import { mockTds } from "@/__tests__/__helpers__/mocks";
mockTds();

// ── react-router-dom: MemoryRouter는 실제 구현 유지, useNavigate만 대체 ──
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// ── @/lib/repository — 전 함수 목킹 (Provider가 호출하는 영속 계층) ──
const repoMocks = vi.hoisted(() => ({
  runMigration: vi.fn(),
  getWorkplaces: vi.fn(),
  getRecords: vi.fn(),
  getPayChecks: vi.fn(),
  getSettings: vi.fn(),
  saveWorkplace: vi.fn(),
  updateWorkplace: vi.fn(),
  deleteWorkplace: vi.fn(),
  saveRecord: vi.fn(),
  updateRecord: vi.fn(),
  deleteRecord: vi.fn(),
  upsertPayCheck: vi.fn(),
  patchSettings: vi.fn(),
}));
vi.mock("@/lib/repository", () => repoMocks);

// ── @/lib/storage — consumeCorruptionFlag만 목킹 ──
const storageMocks = vi.hoisted(() => ({
  consumeCorruptionFlag: vi.fn(() => false),
}));
vi.mock("@/lib/storage", () => storageMocks);

const WP1: Workplace = {
  id: "wp-1",
  name: "카페 알바",
  hourlyWage: 10320,
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
  hourlyWage: 10320,
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
  endTime: "15:00",
  breakMinutes: 30,
  isHoliday: false,
  memo: "",
  createdAt: "2026-01-06T00:00:00.000Z",
  updatedAt: "2026-01-06T00:00:00.000Z",
};

const PAY1: PayCheck = {
  id: "p-1",
  workplaceId: "wp-1",
  yearMonth: "2026-01",
  actualPaidAmount: 200000,
  calculatedGross: 250000,
  calculatedNet: 250000,
  diff: 50000,
  suspects: [],
  createdAt: "2026-01-31T00:00:00.000Z",
  updatedAt: "2026-01-31T00:00:00.000Z",
};

const PAY2: PayCheck = {
  id: "p-2",
  workplaceId: "wp-2",
  yearMonth: "2026-01",
  actualPaidAmount: 100000,
  calculatedGross: 100000,
  calculatedNet: 100000,
  diff: 0,
  suspects: [],
  createdAt: "2026-01-31T00:00:00.000Z",
  updatedAt: "2026-01-31T00:00:00.000Z",
};

const SETTINGS: AppSettings = {
  onboardingSeenAt: "2026-01-01T00:00:00.000Z",
  disclaimerAckAt: "2026-01-01T00:00:00.000Z",
  activeWorkplaceId: "wp-1",
  rewardUnlocks: {},
  schemaVersion: 1,
};

function Probe() {
  const {
    loading,
    workplaces,
    records,
    payChecks,
    addWorkplace,
    removeWorkplace,
  } = useAppData();

  return React.createElement(
    "div",
    null,
    React.createElement("span", { "data-testid": "loading" }, String(loading)),
    React.createElement("span", { "data-testid": "wp-count" }, String(workplaces.length)),
    React.createElement("span", { "data-testid": "rec-count" }, String(records.length)),
    React.createElement("span", { "data-testid": "pay-count" }, String(payChecks.length)),
    React.createElement(
      "span",
      { "data-testid": "wp-ids" },
      workplaces.map((w: Workplace) => w.id).join(","),
    ),
    React.createElement(
      "button",
      { "data-testid": "remove-wp1", onClick: () => removeWorkplace("wp-1") },
      "삭제",
    ),
    React.createElement(
      "button",
      {
        "data-testid": "add-wp",
        onClick: () => addWorkplace({ name: "새 알바", hourlyWage: 10320 }),
      },
      "추가",
    ),
  );
}

// Provider/hook은 아직 구현되지 않았다 — 동적 import로 red phase에서 모듈 미존재
// 에러를 명확히 드러낸다 (Coder가 구현하면 통과).
let AppDataProvider: any;
let useAppData: any;

function renderProbe() {
  return render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(AppDataProvider, null, React.createElement(Probe)),
    ),
  );
}

beforeEach(async () => {
  const providerModule = await import("@/providers/AppDataProvider");
  const hookModule = await import("@/hooks/useAppData");
  AppDataProvider = providerModule.AppDataProvider;
  useAppData = hookModule.useAppData;

  repoMocks.runMigration.mockResolvedValue(undefined);
  repoMocks.getWorkplaces.mockResolvedValue([WP1, WP2]);
  repoMocks.getRecords.mockResolvedValue([REC1, REC2]);
  repoMocks.getPayChecks.mockResolvedValue([PAY1, PAY2]);
  repoMocks.getSettings.mockResolvedValue(SETTINGS);
  storageMocks.consumeCorruptionFlag.mockReturnValue(false);
});

describe("상태 관리 — AppDataProvider (React Context)", () => {
  it("AC-1: loading은 초기 true였다가 로드 완료 후 false로 전환된다", async () => {
    renderProbe();

    expect(screen.getByTestId("loading").textContent).toBe("true");

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    expect(screen.getByTestId("wp-count").textContent).toBe("2");
    expect(screen.getByTestId("wp-ids").textContent).toBe("wp-1,wp-2");
  });

  it("AC-2[P0]: 여러 저장소 키가 동시에 손상돼도 경고 Toast는 정확히 1개만 렌더된다", async () => {
    storageMocks.consumeCorruptionFlag.mockReturnValue(true);

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    expect(screen.getAllByText("일부 데이터를 불러오지 못했어요")).toHaveLength(1);
  });

  it("AC-2[P0]: 손상이 없으면 경고 Toast가 렌더되지 않는다", async () => {
    storageMocks.consumeCorruptionFlag.mockReturnValue(false);

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    expect(screen.queryByText("일부 데이터를 불러오지 못했어요")).toBeNull();
  });

  it("AC-3[P0]: removeWorkplace 성공 시 workplaces/records/payChecks에서 연쇄 삭제된다", async () => {
    repoMocks.deleteWorkplace.mockResolvedValue({ ok: true });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    screen.getByTestId("remove-wp1").click();

    await waitFor(() => expect(screen.getByTestId("wp-count").textContent).toBe("1"));

    expect(screen.getByTestId("wp-ids").textContent).toBe("wp-2");
    expect(screen.getByTestId("rec-count").textContent).toBe("1");
    expect(screen.getByTestId("pay-count").textContent).toBe("1");
  });

  it("AC-3[P0]: removeWorkplace가 {ok:false}를 받으면 workplaces/records/payChecks가 삭제 전과 동일하게 롤백된다", async () => {
    repoMocks.deleteWorkplace.mockResolvedValue({ ok: false, reason: "unknown" });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    screen.getByTestId("remove-wp1").click();

    await waitFor(() => expect(repoMocks.deleteWorkplace).toHaveBeenCalledWith("wp-1"));

    expect(screen.getByTestId("wp-count").textContent).toBe("2");
    expect(screen.getByTestId("wp-ids").textContent).toBe("wp-1,wp-2");
    expect(screen.getByTestId("rec-count").textContent).toBe("2");
    expect(screen.getByTestId("pay-count").textContent).toBe("2");
  });

  it("AC-4[P0]: 쓰기 실패 reason==='quota'일 때 저장공간 부족 Toast를 표시하고 상태를 롤백한다", async () => {
    repoMocks.saveWorkplace.mockResolvedValue({ ok: false, reason: "quota" });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    screen.getByTestId("add-wp").click();

    await waitFor(() =>
      expect(
        screen.getAllByText("저장 공간이 부족합니다. 오래된 기록을 삭제해주세요"),
      ).toHaveLength(1),
    );

    expect(screen.getByTestId("wp-count").textContent).toBe("2");
  });

  it("AC-4[P0]: 쓰기가 성공하면 저장공간 부족 Toast 없이 상태가 정상 반영된다", async () => {
    repoMocks.saveWorkplace.mockResolvedValue({
      ok: true,
      id: "wp-3",
      name: "새 알바",
      hourlyWage: 10320,
      isFiveOrMore: false,
      payday: 25,
      taxType: "none",
      colorToken: "purple",
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    screen.getByTestId("add-wp").click();

    await waitFor(() => expect(screen.getByTestId("wp-count").textContent).toBe("3"));

    expect(screen.queryByText("저장 공간이 부족합니다. 오래된 기록을 삭제해주세요")).toBeNull();
  });

  it("AC-5: Provider로 감싼 더미 컴포넌트가 콘솔 에러·네트워크 호출 없이 렌더된다", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
