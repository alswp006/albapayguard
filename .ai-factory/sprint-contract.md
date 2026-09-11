# Sprint Contract — 광고·햅틱 헬퍼 + 최종 UX 폴리시

## 목표
하단 탭 네비게이션, 법정 고지, 햅틱 래퍼를 통합하여 결과·데이터 화면의 UX를 완성.

## 만들 항목
| 파일 | 변경 내용 |
|------|---------|
| `src/components/MonthNav.tsx` | 월 네비게이션: ‹/› 각 44×44px, `monthKey`·`onPrev`·`onNext`·`nextDisabled` props |
| `src/components/LegalNotice.tsx` | 법정 고지 텍스트 컴포넌트: '법정 기준 자동 계산 결과이며 법적 효력이 없습니다' |
| `src/hooks/useHaptic.ts` | SDK `generateHapticFeedback` 래퍼: `success` / `tickWeak` type, try/catch 가드 |
| 결과·데이터 화면 | MonthNav·LegalNotice·useHaptic 재사용 통합 |

## 타입 (src/lib/types.ts import)
기존 타입만 사용: `WorkRecord`, `PayCheck`, `PaySuspect` 등. 신규 타입 정의 불필요.

## 검증 방법
1. `npx tsc --noEmit` — 타입 체크 통과
2. `npx vitest run` — 유닛 테스트 통과 (존재 시)
3. `npm run test:visual` — 비주얼 스모크 통과, e2e/__shots__ 확인 (입력칸/탭/CTA 렌더)
4. 수동 확인: 월 네비 ‹/› 44×44 터치 타깃, LegalNotice 텍스트 렌더, 햅틱 try/catch 가드 존재

## 금지 사항
- App.tsx / main.tsx 수정 금지
- 새로운 라우트·Provider 추가 금지
- SDK 가드 없는 generateHapticFeedback 호출 금지
