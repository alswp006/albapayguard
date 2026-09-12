# Sprint Contract: 라우팅 공백 복구 — 미구현 페이지 플레이스홀더 배선

## 목표
App.tsx의 누락된 Route를 모두 채워 단독으로 `tsc --noEmit`·`npm run build`가 통과하게 한다.

## 만들 항목
| 파일 | 변경 내용 |
|------|---------|
| `src/pages/RecordNew.tsx` | ScreenScaffold + PageShell + Top + Paragraph.Text 플레이스홀더 (기존 파일 확인 후 없을 때만 생성) |
| `src/pages/RecordEdit.tsx` | 동일 |
| `src/pages/Workplace.tsx` | 동일 |
| `src/pages/WorkplaceForm.tsx` | 동일 |
| `src/pages/Onboarding.tsx` | 동일 |
| `src/pages/NotFound.tsx` | 동일 |
| `src/App.tsx` | `/record/new`, `/record/:id/edit`, `/workplace`, `/workplace/new`, `/workplace/:id/edit`, `/onboarding`, `path="*"` Route 추가 |

## 타입 (src/lib/types.ts import)
플레이스홀더는 타입을 사용하지 않음 — 최소 UI만 렌더.

## 검증 방법
1. `npx tsc --noEmit` — 0 errors
2. `npm run build` — 성공 (문법만 확인)
3. `console.error` → 0개
4. 기존 Route(/, /breakdown, /check, /check/result, /records) 변경 없음
5. FloatingTabBar 숨김: 폼 화면 규칙 있으면 경로만 추가

## 금지 사항
- `main.tsx` 수정
- HEX 색상 하드코딩 (var(--tds-*) 사용)
- raw `<div>` 골격 (ScreenScaffold 필수)
- 기존 파일 덮어쓰기
- dev 서버 실행
