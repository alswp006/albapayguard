/**
 * Vitest setup — runs before each test file.
 *
 * Handles:
 *  - localStorage isolation between tests (prevents cross-test pollution)
 *  - requestAnimationFrame shim for jsdom (needed for animate/countup utilities)
 *  - sessionStorage isolation
 *  - console.error filtering (React Router warnings etc.)
 */

import { beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// ── @apps-in-toss/web-framework (SDK) ──
// 여기서 등록하는 이유(2026-09-12 실측): vi.mock 등록은 "나중에 등록한 쪽이 이긴다".
// 예전에는 이 팩토리가 __helpers__/mocks.ts 안에 hoisted vi.mock으로 있었는데, mocks.ts는
// 테스트 파일이 import하는 시점(=테스트 파일 자신의 vi.mock이 등록된 뒤)에 평가되므로
// 테스트가 직접 선언한 SDK mock을 **덮어써 무력화**했다(패킷 0018의 "throw하는 haptic mock"이
// 한 번도 호출되지 않는 형태로 드러남). setup 파일은 테스트 파일보다 먼저 실행되므로
// 여기 등록하면 기본 mock은 그대로 제공되면서 테스트 파일의 자체 mock이 정상적으로 우선한다.
// SDK는 imperative API만 있고(훅 없음), 콜백형 API는 테스트가 멈추지 않게 즉시 onEvent를 발화한다.
vi.mock("@apps-in-toss/web-framework", () => {
  const Storage = {
    setItem: vi.fn(async (k: string, v: string) => { localStorage.setItem(k, v); }),
    getItem: vi.fn(async (k: string) => localStorage.getItem(k)),
    removeItem: vi.fn(async (k: string) => { localStorage.removeItem(k); }),
    clearItems: vi.fn(async () => { localStorage.clear(); }),
  };

  const Analytics = {
    screen: vi.fn(async () => {}),
    impression: vi.fn(async () => {}),
    click: vi.fn(async () => {}),
  };

  const loadFullScreenAd = vi.fn((opts: { onEvent?: (e: unknown) => void }) => {
    setTimeout(() => opts.onEvent?.({ type: "loaded" }), 0);
  });
  const showFullScreenAd = vi.fn((opts: { onEvent?: (e: unknown) => void }) => {
    setTimeout(() => opts.onEvent?.({ type: "rewarded" }), 0);
  });

  const TossAds = {
    initialize: Object.assign(vi.fn(), { isSupported: () => true }),
    attachBanner: Object.assign(vi.fn(() => ({ destroy: vi.fn() })), { isSupported: () => true }),
    attach: Object.assign(vi.fn(), { isSupported: () => true }),
    destroy: Object.assign(vi.fn(), { isSupported: () => true }),
    destroyAll: Object.assign(vi.fn(), { isSupported: () => true }),
  };

  const createOneTimePurchaseOrder = vi.fn((opts: any) => {
    setTimeout(async () => {
      const granted = await opts.options.processProductGrant({ orderId: "test-order-1" });
      if (granted) {
        opts.onEvent?.({
          type: "success",
          data: {
            orderId: "test-order-1",
            displayName: "Test Product",
            displayAmount: "1,000원",
            amount: 1000,
            currency: "KRW",
            fraction: 0,
            miniAppIconUrl: null,
          },
        });
      }
    }, 0);
  });
  const createSubscriptionPurchaseOrder = vi.fn((opts: any) => {
    setTimeout(async () => {
      const granted = await opts.options.processProductGrant({
        orderId: "test-sub-1",
        subscriptionId: "test-sub",
      });
      if (granted) {
        opts.onEvent?.({
          type: "success",
          data: {
            orderId: "test-sub-1",
            displayName: "Test Subscription",
            displayAmount: "4,900원/월",
            amount: 4900,
            currency: "KRW",
            fraction: 0,
            miniAppIconUrl: null,
          },
        });
      }
    }, 0);
  });

  return {
    Storage,
    Analytics,

    generateHapticFeedback: vi.fn(),
    grantPromotionReward: vi.fn(async () => {}),
    getIsTossLoginIntegratedService: vi.fn(async () => false),

    loadFullScreenAd,
    showFullScreenAd,
    TossAds,

    createOneTimePurchaseOrder,
    createSubscriptionPurchaseOrder,
    IAP: {
      createOneTimePurchaseOrder: vi.fn((opts: any) => {
        createOneTimePurchaseOrder(opts);
        return () => {};
      }),
      createSubscriptionPurchaseOrder: vi.fn((opts: any) => {
        createSubscriptionPurchaseOrder(opts);
        return () => {};
      }),
    },

    share: vi.fn(async () => {}),
    setClipboardText: vi.fn(async () => {}),
    getClipboardText: vi.fn(async () => ""),
    requestReview: vi.fn(async () => {}),
    openURL: vi.fn(async () => {}),
    getPlatformOS: vi.fn(async () => "ios"),
    getNetworkStatus: vi.fn(async () => ({ connected: true, type: "wifi" })),
    getTossAppVersion: vi.fn(async () => "5.0.0"),
    getOperationalEnvironment: vi.fn(async () => "development"),
    getPermission: vi.fn(async () => ({ granted: true })),
    getSchemeUri: vi.fn(async () => "intoss://test-app"),
  };
});

// ── localStorage / sessionStorage isolation ──
// jsdom's storage persists between tests by default. Clear it to prevent pollution.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// ── requestAnimationFrame shim for jsdom ──
// jsdom does NOT implement rAF natively, so animate/countup code hangs forever.
// Shim that immediately invokes callback with a monotonic timestamp.
if (typeof globalThis.requestAnimationFrame !== "function") {
  let now = 0;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    now += 16;
    return setTimeout(() => cb(now), 0) as unknown as number;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof globalThis.cancelAnimationFrame;
}

// ── afterEach reset ──
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers(); // in case a test used fake timers
});
