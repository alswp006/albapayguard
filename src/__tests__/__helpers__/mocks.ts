/**
 * Shared test mocks for Toss Mini App packets.
 *
 * Usage at the top of any test file:
 *   import { mockTds, mockAppsInToss, mockRouter } from "@/__tests__/__helpers__/mocks";
 *   mockTds();
 *   mockAppsInToss();
 *   mockRouter();
 *
 * Or use all at once:
 *   import { mockAll } from "@/__tests__/__helpers__/mocks";
 *   mockAll();
 */

import React from "react";
import { vi } from "vitest";

export const mockNavigate = vi.fn();
export const mockLocation = { pathname: "/", search: "", state: null, key: "default" };

// ── TDS (@toss/tds-mobile) ──
// TDS components use CSS-in-JS + layout hooks that crash in jsdom.
// Replace with lightweight DOM stand-ins that preserve prop-based testing.
export function mockTds() {
  vi.mock("@toss/tds-mobile", () => ({
    Button: ({ children, onClick, ...props }: any) =>
      React.createElement("button", { onClick, ...props }, children),

    // SubmitFooter(BottomCTA.tsx)의 기반 — 스텁이 없으면 SubmitFooter를 렌더하는 테스트가
    // undefined 엘리먼트로 죽는다(적대 리뷰 2026-08-30 실측). loading은 disabled로 표현해
    // "제출 중 비활성" 단언이 가능하게 한다.
    FixedBottomCTA: ({ children, onClick, disabled, loading, ...props }: any) =>
      React.createElement("button", { onClick, disabled: disabled || loading || undefined, "data-loading": loading ? "true" : undefined, ...props }, children),

    // 실제 TDS ListRow는 children이 아니라 contents/left/right prop으로 내용을 받는다(essential.txt
    // "❌ texts prop 없음 — contents prop 사용"). 이 prop들을 렌더하지 않으면 textContent가 항상 빈
    // 문자열이 되어 ListRow 내부 금액/라벨을 검증하는 모든 테스트가 거짓으로 통과·실패한다.
    ListRow: Object.assign(
      ({ children, contents, left, right, onClick, ...props }: any) =>
        React.createElement(
          "div",
          { onClick, role: "listitem", ...props },
          left,
          contents,
          children,
          right,
        ),
      {
        Text: ({ children }: any) => React.createElement("span", null, children),
        Texts: ({ top, bottom, type }: any) =>
          React.createElement(
            React.Fragment,
            null,
            React.createElement("span", { "data-type": type, "data-slot": "top" }, top),
            React.createElement("span", { "data-slot": "bottom" }, bottom),
          ),
      },
    ),

    Spacing: ({ size }: any) => React.createElement("div", { "data-spacing": size }),

    Paragraph: {
      Text: ({ children, typography, ...props }: any) =>
        React.createElement("span", { "data-typography": typography, ...props }, children),
    },

    Badge: ({ children }: any) => React.createElement("span", { role: "status" }, children),

    AlertDialog: Object.assign(
      ({ open, title, description, alertButton, onClose }: any) =>
        open
          ? React.createElement(
              "div",
              { role: "alertdialog", "aria-label": title },
              React.createElement("h2", null, title),
              React.createElement("p", null, description),
              alertButton,
              React.createElement("button", { onClick: onClose, "aria-label": "닫기" }, "닫기"),
            )
          : null,
      {
        AlertButton: ({ children, onClick }: any) =>
          React.createElement("button", { onClick }, children),
      },
    ),

    Toast: ({ open, text, position }: any) =>
      open
        ? React.createElement("div", { role: "status", "data-position": position }, text)
        : null,

    Tab: Object.assign(
      ({ children }: any) => React.createElement("div", { role: "tablist" }, children),
      {
        Item: ({ children, selected, onClick }: any) =>
          React.createElement(
            "button",
            { role: "tab", "aria-selected": selected, onClick },
            children,
          ),
      },
    ),

    // NOTE: TDS has NO "TabBar" export (hallucinated API). 하단 탭은 로컬
    // src/components/FloatingTabBar 를 쓰며, 그 컴포넌트는 TDS를 import하지 않아
    // 여기서 목킹할 필요가 없다(react-router/SDK 목만 있으면 jsdom에서 그대로 렌더).

    Asset: {
      Icon: ({ name, alt }: any) =>
        React.createElement("span", { "data-asset": name, role: "img", "aria-label": alt ?? name }),
      Image: ({ src, alt }: any) => React.createElement("img", { src, alt }),
      ContentIcon: ({ name, alt }: any) =>
        React.createElement("span", { "data-content-icon": name, role: "img", "aria-label": alt ?? name }),
      ContentImage: ({ src, alt }: any) => React.createElement("img", { src, alt }),
      Lottie: () => React.createElement("span", { "data-asset": "lottie" }),
      Text: ({ children }: any) => React.createElement("span", null, children),
      Video: () => React.createElement("span", { "data-asset": "video" }),
    },

    Skeleton: () => React.createElement("div", { "data-skeleton": "true", role: "presentation" }),

    Loader: () => React.createElement("div", { role: "progressbar" }),

    IconButton: ({ "aria-label": ariaLabel, name, onClick }: any) =>
      React.createElement("button", { "aria-label": ariaLabel, "data-icon": name, onClick }),

    TextButton: ({ children, onClick }: any) =>
      React.createElement("button", { onClick }, children),

    TextField: React.forwardRef(
      ({ label, help, hasError, variant, ...props }: any, ref: any) =>
        React.createElement(
          "div",
          null,
          React.createElement("label", null, label),
          React.createElement("input", { ref, "data-variant": variant, ...props }),
          hasError && help && React.createElement("span", { role: "alert" }, help),
        ),
    ),

    // title은 이미 Top.TitleParagraph(<h1>)로 넘어온다 — 여기서 한 번 더 <h1>로 감싸면
    // "<h1> cannot appear as a child of <h1>"(React의 console.error)가 모든 페이지 테스트에서
    // 났다. 콘솔 에러 0건을 단언하는 테스트가 React의 중복 경고 억제에 기대는 상태였다.
    Top: Object.assign(
      ({ children, title, right, upper, lower }: any) =>
        React.createElement("nav", { role: "navigation" }, upper, title, right, lower, children),
      {
        TitleParagraph: ({ children }: any) => React.createElement("h1", null, children),
      },
    ),

    // TopNavigation — 뒤로가기/우측 액션을 담는 상단 내비 바(Top의 큰 제목과 함께 쓴다).
    // leading/content/trailing 세 슬롯을 그대로 렌더해야 "뒤로" 버튼·우측 액션 단언이 동작한다.
    TopNavigation: ({ leading, content, trailing }: any) =>
      React.createElement("div", { "data-slot": "top-navigation" }, leading, content, trailing),

    TopNavigationBackButton: ({ "aria-label": ariaLabel, onClick }: any) =>
      React.createElement("button", { "aria-label": ariaLabel ?? "뒤로", onClick }),

    TopNavigationIconButton: ({ "aria-label": ariaLabel, name, onClick }: any) =>
      React.createElement("button", { "aria-label": ariaLabel, "data-icon": name, onClick }),

    TopNavigationTextButton: ({ children, onClick }: any) =>
      React.createElement("button", { onClick }, children),

    Border: () => React.createElement("hr"),

    BottomCTA: ({ children }: any) =>
      React.createElement("div", { "data-slot": "bottom-cta" }, children),

    BottomSheet: Object.assign(
      ({ children, open }: any) =>
        open ? React.createElement("div", { role: "dialog" }, children) : null,
      { Header: ({ children }: any) => React.createElement("div", null, children) },
    ),

    Chip: ({ children, selected, onClick }: any) =>
      React.createElement(
        "button",
        { role: "button", "aria-pressed": selected, onClick },
        children,
      ),

    Switch: ({ checked, onChange }: any) =>
      React.createElement("input", { type: "checkbox", checked, onChange, role: "switch" }),
  }));
}

