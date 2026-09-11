/**
 * [부가] 온보딩 `/onboarding` · 404 페이지 (packet 0016)
 *
 * Onboarding.tsx(3단계 소개 → '시작하기' 시 onboardingSeenAt 저장 후 '/workplace/new'로
 * replace 이동)와 NotFound.tsx(존재하지 않는 경로 안내 + 홈으로 이동 Button)가 강제하는 계약:
 * - data-testid="onboarding-step" 요소는 항상 정확히 1개이며, 그 안의 단계 Chip을 눌러도
 *   아무 네비게이션도 일어나지 않는다(표시 전용).
 * - '시작하기' 탭 시 apg:settings:v1의 onboardingSeenAt이 ISO8601 문자열로 저장된다.
 * - navigate는 '/workplace/new'를 { replace: true }로 호출한다(뒤로가기로 /onboarding 복귀 방지).
 * - 1차 액션 버튼은 정확히 1개이고 button 중첩이 없다(SubmitFooter/FixedBottomCTA 기반, 전체폭).
 * - NotFound는 EmptyState(data-testid="notfound-empty") + '홈으로 가기' Button을 렌더하고,
 *   탭 시 navigate('/', { replace: true })가 호출된다.
 * - 렌더된 HTML에 인라인 HEX 색상 리터럴, Tailwind 여백 유틸(p-, m- 접두) 클래스가 없다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { mockTds } from "@/__tests__/__helpers__/mocks";
mockTds();

// ── react-router-dom: 실제 MemoryRouter 유지, useNavigate만 대체 ──
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

import { AppDataProvider } from "@/providers/AppDataProvider";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/NotFound";

const ISO8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const TAILWIND_SPACING_RE = /(^|\s)(p|m)[trblxy]?-\d/;

function renderOnboarding() {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/onboarding"] },
      React.createElement(AppDataProvider, null, React.createElement(Onboarding))
    )
  );
}

function renderNotFound() {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/no-such-route"] },
      React.createElement(NotFound)
    )
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
});

describe("[부가] 온보딩 `/onboarding` · 404 페이지", () => {
  it("AC-1[P0]: onboarding-step은 항상 1개이고, 단계 Chip을 눌러도 네비게이션이 일어나지 않는다", () => {
    renderOnboarding();

    const stepEls = screen.getAllByTestId("onboarding-step");
    expect(stepEls).toHaveLength(1);

    const chips = within(stepEls[0]).queryAllByRole("button");
    chips.forEach((chip) => fireEvent.click(chip));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getAllByTestId("onboarding-step")).toHaveLength(1);
  });

  it("AC-2[P0]: '시작하기' 탭 시 apg:settings:v1의 onboardingSeenAt이 ISO8601 문자열로 저장된다", async () => {
    renderOnboarding();

    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

    await waitFor(() => {
      const raw = localStorage.getItem("apg:settings:v1");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw as string);
      expect(typeof parsed.onboardingSeenAt).toBe("string");
      expect(parsed.onboardingSeenAt).toMatch(ISO8601_RE);
    });
  });

  it("AC-3[P0]: '시작하기' 탭 시 navigate가 '/workplace/new'를 replace:true로 호출한다", async () => {
    renderOnboarding();

    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/workplace/new", { replace: true });
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("AC-4: 1차 액션 버튼이 정확히 1개이고 button 중첩이 없다", () => {
    const { container } = renderOnboarding();

    const ctaButton = screen.getByRole("button", { name: "시작하기" });
    expect(ctaButton.tagName).toBe("BUTTON");
    expect(container.querySelector("button button")).toBeNull();

    const allButtons = container.querySelectorAll("button");
    const primaryButtons = Array.from(allButtons).filter((b) => b.textContent === "시작하기");
    expect(primaryButtons).toHaveLength(1);
  });

  it("AC-5[P0]: NotFound는 EmptyState + '홈으로 가기' Button을 렌더하고 탭 시 navigate('/', {replace:true})가 호출된다", () => {
    renderNotFound();

    const emptyState = screen.getByTestId("notfound-empty");
    expect(emptyState).toBeInTheDocument();

    const homeButton = screen.getByRole("button", { name: "홈으로 가기" });
    fireEvent.click(homeButton);

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("AC-5b: NotFound의 '홈으로 가기' 버튼도 button 중첩이 없다", () => {
    const { container } = renderNotFound();

    expect(container.querySelector("button button")).toBeNull();
    expect(screen.getAllByRole("button", { name: "홈으로 가기" })).toHaveLength(1);
  });

  it("AC-6: 렌더된 HTML에 HEX 색상 리터럴과 Tailwind p-*/m-* 클래스가 없다", () => {
    const { container: onboardingContainer } = renderOnboarding();
    expect(onboardingContainer.innerHTML).not.toMatch(HEX_RE);
    onboardingContainer.querySelectorAll("[class]").forEach((el) => {
      expect(el.getAttribute("class") ?? "").not.toMatch(TAILWIND_SPACING_RE);
    });

    const { container: notFoundContainer } = renderNotFound();
    expect(notFoundContainer.innerHTML).not.toMatch(HEX_RE);
    notFoundContainer.querySelectorAll("[class]").forEach((el) => {
      expect(el.getAttribute("class") ?? "").not.toMatch(TAILWIND_SPACING_RE);
    });
  });
});
