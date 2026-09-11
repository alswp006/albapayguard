
## 급여 계산 엔진 ② 주휴수당·최저임금·월 집계 — fix loop 2026-09-11T17:32:50.048Z
- 시도 횟수: 1
- 트리아지: trivial (no errors)
- 에러 변화:
  Attempt 1: initial errors — tsc:0|lint:5|test:0
- 비용: $0.1368
- 수정된 파일:
 .ai-factory/shared-context.md     |   8 ++-
 CLAUDE.md                         |   4 +-
 src/__tests__/packet-0006.test.ts |  28 ++++----
 src/lib/payrollMonthly.ts         | 147 ++++++++++++++++++++++++++++++++++++++
 4 files changed, 167 insertions(+), 20 deletions(-)


## 급여 상세 페이지 `/breakdown` — fix loop 2026-09-11T19:12:13.780Z
- 시도 횟수: 1
- 트리아지: moderate (triage fallback (LLM call failed))
- 에러 변화:
  Attempt 1: initial errors — tsc:12|lint:0|test:0
- 비용: $0.1599
- 수정된 파일:
 .ai-factory/shared-context.md      |  81 ++++++++++-
 e2e/visual-smoke.spec.ts           |  36 +++++
 src/__tests__/__helpers__/mocks.ts |  14 +-
 src/pages/Breakdown.tsx            | 283 ++++++++++++++++++++++++++++++++++++-
 tsconfig.json                      |   1 +
 5 files changed, 405 inserti
