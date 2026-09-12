import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright 비주얼 스펙은 e2e/에 있다 — vitest 실행에서 제외(기본 제외 + e2e).
    // scripts/__tests__는 node:test 기반(node --test)이라 vitest 대상에서 제외.
    // .ai-factory/qa-pack/scenarios는 Playwright 기반 QA 스펙(파이프라인 소유, 수정 금지) — vitest 대상에서 제외.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'scripts/**', '.ai-factory/**'],
    // 워커 폭발 방지(실사고 2026-07-21 global OOM/exit 137): vitest 기본은 CPU 코어 수만큼
    // 포크를 띄운다(16스레드 머신=최대 16개, 각 수백 MB) → jsdom 로드까지 겹쳐 WSL 총 메모리
    // 소진. 미니앱은 테스트 파일이 3~5개라 2포크로 충분하고 메모리를 8배 이상 줄인다.
    pool: 'forks',
    poolOptions: { forks: { minForks: 1, maxForks: 2 } },
    // 파일 병렬 실행 금지 — 2포크로 동시에 돌리면 packet-heal-2-01의 "모든 페이지 모듈
    // 동적 import" 테스트가 3회 중 2회쯤 `Cannot read properties of undefined (reading
    // 'getStatus')`로 무작위 실패한다(포크 간 경합; 스택 없는 워커 레벨 에러라 소스 추적 불가).
    // 순차 실행이면 287개 전부 통과하고 전체 7~9초라 비용도 없다 — 게이트를 무작위로 붉히는
    // 편이 훨씬 비싸다.
    fileParallelism: false,
  },
});
