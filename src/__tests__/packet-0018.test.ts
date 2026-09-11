/**
 * 광고·햅틱 헬퍼 컴포넌트 + 최종 UX 폴리시 (packet 0018)
 *
 * 대상 파일 (아직 미구현 — TDD red phase):
 * - src/components/MonthNav.tsx  — <MonthNav label onPrev onNext nextDisabled? />
 *   aria-label="이전 달" / "다음 달" 버튼, 각 44×44px 이상 터치 타깃, nextDisabled 지원
 * - src/components/LegalNotice.tsx — <LegalNotice /> — Paragraph.Text(st11)로
 *   "법정 기준 자동 계산 결과이며 법적 효력이 없습니다" 고지 (Breakdown/CheckResult와 동일 문구)
 * - src/hooks/useHaptic.ts — useHaptic() → { haptic(type: 'success' | 'tickWeak') }
 *   SDK가 없거나 throw해도 예외 전파 없이 무시(흰 화면 방지)
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent, renderHook } from "@testing-library/react";

import { mockTds } from "@/__tests__/__helpers__/mocks";
mockTds();

// @apps-in-toss/web-framework — generateHapticFeedback은 WebView 밖에서 throw한다
// (toss-mini-app.md: probe/호출이 false를 반환하는 게 아니라 예외를 던짐).
// useHaptic이 이 throw를 삼키는지가 AC-3의 핵심이라 여기서만 별도로 throw하는 mock을 쓴다.
const generateHapticFeedbackMock = vi.fn(() => {
  throw new Error("네이티브 브릿지 없음 (테스트 환경)");
});
vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: generateHapticFeedbackMock,
}));

import MonthNav from "@/components/MonthNav";
import LegalNotice from "@/components/LegalNotice";
import { useHaptic } from "@/hooks/useHaptic";

const NEW_FILES = [
  "src/components/MonthNav.tsx",
  "src/components/LegalNotice.tsx",
  "src/hooks/useHaptic.ts",
];

describe("광고·햅틱 헬퍼 컴포넌트 + 최종 UX 폴리시", () => {
  it("AC-1[P0]: MonthNav의 이전/다음 버튼은 각각 44×44px 이상의 실제 터치 영역을 갖는다", () => {
    render(
      React.createElement(MonthNav, {
        label: "2026년 1월",
        onPrev: vi.fn(),
        onNext: vi.fn(),
      }),
    );

    const prevBtn = screen.getByRole("button", { name: "이전 달" });
    const nextBtn = screen.getByRole("button", { name: "다음 달" });

    for (const btn of [prevBtn, nextBtn]) {
      const width = parseFloat(btn.style.minWidth || btn.style.width || "0");
      const height = parseFloat(btn.style.minHeight || btn.style.height || "0");
      expect(width).toBeGreaterThanOrEqual(44);
      expect(height).toBeGreaterThanOrEqual(44);
    }
  });

  it("AC-1: nextDisabled=true면 다음 버튼이 disabled되어 클릭해도 onNext가 호출되지 않고, 이전 버튼은 정상 동작한다", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      React.createElement(MonthNav, {
        label: "2026년 1월",
        onPrev,
        onNext,
        nextDisabled: true,
      }),
    );

    const prevBtn = screen.getByRole("button", { name: "이전 달" });
    const nextBtn = screen.getByRole("button", { name: "다음 달" });

    expect(nextBtn).toBeDisabled();
    fireEvent.click(nextBtn);
    expect(onNext).not.toHaveBeenCalled();

    fireEvent.click(prevBtn);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("AC-2[P0]: LegalNotice는 '법정 기준 자동 계산 결과이며 법적 효력이 없습니다'를 st11 타이포그래피로 정확히 렌더한다", () => {
    render(React.createElement(LegalNotice));

    const el = screen.getByText("법정 기준 자동 계산 결과이며 법적 효력이 없습니다");
    expect(el).toBeInTheDocument();
    expect(el.getAttribute("data-typography")).toBe("st11");
  });

  it("AC-3[P0]: haptic('success') 호출 시 SDK가 throw해도 예외가 전파되지 않고 console.error가 발생하지 않는다", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useHaptic());
    expect(() => result.current.haptic("success")).not.toThrow();
    expect(generateHapticFeedbackMock).toHaveBeenCalledWith({ type: "success" });
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("AC-3: haptic('tickWeak') 호출 시에도 동일하게 안전히 무시되고 console.error가 발생하지 않는다", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useHaptic());
    expect(() => result.current.haptic("tickWeak")).not.toThrow();
    expect(generateHapticFeedbackMock).toHaveBeenCalledWith({ type: "tickWeak" });
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("AC-4: 세 파일 어디에도 HEX 색상·Tailwind 여백 클래스·외부 UI 라이브러리 import가 없다", () => {
    for (const file of NEW_FILES) {
      const source = readFileSync(resolve(process.cwd(), file), "utf-8");
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/class(?:Name)?=["'][^"']*\b[pm]-\d+\b/);
      expect(source).not.toMatch(
        /from\s+["'](?:@mui|antd|@chakra-ui|@radix-ui|styled-components|bootstrap)/,
      );
    }
  });

  it("AC-5: 세 파일은 진입점(App.tsx/main.tsx)을 import하거나 수정 대상으로 참조하지 않는다", () => {
    for (const file of NEW_FILES) {
      const source = readFileSync(resolve(process.cwd(), file), "utf-8");
      expect(source).not.toMatch(/from\s+["']@\/App["']/);
      expect(source).not.toMatch(/from\s+["']@\/main["']/);
    }
  });
});
