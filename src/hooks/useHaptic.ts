import { useCallback } from 'react';

/** 이 앱에서 쓰는 햅틱 종류 — 주요 CTA는 success, 토글·월 이동 같은 가벼운 조작은 tickWeak */
export type HapticType = 'success' | 'tickWeak';

type HapticFn = (options: { type: HapticType }) => unknown;

let sdkHaptic: HapticFn | null = null;
let loading: Promise<void> | null = null;

/**
 * SDK를 지연 로드한다.
 *
 * 모듈 최상단 static import를 쓰지 않는 이유: 햅틱은 "있으면 좋은" 부가 기능이라
 * SDK 모듈 평가가 실패해도 이 훅을 쓰는 화면이 함께 죽으면 안 된다. 로드 실패는 조용히
 * 무시하고(진동 없이 동작) 다음 호출에서 다시 시도한다.
 */
function loadSdk(): Promise<void> {
  if (sdkHaptic != null) return Promise.resolve();
  if (loading != null) return loading;

  loading = import('@apps-in-toss/web-framework')
    .then((sdk) => {
      sdkHaptic = sdk.generateHapticFeedback as unknown as HapticFn;
    })
    .catch(() => {
      /* 브릿지/모듈 없음 — 햅틱 없이 동작 */
    })
    .finally(() => {
      loading = null;
    });

  return loading;
}

// 첫 탭보다 한참 앞서 준비를 끝내둔다 — 모듈 평가 직후(마이크로태스크)에 한 번,
// 그때 실패했으면 다음 태스크에 한 번 더. 로드를 렌더 경로에 두지 않는 게 핵심이다.
queueMicrotask(() => {
  void loadSdk();
});
setTimeout(() => {
  void loadSdk();
}, 0);

/**
 * 햅틱 피드백 래퍼.
 *
 * WebView 밖(로컬 브라우저·검수자 PC·jsdom)에는 네이티브 브릿지가 없어 SDK 호출이
 * false를 반환하는 게 아니라 **throw**한다. 그 예외가 이벤트 핸들러를 빠져나가면
 * React 트리가 통째로 언마운트돼 흰 화면이 된다 — 동기 throw와 거부된 Promise를
 * 모두 삼켜서 햅틱 실패가 화면에 영향을 주지 않게 한다. 에러 로깅도 남기지 않는다
 * (검수 기준: 콘솔 에러 0건).
 */
export function useHaptic() {
  const haptic = useCallback((type: HapticType) => {
    if (sdkHaptic == null) {
      void loadSdk();
      return;
    }
    try {
      const result = sdkHaptic({ type });
      if (result instanceof Promise) {
        result.catch(() => {});
      }
    } catch {
      /* 브릿지 없음 — 무시 */
    }
  }, []);

  return { haptic };
}

export default useHaptic;
