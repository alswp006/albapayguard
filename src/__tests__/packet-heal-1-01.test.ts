/**
 * 라우팅 공백 복구 — 미구현 페이지 플레이스홀더 + App.tsx 전체 Route 배선 (packet heal-1-01)
 *
 * App.tsx는 이미 `@ai-factory:wiring-first`로 모든 라우트(/, /onboarding, /record/new,
 * /record/:id/edit, /records, /breakdown, /check, /check/result, /workplace,
 * /workplace/new, /workplace/:id, path="*")가 배선돼 있고, 대응 페이지 파일도 모두
 * 실제 구현으로 존재한다(플레이스홀더 아님). 이 테스트는 "라우팅 공백이 실제로 없다"는
 * 것을 회귀 방지 차원에서 고정한다 — App.tsx나 페이지 파일을 다시 건드리지 않게 막는 안전망.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
mockTds();
mockAppsInToss();

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// ── @/hooks/useAppData — 로딩 완료 + 온보딩 완료 상태로 고정(모든 라우트 렌더 확인용) ──
vi.mock("@/hooks/useAppData", () => ({
  useAppData: () => ({
    loading: false,
    workplaces: [],
    records: [],
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
    addRecord: vi.fn(),
    editRecord: vi.fn(),
    removeRecord: vi.fn(),
    savePayCheck: vi.fn(),
    setActiveWorkplace: vi.fn(),
    patchSettings: vi.fn(),
  }),
  useMonthlyPayroll: () => null,
}));

import App from "@/App";

function renderRoute(path: string) {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(App)),
  );
}

describe("라우팅 공백 복구 — App.tsx 전체 Route 배선", () => {
  it("AC-1[P0]: src/App.tsx, src/pages/{Workplace,WorkplaceForm,Onboarding,NotFound,RecordForm}.tsx가 모두 실제 파일로 존재한다", () => {
    const root = path.resolve(__dirname, "..", "..");
    const files = [
      "src/App.tsx",
      "src/pages/Workplace.tsx",
      "src/pages/WorkplaceForm.tsx",
      "src/pages/Onboarding.tsx",
      "src/pages/NotFound.tsx",
      "src/pages/RecordForm.tsx",
    ];
    for (const f of files) {
      expect(fs.existsSync(path.join(root, f)), `${f} should exist`).toBe(true);
    }
    expect(files).toHaveLength(6);
  });

  it("AC-2[P0]: 코드베이스의 모든 navigate() 대상 경로가 App.tsx의 Route path와 매칭된다(누락 0건)", () => {
    const root = path.resolve(__dirname, "..", "..");
    const srcDir = path.join(root, "src");

    function collectFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries.flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectFiles(full);
        if (/\.(tsx|ts)$/.test(entry.name)) return [full];
        return [];
      });
    }

    const navigateTargets = new Set<string>();
    for (const file of collectFiles(srcDir)) {
      const content = fs.readFileSync(file, "utf-8");
      const regex = /navigate\(\s*[`'"]([^`'"]*)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content))) {
        // 동적 세그먼트(${id} 등)는 :param 패턴으로 정규화
        const normalized = match[1].replace(/\$\{[^}]+\}/g, ":id");
        navigateTargets.add(normalized);
      }
    }

    // App.tsx가 실제로 정의한 정적 Route path 목록
    const definedRoutes = new Set([
      "/",
      "/onboarding",
      "/record/new",
      "/record/:id/edit",
      "/records",
      "/breakdown",
      "/check",
      "/check/result",
      "/workplace",
      "/workplace/new",
      "/workplace/:id",
      "*",
    ]);

    expect(navigateTargets.size).toBeGreaterThan(0);
    for (const target of navigateTargets) {
      const matches = definedRoutes.has(target);
      expect(matches, `navigate target "${target}" has no matching Route`).toBe(true);
    }
  });

  it("AC-2[P0]: App.tsx 소스에 필수 Route path가 모두 선언돼 있다", () => {
    const root = path.resolve(__dirname, "..", "..");
    const appSource = fs.readFileSync(path.join(root, "src/App.tsx"), "utf-8");
    const requiredPaths = [
      '"/record/new"',
      '"/record/:id/edit"',
      '"/workplace"',
      '"/workplace/new"',
      '"/workplace/:id"',
      '"/onboarding"',
      'path="*"',
    ];
    for (const p of requiredPaths) {
      expect(appSource.includes(p), `App.tsx should declare Route ${p}`).toBe(true);
    }
    expect(requiredPaths.length).toBe(7);
  });

  it.each([
    ["/onboarding"],
    ["/workplace"],
    ["/workplace/new"],
    ["/workplace/abc"],
    ["/record/new"],
    ["/record/abc/edit"],
    ["/unknown-route-xyz"],
  ])("AC-3[P0]: %s 경로가 크래시 없이 렌더되고 화면 골격(TDS Top)을 갖는다", (route) => {
    renderRoute(route);
    // ScreenScaffold + TDS Top mock은 role="navigation"인 <nav>로 렌더된다.
    expect(screen.getAllByRole("navigation").length).toBeGreaterThanOrEqual(1);
    expect(document.body.textContent).not.toBe("");
  });

  it("AC-3: /unknown-route-xyz는 NotFound로 떨어지며 홈으로 돌아갈 CTA를 제공한다(막다른 길 금지)", () => {
    renderRoute("/unknown-route-xyz");
    expect(screen.getAllByText("페이지를 찾을 수 없어요").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "홈으로 가기" })).toBeInTheDocument();
  });

  it("AC-4: merge된 페이지 파일(Workplace/Onboarding/NotFound/RecordForm)이 '준비 중' 플레이스홀더 텍스트를 포함하지 않는다(내용 교체 금지 확인)", () => {
    const root = path.resolve(__dirname, "..", "..");
    const files = [
      "src/pages/Workplace.tsx",
      "src/pages/WorkplaceForm.tsx",
      "src/pages/Onboarding.tsx",
      "src/pages/NotFound.tsx",
      "src/pages/RecordForm.tsx",
    ];
    for (const f of files) {
      const content = fs.readFileSync(path.join(root, f), "utf-8");
      expect(content.includes("준비 중이에요"), `${f} must not be a placeholder`).toBe(false);
      expect(content.includes("@ai-factory:placeholder"), `${f} must not carry placeholder marker`).toBe(
        false,
      );
    }
  });
});
