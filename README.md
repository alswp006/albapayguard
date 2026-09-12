# AlbaPayGuard

앱인토스 (Vite + React + TDS) 출퇴근 기록만으로 주휴수당까지 포함한 정확한 알바 급여를 자동 계산하고 미지급 여부를 체크해주는 앱 다수 알바생이 주휴수당 지급 조건(주 15시간 이상 등)을 몰라 정당한 급여를 받지 못하거나 실제 지급 명세서 검증이 어려움

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/Breakdown` | Breakdown |
| `/Check` | Check |
| `/CheckResult` | CheckResult |
| `/CheckResultAd` | CheckResultAd |
| `/CheckResultCore` | CheckResultCore |
| `/Home` | Home |
| `/NotFound` | NotFound |
| `/Onboarding` | Onboarding |
| `/RecordForm` | RecordForm |
| `/Records` | Records |
| `/Workplace` | Workplace |
| `/WorkplaceForm` | WorkplaceForm |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-09-12
