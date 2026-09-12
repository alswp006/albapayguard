🇰🇷 [English](./README.md)

# AlbaPayGuard

앱인토스(Vite + React + TDS)에서 출퇴근 기록만으로 주휴수당까지 포함한 정확한 알바 급여를 자동 계산하고 미지급 여부를 체크해주는 앱입니다. 많은 알바생이 주휴수당 지급 조건(주 15시간 이상 등)을 몰라 정당한 급여를 받지 못하거나 실제 지급 명세서 검증이 어려워하는 문제를 해결합니다.

## 기술 스택

- React 18.0.0
- TypeScript
- Vitest

## 라우트

| 경로 | 설명 |
|------|----------|
| `/Breakdown` | 급여 내역 |
| `/Check` | 미지급 여부 확인 |
| `/CheckResult` | 확인 결과 |
| `/CheckResultAd` | 확인 결과 (광고) |
| `/CheckResultCore` | 확인 결과 (핵심) |
| `/Home` | 홈 |
| `/NotFound` | 찾을 수 없음 |
| `/Onboarding` | 온보딩 |
| `/RecordForm` | 근무 기록 입력 |
| `/Records` | 근무 기록 목록 |
| `/Workplace` | 근무지 |
| `/WorkplaceForm` | 근무지 입력 |

## 시작하기

```bash
pnpm install
pnpm dev
```

## 개발

```bash
pnpm typecheck    # 타입 체킹
pnpm test         # 테스트 실행
pnpm build        # 프로덕션 빌드
```

## 설계 문서

`.ai-factory/` 디렉토리에서 전체 설계 문서를 확인할 수 있습니다:
- `prd.md` — 제품 요구사항 문서
- `spec.md` — 기술 명세서
- `task.md` — 에픽/태스크 분류

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-09-12
