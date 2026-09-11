import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { STORAGE_KEYS, DEFAULT_SETTINGS, type AppSettings } from "@/lib/types";

// TDS + SDK mocks — NOT react-router-dom (we need real routing/redirect behavior
// for App.tsx integration tests: Navigate/useLocation must reflect actual navigation).
mockTds();
mockAppsInToss();

import App from "@/App";

// 이 패킷 시점에 App.tsx에 실제로 배선된 경로만 검증한다(스캐폴드가 이미 깐 골격).
// '/workplace/new' · '/workplace/:id'는 대응 화면 파일(WorkplaceForm.tsx)이 아직 없어
// App.tsx에 라우트가 없다 — 존재하지 않는 라우트를 요구하는 테스트는 여기서 만들지 않는다.

function seedSettings(overrides: Partial<AppSettings> = {}) {
  const settings: AppSettings = { ...DEFAULT_SETTINGS, ...overrides };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  return settings;
}

function renderApp(initialEntries: Array<string | { pathname: string; state?: unknown }>) {
  return render(
    React.createElement(MemoryRouter, { initialEntries }, React.createElement(App)),
  );
}

describe("라우팅 배선 + 전역 Provider (진입점 소유)", () => {
  describe("AC-1: 실속 화면 라우트가 흰 화면 없이 렌더된다", () => {
    it("AC-1[P0]: '/'는 온보딩 완료 시 Home을 렌더한다(빈 근무지 상태)", async () => {
      seedSettings({ onboardingSeenAt: "2026-09-01T00:00:00.000Z" });
      renderApp(["/"]);
      expect(await screen.findByText("등록된 근무지가 없어요")).toBeInTheDocument();
      expect(screen.queryByTestId("onboarding-step")).not.toBeInTheDocument();
    });

    it("AC-1: '/breakdown'은 Breakdown 페이지를 렌더한다", async () => {
      seedSettings({ onboardingSeenAt: "2026-09-01T00:00:00.000Z" });
      renderApp(["/breakdown"]);
      expect(await screen.findByTestId("breakdown-empty-workplace")).toBeInTheDocument();
      expect(screen.getByText("급여 상세")).toBeInTheDocument();
    });

    it("AC-1: '/check'는 Check 페이지를 렌더한다", async () => {
      seedSettings({ onboardingSeenAt: "2026-09-01T00:00:00.000Z" });
      renderApp(["/check"]);
      expect(await screen.findByTestId("check-empty-workplace")).toBeInTheDocument();
      expect(screen.getByText("미지급 분석")).toBeInTheDocument();
    });

    it("AC-1: '/check/result'는 유효한 state로 진입 시 크래시 없이 렌더한다", async () => {
      renderApp([
        {
          pathname: "/check/result",
          state: { workplaceId: "wp-1", yearMonth: "2026-09", actualPaidAmount: 1000000 },
        },
      ]);
      expect(await screen.findByTestId("check-result-error-card")).toBeInTheDocument();
    });

    it("AC-1: '/records'는 Records 페이지를 렌더한다", async () => {
      seedSettings({ onboardingSeenAt: "2026-09-01T00:00:00.000Z" });
      renderApp(["/records"]);
      expect(await screen.findByText("기록")).toBeInTheDocument();
      expect(screen.getByText("근무지를 추가하면 기록을 남길 수 있어요")).toBeInTheDocument();
    });

    it("AC-1: '/workplace'는 근무지 목록 페이지를 렌더한다", async () => {
      seedSettings({ onboardingSeenAt: "2026-09-01T00:00:00.000Z" });
      renderApp(["/workplace"]);
      expect(await screen.findByTestId("workplace-empty")).toBeInTheDocument();
    });

    it("AC-1: '/record/new'는 RecordForm(신규 작성)을 렌더한다", async () => {
      seedSettings({ onboardingSeenAt: "2026-09-01T00:00:00.000Z" });
      renderApp(["/record/new"]);
      expect(await screen.findByText("근무 기록")).toBeInTheDocument();
    });

    it("AC-1: '/record/:id/edit'는 존재하지 않는 기록에 대해 빈 상태를 렌더한다(크래시 없음)", async () => {
      seedSettings({ onboardingSeenAt: "2026-09-01T00:00:00.000Z" });
      renderApp(["/record/no-such-id/edit"]);
      expect(await screen.findByText("기록을 찾을 수 없어요")).toBeInTheDocument();
    });

    it("AC-1[P0]: 정의되지 않은 경로는 NotFound 자리 페이지를 렌더한다", async () => {
      renderApp(["/no-such-route-xyz"]);
      expect(await screen.findByTestId("placeholder-not-found")).toBeInTheDocument();
      expect(screen.getByText("404")).toBeInTheDocument();
    });
  });

  describe("AC-2: 온보딩 리다이렉트", () => {
    it("AC-2[P0]: onboardingSeenAt이 null이면 '/' 진입 시 '/onboarding'으로 이동한다", async () => {
      // seed 없이 렌더 → DEFAULT_SETTINGS.onboardingSeenAt === null
      renderApp(["/"]);
      expect(await screen.findByTestId("placeholder-onboarding")).toBeInTheDocument();
      expect(screen.queryByText("등록된 근무지가 없어요")).not.toBeInTheDocument();
    });

    it("AC-2[P0]: onboardingSeenAt이 있으면 '/'에서 리다이렉트가 발생하지 않는다", async () => {
      seedSettings({ onboardingSeenAt: "2026-09-01T00:00:00.000Z" });
      renderApp(["/"]);
      expect(await screen.findByText("등록된 근무지가 없어요")).toBeInTheDocument();
      expect(screen.queryByTestId("placeholder-onboarding")).not.toBeInTheDocument();
    });
  });

  describe("AC-3: FloatingTabBar 4탭 + 표시/숨김", () => {
    it("AC-3[P0]: 홈 화면에 홈·기록·분석·근무지 4탭이 표시된다", async () => {
      seedSettings({ onboardingSeenAt: "2026-09-01T00:00:00.000Z" });
      renderApp(["/"]);
      await screen.findByText("등록된 근무지가 없어요");
      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(4);
      expect(tabs.map((t) => t.getAttribute("aria-label"))).toEqual(
        expect.arrayContaining(["홈", "기록", "분석", "근무지"]),
      );
    });

    it("AC-3: 현재 경로에 해당하는 탭에 aria-selected=true가 붙는다", async () => {
      seedSettings({ onboardingSeenAt: "2026-09-01T00:00:00.000Z" });
      renderApp(["/records"]);
      await screen.findByText("근무지를 추가하면 기록을 남길 수 있어요");
      const recordsTab = screen.getByRole("tab", { name: "기록" });
      expect(recordsTab.getAttribute("aria-selected")).toBe("true");
      const homeTab = screen.getByRole("tab", { name: "홈" });
      expect(homeTab.getAttribute("aria-selected")).toBe("false");
    });

    it("AC-3: 탭 클릭 시 해당 경로로 실제 이동한다(홈 → 기록)", async () => {
      seedSettings({ onboardingSeenAt: "2026-09-01T00:00:00.000Z" });
      renderApp(["/"]);
      await screen.findByText("등록된 근무지가 없어요");
      fireEvent.click(screen.getByRole("tab", { name: "기록" }));
      expect(await screen.findByText("근무지를 추가하면 기록을 남길 수 있어요")).toBeInTheDocument();
    });

    it("AC-3: 온보딩 화면에서는 탭바가 숨겨진다", async () => {
      renderApp(["/"]); // seed 없음 → onboarding으로 리다이렉트
      await screen.findByTestId("placeholder-onboarding");
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });

    it("AC-3: 폼 화면('/record/new')에서는 탭바가 숨겨진다", async () => {
      seedSettings({ onboardingSeenAt: "2026-09-01T00:00:00.000Z" });
      renderApp(["/record/new"]);
      await screen.findByText("근무 기록");
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });
  });

  describe("AC-4: AppDataProvider가 라우터 내부 최상단에 1회만 마운트된다", () => {
    it("AC-4[P0]: 탭 이동으로 페이지가 바뀌어도(리마운트 없이) 각 페이지가 useAppData 호출에 성공한다", async () => {
      seedSettings({ onboardingSeenAt: "2026-09-01T00:00:00.000Z" });
      renderApp(["/"]);
      expect(await screen.findByText("등록된 근무지가 없어요")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: "기록" }));
      expect(await screen.findByText("근무지를 추가하면 기록을 남길 수 있어요")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: "근무지" }));
      expect(await screen.findByTestId("placeholder-workplace")).toBeInTheDocument();
    });
  });
});
