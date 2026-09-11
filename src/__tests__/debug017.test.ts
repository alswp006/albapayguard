import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { STORAGE_KEYS, DEFAULT_SETTINGS } from "@/lib/types";
mockTds();
mockAppsInToss();
import App from "@/App";

// 라우팅 배선 스모크 — 폼 경로는 탭바 없이 페이지 본문만 렌더된다.
describe("App 라우팅 스모크", () => {
  it("'/record/new'는 탭바 없이 기록 폼을 렌더한다", async () => {
    localStorage.setItem(
      STORAGE_KEYS.SETTINGS,
      JSON.stringify({ ...DEFAULT_SETTINGS, onboardingSeenAt: "2026-09-01T00:00:00.000Z" }),
    );
    render(
      React.createElement(MemoryRouter, { initialEntries: ["/record/new"] }, React.createElement(App)),
    );
    expect(await screen.findByText("근무 기록")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});