// ── @apps-in-toss/web-framework ──
// 실제 등록은 vitest.setup.ts에 있다(모든 테스트 파일에 기본 적용). 여기서는 아무것도 하지 않는다.
//
// 왜 옮겼나(2026-09-12 실측): vi.mock 등록은 "나중에 등록한 쪽이 이긴다". 이 팩토리가
// mocks.ts 안의 hoisted vi.mock이던 시절엔, 테스트 파일이 mocks.ts를 import하는 순간
// (=테스트 파일 자신의 vi.mock이 등록된 뒤) 다시 등록되면서 **테스트가 직접 선언한 SDK mock을
// 덮어써 무력화**했다(패킷 0018: throw하는 haptic mock이 한 번도 호출되지 않음). setup 파일은
// 테스트 파일보다 먼저 실행되므로, 거기서 등록하면 기본 mock은 그대로 제공되면서 테스트 로컬
// mock이 정상적으로 우선한다.
//
// vi.doMock으로 바꾸는 것도 답이 아니다 — 비-hoisted라 나중의 동적 import에만 걸려서
// **두 번째 mock 인스턴스**가 생기고, 테스트가 static import로 잡아둔 스파이와 호출이 갈린다
// (패킷 0012의 haptic 호출 단언이 0건으로 떨어졌다).
export function mockAppsInToss() {
  // no-op — vitest.setup.ts가 이미 등록했다. 호출해도 해롭지 않도록 API만 유지한다.
}

// ── Toss Reward Ad Component ──
// TossRewardAd is a project-local component that wraps content behind ad viewing.
// In tests, render the children directly (ad always "watched").
// NOTE: uses vi.doMock (not vi.mock) deliberately — same reasoning as mockRouter below.
// A plain vi.mock(...) here would hoist to the top of this file and register the
// moment ANY test imports this module (even just mockTds()), silently auto-mocking
// TossRewardAd for tests that want the REAL component (e.g. reward-ad-gate scenarios)
// and never call mockTossRewardAd() themselves (observed 2026-09-12: made
// packet-0013's real-gate assertions permanently fail regardless of page correctness).
export function mockTossRewardAd() {
  vi.doMock("@/components/TossRewardAd", () => ({
    TossRewardAd: ({ children, onReward }: any) => {
      // Auto-trigger onReward in tests to unlock content
      if (onReward) setTimeout(onReward, 0);
      return children;
    },
    default: ({ children }: any) => children,
  }));
}

// ── react-router-dom ──
// Preserve actual router + override useNavigate for assertion.
//
// NOTE: uses vi.doMock (not vi.mock) deliberately. vi.mock calls are hoisted by Vitest
// to the top of whichever file they're *textually* in, regardless of function nesting —
// so a plain `vi.mock(...)` here would fire the moment any test imports this module
// (even just `mockTds`), registering a competing "react-router-dom" mock that clashes
// with any test-local custom router mock (observed 2026-09-12: silently made a page's
// own `vi.mock("react-router-dom", ...)` + `useNavigate` assertions inert). vi.doMock
// is intentionally NOT hoisted, so it only takes effect when this function actually runs.
export function mockRouter() {
  vi.doMock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
    return {
      ...actual,
      useNavigate: () => mockNavigate,
      useLocation: () => mockLocation,
    };
  });
}

// ── Convenience: mock everything ──
export function mockAll() {
  mockTds();
  mockAppsInToss();
  mockTossRewardAd();
  mockRouter();
}
