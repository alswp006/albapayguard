# SPEC — AlbaPayGuard

> 출퇴근 기록만으로 주휴수당·가산수당까지 포함한 정확한 알바 급여를 자동 계산하고, 실지급액과 비교해 미지급 여부를 분석해주는 앱인토스 미니앱.

---

## Common Principles

### 기술 스택 / 제약
- **빌드**: Vite + React 18 + TypeScript (strict)
- **UI**: `@toss/tds-mobile` 전용. shadcn/ui, MUI, Ant Design, Chakra 사용 금지
- **라우팅**: `react-router-dom` (BrowserRouter, 클라이언트 라우팅만)
- **저장소**: localStorage only. 서버/DB 없음. 외부 API 호출 없음
- **인증**: 토스 앱이 세션을 자동 제공. 로그인 함수 호출 없음. 사용자 식별 필요 시 `getIsTossLoginIntegratedService()`로 연동 여부만 확인
- **광고**: 템플릿 제공 `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`(배너), `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>{children}</TossRewardAd>`(리워드 게이트)
- **결제**: 본 MVP에서 IAP 미사용 (수익모델 = 광고 단독)
- **프로모션**: 본 MVP에서 `grantPromotionReward` 미사용. 향후 사용 시 `amount ≤ 5000` 강제

### 레이아웃 공통 계약 (모든 화면 필수)
- 모든 페이지는 템플릿 제공 `ScreenScaffold`(= PageShell)로 감싼다. raw `<div>` 골격 금지
- 페이지 제목은 TDS `Top`, 본문 텍스트는 TDS `Paragraph.Text` / `Typography`
- 1차 액션(저장/계산/분석하기)은 하단 고정 `SubmitFooter` 또는 `display="block"` TDS Button. 좌측 글자폭 버튼 금지
- 핵심 정보(급여 결과·비교·지표)는 TDS `Card`로 묶어 위계를 표현. 맨 div 나열 금지
- 간격은 TDS `Spacing`(size prop 필수)만 사용. TDS 컴포넌트에 Tailwind/인라인 padding·margin 덮어쓰기 금지
- 커스텀 CSS는 TDS가 제공하지 않는 flex/grid 배치에만 허용
- 색상은 `var(--tds-color-*)` CSS 변수 또는 TDS 컴포넌트 기본값만. HEX 하드코딩(`#FFFFFF`, `#333`) 금지 (다크모드 필수)
- 모든 인터랙티브 요소의 터치 타깃 ≥ 44×44px
- 표현 풍부함: 데이터/결과 화면(홈, 급여 상세, 분석 결과)에 한해 `SummaryHero`(CountUp 히어로), `Sparkline`(추이), `MiniBar`(비중), 빈 상태 `Asset.ContentIcon` 사용. 단순 입력/설정 화면은 생략

### 계산 규칙 (전 기능 공통 · 근로기준법 기준)
| 항목 | 규칙 |
|---|---|
| 주 단위 | 월요일 00:00 ~ 일요일 23:59 (ISO week, 월요일 시작) |
| 주휴수당 월 귀속 | 해당 주의 **월요일이 속한 년월**에 귀속 |
| 휴게시간 | 사용자 입력값 우선. 미입력 시 자동: 근무 4h 이상 → 30분, 8h 이상 → 60분 |
| 실근로시간 | `(endTime - startTime) - breakMinutes`. endTime ≤ startTime이면 익일 퇴근으로 간주(+24h) |
| 기본급 | `실근로시간 × 시급` |
| 야간가산 | 22:00~06:00 구간 근로시간 × 시급 × 0.5 |
| 연장가산 | (1일 8h 초과분 + 주 40h 초과분, 중복 제외) × 시급 × 0.5 |
| 휴일가산 | `isHoliday=true` 근무일: 8h 이내분 × 0.5, 8h 초과분 × 1.0 |
| 5인 미만 사업장 | `isFiveOrMore=false`이면 야간·연장·휴일 가산 **0원** (기본급만) |
| 주휴수당 | 주 실근로시간 ≥ 15h 이면 `min(주 실근로시간, 40) / 5 × 시급`. 15h 미만이면 0원 |
| 최저임금 | `MINIMUM_WAGE_BY_YEAR = { 2025: 10030, 2026: 10320 }`. 기록 날짜의 연도 기준 |
| 반올림 | 각 항목 계산 후 `Math.floor`(원 단위 절사) → 절사된 값들을 합산 |
| 세금 옵션 | `taxType: 'none' \| 'freelance3_3'`. `freelance3_3`이면 `net = Math.floor(gross × 0.967)` |

### 에러/정책 공통
- 모든 localStorage 쓰기는 try/catch. `QuotaExceededError` 발생 시 TDS Toast `"저장 공간이 부족합니다. 오래된 기록을 삭제해주세요"` 표시 후 상태 롤백
- 외부 도메인 이탈(`window.location.href`, `window.open`) 사용 금지. 유일 예외: 고용노동부 임금체불 신고 페이지(공공기관) — 이 경우에도 MVP에서는 **링크 대신 안내 텍스트만** 노출
- 외부 분석 솔루션(GA, Amplitude 등) 도입 금지
- 프로덕션 빌드에서 `console.error` 0건
- Android 7+ / iOS 16+ 호환. `Array.prototype.at`, `Object.groupBy`, `structuredClone`, `Intl.Segmenter` 등 최신 전용 API 사용 금지
- **생성형 AI 미사용**: 본 앱의 모든 결과물은 근로기준법 기반 결정론적 규칙 계산 결과이므로 생성형 AI 고지 의무 대상이 아니다. 대신 모든 결과 화면에 `"법정 기준 자동 계산 결과이며 법적 효력이 없습니다"` 고지를 표시한다

---

## Data Models

### Workplace — 근무지
```ts
export type TaxType = 'none' | 'freelance3_3';

export interface Workplace {
  id: string;              // crypto.randomUUID()
  name: string;            // 1~20자, 필수
  hourlyWage: number;      // 정수, 1 이상 1_000_000 이하
  isFiveOrMore: boolean;   // 5인 이상 사업장 여부 (가산수당 적용)
  payday: number;          // 1~31, 월 급여 지급일
  taxType: TaxType;        // 기본 'none'
  colorToken: string;      // 'blue' | 'green' | 'purple' | 'orange' (TDS 색 토큰 키)
  createdAt: string;       // ISO8601
  updatedAt: string;       // ISO8601 — 생성 시 createdAt과 동일값, 수정 저장 시마다 갱신
}
```
- **제약**: 최대 5개. `name`은 동일 사용자 내 중복 허용.
- **삭제 정책**: 하드 삭제만 지원한다(아카이브/소프트 삭제 없음). 삭제 시 연결된 `WorkRecord`·`PayCheck`를 함께 제거한다(F1 AC-3).

### WorkRecord — 출퇴근 기록
```ts
export interface WorkRecord {
  id: string;              // crypto.randomUUID()
  workplaceId: string;     // Workplace.id (FK)
  date: string;            // 'YYYY-MM-DD' (출근일 기준)
  startTime: string;       // 'HH:mm' (00:00~23:59)
  endTime: string;         // 'HH:mm' — startTime 이하이면 익일로 해석
  breakMinutes: number;    // 0~720 정수
  isHoliday: boolean;      // 휴일(주휴일/약정휴일) 근무 여부, 기본 false
  memo: string;            // 0~50자
  createdAt: string;       // ISO8601
  updatedAt: string;       // ISO8601
}
```
- **제약**: 동일 `workplaceId` + `date` + `startTime` 조합 중복 저장 금지.
- **유니크 검사 적용 범위**: 신규 생성 저장(F2 AC-6)과 **수정 저장(F2 AC-9) 양쪽 모두**에 동일하게 적용한다. 수정 시에는 자기 자신(`id`가 같은 레코드)을 비교 대상에서 제외하고, 나머지 레코드 중 동일 `(workplaceId, date, startTime)` 조합이 존재하면 저장을 거부한다.

### PayCheck — 실지급액 비교 기록
```ts
export interface PayCheck {
  id: string;
  workplaceId: string;
  yearMonth: string;         // 'YYYY-MM'
  actualPaidAmount: number;  // 정수, 0 이상 100_000_000 이하
  calculatedGross: number;   // 분석 시점 계산 총액 (스냅샷)
  calculatedNet: number;     // 세금 적용 후 (스냅샷)
  diff: number;              // calculatedNet - actualPaidAmount (양수 = 미지급 의심)
  suspects: PaySuspect[];    // 미지급 추정 항목
  createdAt: string;         // ISO8601 — 최초 저장 시각(덮어쓰기 시에도 유지)
  updatedAt: string;         // ISO8601 — 최초 저장 시 createdAt과 동일값, 덮어쓰기마다 갱신
}

export type SuspectKind = 'weeklyHoliday' | 'night' | 'overtime' | 'holiday' | 'minimumWage';

export interface PaySuspect {
  kind: SuspectKind;
  label: string;       // 예: '주휴수당 미지급 의심'
  amount: number;      // 해당 항목 계산액(원)
  description: string; // 예: '3월 2주차(3/9~3/15) 주 20시간 근무 → 41,280원'
}
```

### AppSettings — 앱 설정/상태
```ts
export interface AppSettings {
  onboardingSeenAt: string | null;       // 온보딩 완료 시각
  disclaimerAckAt: string | null;        // 법적 고지 확인 시각
  activeWorkplaceId: string | null;      // 홈 기본 표시 근무지
  rewardUnlocks: Record<string, string>; // key: `${workplaceId}:${yearMonth}` → 해제 만료 ISO8601 (24h)
  schemaVersion: number;                 // 현재 1
}
```
- `activeWorkplaceId`는 항상 `apg:workplaces:v1`에 실재하는 id이거나 `null`이어야 한다. 근무지 삭제 시 F1 AC-9 규칙으로 즉시 재지정한다.
- **id/createdAt/updatedAt 규약 면제 (명시적 예외)**: `AppSettings`는 컬렉션의 한 행(entity)이 아니라 **키 `apg:settings:v1` 하나에 정확히 1개만 존재하는 싱글턴 설정 객체**이므로 `id`·`createdAt`·`updatedAt`을 두지 않는다. 근거는 다음 3가지다.
  1. **식별자 불필요**: 인스턴스가 1개뿐이라 localStorage 키 자체가 유일 식별자 역할을 한다. 다른 엔티티가 `AppSettings`를 FK로 참조하는 경로도 없다.
  2. **시각 필드 불필요**: 생성/수정 시각이 의미를 갖는 필드는 이미 도메인 필드(`onboardingSeenAt`, `disclaimerAckAt`, `rewardUnlocks`의 만료 ISO8601)로 각각 분리되어 있어 일반 `createdAt`/`updatedAt`을 두면 어떤 화면·계산도 읽지 않는 죽은 필드가 된다.
  3. **정렬/비교 대상 아님**: `Workplace`는 `createdAt` 오름차순 정렬(F1 AC-9), `PayCheck`는 `updatedAt > createdAt` 검증(F6 AC-6)에 시각 필드를 실제로 사용하지만 `AppSettings`는 정렬·이력 비교 대상이 아니다.
- 따라서 F1 AC-8의 `updatedAt` 백필 마이그레이션 대상은 `Workplace`·`WorkRecord`·`PayCheck` 3개 컬렉션이며, `AppSettings`는 대상에서 제외한다(F1 AC-8에 명시).

### localStorage 키 & 크기 추정
| 키 | 값 형태 | 기본 폴백값 | 크기 추정 |
|---|---|---|---|
| `apg:workplaces:v1` | `Workplace[]` | `[]` | 5개 × ~230B = **~1.2KB** |
| `apg:records:v1` | `WorkRecord[]` | `[]` | 1일 1건 × 365일 × 3근무지 × ~220B = **~240KB** |
| `apg:paychecks:v1` | `PayCheck[]` | `[]` | 60건 × ~730B = **~44KB** |
| `apg:settings:v1` | `AppSettings` | `DEFAULT_SETTINGS` | ~600B |
| **합계** | | | **약 0.29MB (5MB 한도의 6%)** |

```ts
export const DEFAULT_SETTINGS: AppSettings = {
  onboardingSeenAt: null,
  disclaimerAckAt: null,
  activeWorkplaceId: null,
  rewardUnlocks: {},
  schemaVersion: 1,
};
```

- 저장 전 `JSON.stringify` 길이가 4,500,000자를 초과하면 쓰기를 중단하고 경고 토스트를 표시한다.
- **손상 복구 규칙 (4개 키 공통 · 키별 템플릿)**: 임의의 저장소 키 `key`를 읽을 때 JSON 파싱에 실패하거나 값의 형태가 기대 타입과 다르면(배열 키 → 배열이 아님 / `apg:settings:v1` → 객체가 아니거나 `null`), 해당 키의 **기본 폴백값**(위 표의 "기본 폴백값" 열: 배열 키는 `[]`, `apg:settings:v1`은 `DEFAULT_SETTINGS`)을 반환하고, 원본 문자열을 다음 템플릿 키로 백업한 뒤 원본 키를 폴백값으로 덮어쓴다.
  ```ts
  const backupKey = `${key}:corrupt:${timestamp}`; // timestamp = Date.now() (밀리초 정수)
  ```
  - 예: `apg:workplaces:v1` 손상 → `apg:workplaces:v1:corrupt:1772409600000`, `apg:settings:v1` 손상 → `apg:settings:v1:corrupt:1772409600000`. **백업 키 이름을 `apg:records:v1:corrupt:*`로 고정하지 않는다.**
  - 백업 쓰기 자체가 실패하면(`QuotaExceededError` 등) 백업을 생략하고 폴백값 반환만 수행한다. 어느 경우에도 예외를 상위로 throw하지 않고 `console.error`도 호출하지 않는다.
  - 한 번의 앱 기동에서 여러 키가 동시에 손상되어도 TDS Toast `"일부 데이터를 불러오지 못했어요"`는 **1회만** 표시한다.

---

## Feature List

### F1. 데이터 레이어 & 근무지 관리

- **Description**: localStorage 기반 저장소 유틸(`storage.ts`)과 근무지 CRUD를 구현한다. 근무지는 시급·5인 이상 여부·세금 유형을 보유하며, 이후 모든 급여 계산의 입력값이 된다. 최초 실행 시 근무지가 없으면 온보딩으로 근무지 1개 생성을 유도한다. 근무지 삭제는 하드 삭제이며 연결 데이터(기록·분석 결과)와 활성 근무지 포인터까지 정합성을 맞춘다.
- **Data**: `Workplace`, `AppSettings`, `WorkRecord`, `PayCheck` / 키 `apg:workplaces:v1`, `apg:settings:v1`, `apg:records:v1`, `apg:paychecks:v1`
- **API**: 해당 없음 (로컬 전용)
- **Requirements**: 근무지 생성/수정/삭제(연쇄 삭제 포함), 활성 근무지 전환·재지정, 스키마 버전 마이그레이션, 저장 실패 복구, 키별 손상 백업

- **AC-1 [E][P0]**: Scenario: 근무지 생성 성공
  - Given `apg:workplaces:v1`가 비어 있고 사용자가 `/workplace/new` 화면에 있을 때
  - When `{ name: "편의점 알바", hourlyWage: 10320, isFiveOrMore: false, payday: 10, taxType: "none" }`을 입력하고 TDS Button "저장" 탭
  - Then `apg:workplaces:v1`에 `id`/`createdAt`/`updatedAt`이 채워진 Workplace 1건이 저장되고 (`createdAt === updatedAt`)
  - And `apg:settings:v1.activeWorkplaceId`가 해당 id로 설정되며
  - And TDS Toast `"근무지가 저장되었어요"`가 표시되고 `navigate('/', { replace: true })`로 이동한다

- **AC-2 [E][P0]**: Scenario: 근무지 수정 시 기록 보존 및 updatedAt 갱신
  - Given `id: "wp-1"` 근무지(`createdAt === updatedAt === "2026-03-01T00:00:00.000Z"`)에 WorkRecord 3건이 연결되어 있을 때
  - When `/workplace/wp-1` 화면에서 `hourlyWage`를 `10320` → `12000`으로 변경하고 저장
  - Then `apg:workplaces:v1`의 `wp-1.hourlyWage === 12000`이 되고
  - And `wp-1.updatedAt`이 저장 시각 ISO8601로 갱신되어 `wp-1.updatedAt > wp-1.createdAt`이며 `wp-1.createdAt`은 `"2026-03-01T00:00:00.000Z"`로 유지되고
  - And `apg:records:v1`의 3건은 `id`/`date`/`startTime` 값이 변경되지 않는다

- **AC-3 [E][P0]**: Scenario: 근무지 삭제 시 연결 기록·분석 결과 동시 삭제
  - Given `wp-1`에 WorkRecord 3건 + PayCheck 2건, `wp-2`에 WorkRecord 2건 + PayCheck 1건이 있을 때
  - When `wp-1` 삭제 버튼 탭 → TDS AlertDialog `"기록 3건과 저장된 분석 결과 2건도 함께 삭제됩니다"`에서 "삭제" 탭
  - Then `apg:workplaces:v1`에서 `wp-1`이 제거되고
  - And `apg:records:v1`에는 `workplaceId === "wp-2"`인 2건만 남으며
  - And `apg:paychecks:v1`에는 `workplaceId === "wp-2"`인 1건만 남아 `workplaceId === "wp-1"`인 행이 0건이 된다 (고아 PayCheck 미존재)
  - And 3개 키 쓰기 중 어느 하나라도 실패하면 세 키 모두 삭제 전 값으로 롤백하고 TDS Toast `"삭제하지 못했어요. 다시 시도해주세요"`를 표시한다

- **AC-4 [W][P1]**: Scenario: 잘못된 시급 거부
  - Given 사용자가 근무지 폼에 있을 때
  - When `{ name: "카페", hourlyWage: 0 }`으로 저장 시도
  - Then TDS TextField 하단에 에러 메시지 `"시급을 1원 이상 입력해주세요"`가 표시되고 저장이 수행되지 않는다
  - And `{ name: "", hourlyWage: 10320 }`인 경우 `"근무지 이름을 입력해주세요"`가 표시된다

- **AC-5 [W][P1]**: Scenario: 근무지 개수 상한
  - Given `apg:workplaces:v1`에 근무지가 5개 있을 때 (아카이브 개념 없음 — 저장된 전체 배열 길이 기준)
  - When "근무지 추가" 버튼을 탭
  - Then TDS Toast `"근무지는 최대 5개까지 등록할 수 있어요"`가 표시되고 `/workplace/new`로 이동하지 않는다
  - And 근무지 1개를 삭제해 배열 길이가 4가 되면 동일 버튼 탭 시 `/workplace/new`로 정상 이동한다

- **AC-6 [W][P1]**: Scenario: 저장소 손상 복구 — 4개 키 공통 규칙
  - Given `apg:records:v1`의 값이 `"{{broken"`이고 `Date.now() === 1772409600000`일 때
  - When 앱이 기록을 읽으면
  - Then 빈 배열 `[]`을 반환하고 원본 문자열을 `` `${key}:corrupt:${timestamp}` `` 템플릿으로 계산한 `apg:records:v1:corrupt:1772409600000` 키에 백업한 뒤 `apg:records:v1`을 `[]`로 덮어쓴다
  - And 동일한 규칙이 나머지 3개 키에도 그대로 적용된다:
    - `apg:workplaces:v1`가 `"[[bad"`이면 → 반환값 `[]`, 백업 키 `apg:workplaces:v1:corrupt:1772409600000`
    - `apg:paychecks:v1`가 `"null"`(배열 아님)이면 → 반환값 `[]`, 백업 키 `apg:paychecks:v1:corrupt:1772409600000`
    - `apg:settings:v1`가 `"{oops"` 또는 `"[]"`(객체 아님)이면 → 반환값 `DEFAULT_SETTINGS`, 백업 키 `apg:settings:v1:corrupt:1772409600000`
  - And 어떤 경우에도 백업 키 이름에 다른 키의 이름(`apg:records:v1` 등)이 사용되지 않고, 백업 키가 `undefined`를 포함하지 않는다
  - And 백업 쓰기가 `QuotaExceededError`로 실패하면 백업을 생략하고 폴백값 반환만 수행한다
  - And `console.error`를 호출하지 않고, 여러 키가 동시에 손상돼도 TDS Toast `"일부 데이터를 불러오지 못했어요"`는 1회만 표시한다

- **AC-7 [S][P1]**: Scenario: 근무지 없음 빈 상태
  - Given `apg:workplaces:v1`가 빈 배열일 때
  - When `/workplace` 진입
  - Then `Asset.ContentIcon`과 `"등록된 근무지가 없어요"` 문구, `display="block"` TDS Button `"근무지 추가하기"`가 표시된다

- **AC-8 [U][P2]**: Scenario: 스키마 버전 보존 및 updatedAt 백필
  - Given 저장된 `AppSettings.schemaVersion`이 없거나 `1` 미만일 때
  - Then 앱 기동 시 `schemaVersion: 1`과 `rewardUnlocks: {}`를 채워 다시 저장한다
  - And `Workplace`/`WorkRecord`/`PayCheck` 레코드에 `updatedAt`이 없으면 각 레코드의 `createdAt` 값으로 채워 저장한다 (컬렉션 3종 모두 대상)
  - And `AppSettings`는 싱글턴 예외이므로 `id`/`createdAt`/`updatedAt` 백필 대상에서 제외하며, 마이그레이션 후에도 `AppSettings`에 이 3개 필드가 추가되지 않는다

- **AC-9 [E][P0]**: Scenario: 활성 근무지 삭제 시 포인터 재지정
  - Given `apg:settings:v1.activeWorkplaceId === "wp-1"`이고 근무지가 `wp-1`(`createdAt: "2026-01-01T00:00:00.000Z"`), `wp-2`(`createdAt: "2026-02-01T00:00:00.000Z"`), `wp-3`(`createdAt: "2026-03-01T00:00:00.000Z"`) 3개일 때
  - When `wp-1`을 삭제(AC-3 흐름)하면
  - Then `activeWorkplaceId`는 남은 근무지 중 `createdAt` 오름차순 첫 번째인 `"wp-2"`로 즉시 갱신되어 저장되고
  - And 홈(`/`)은 `wp-2` 기준으로 렌더링되어 히어로 금액이 계산된다
  - And 남은 근무지가 0개인 경우 `activeWorkplaceId === null`로 저장되고 홈은 **F4 AC-10의 근무지 0개 빈 상태**(`Asset.ContentIcon` + `"등록된 근무지가 없어요"` + TDS Button `"근무지 추가하기"`)를 표시한다 — 이 경우 F4 AC-5의 `"아직 이번 달 기록이 없어요"` 빈 상태는 표시되지 않는다
  - And 비활성 근무지(`activeWorkplaceId`와 다른 id)를 삭제한 경우 `activeWorkplaceId` 값은 변경되지 않는다

---

### F2. 출퇴근 기록 입력 / 수정 / 삭제

- **Description**: 날짜·출근시각·퇴근시각·휴게시간·휴일 여부를 입력해 하루 근무를 기록한다. 저장 즉시 해당 일의 실근로시간과 예상 일급이 미리보기로 계산되어 화면에 표시된다. 자정을 넘긴 근무(예: 22:00~02:00)를 익일 퇴근으로 자동 처리한다.
- **Data**: `WorkRecord`, `Workplace` / 키 `apg:records:v1`
- **API**: 해당 없음
- **Requirements**: 폼 검증, 익일 퇴근 처리, 휴게시간 자동 제안, **중복 방지(생성·수정 저장 양쪽 공통)**, 모바일 키보드 대응

- **AC-1 [E][P0]**: Scenario: 기록 저장 성공
  - Given 활성 근무지 `{ id: "wp-1", hourlyWage: 10320, isFiveOrMore: true }`가 있을 때
  - When `/record/new`에서 `{ date: "2026-03-02", startTime: "18:00", endTime: "23:00", breakMinutes: 30, isHoliday: false, memo: "" }`로 "저장" 탭
  - Then `apg:records:v1`에 1건이 추가되고 TDS Toast `"기록이 저장되었어요"`가 표시되며
  - And `navigate('/', { replace: true })`로 홈에 복귀한다

- **AC-2 [E][P0]**: Scenario: 자정 넘긴 근무 처리
  - Given 활성 근무지 시급이 `10320`일 때
  - When `{ date: "2026-03-02", startTime: "22:00", endTime: "02:00", breakMinutes: 0 }`을 입력
  - Then 폼 미리보기에 실근로시간 `4시간 0분`, 예상 일급 `61,920원`(기본 41,280 + 야간가산 20,640)이 표시된다

- **AC-3 [E][P1]**: Scenario: 휴게시간 자동 제안
  - Given 사용자가 `breakMinutes`를 직접 수정한 적이 없을 때
  - When `startTime: "09:00"`, `endTime: "18:00"`을 입력 (총 9시간)
  - Then `breakMinutes` 필드가 `60`으로 자동 채워지고 보조 텍스트 `"4시간 이상 30분, 8시간 이상 60분이 자동 적용돼요"`가 표시된다
  - And 사용자가 값을 직접 수정하면 이후 자동 채움이 적용되지 않는다

- **AC-4 [E][P0]**: Scenario: 기록 수정 및 삭제
  - Given `id: "rec-1"` 기록이 `{ endTime: "23:00" }`일 때
  - When `/record/rec-1/edit`에서 `endTime`을 `"22:00"`으로 바꾸고 저장
  - Then 저장 직전에 AC-6과 동일한 유니크 검사(`workplaceId` + `date` + `startTime`, 자기 자신 `rec-1`은 비교 제외)를 수행해 충돌이 없음을 확인하고
  - And `rec-1.endTime === "22:00"`, `updatedAt`이 갱신되고 `createdAt`은 유지된다
  - And 동일 화면의 "삭제" 탭 → TDS AlertDialog 확인 시 `apg:records:v1`에서 `rec-1`이 제거된다

- **AC-5 [W][P1]**: Scenario: 잘못된 시각 입력 거부
  - Given 사용자가 기록 폼에 있을 때
  - When `startTime: "25:00"` 입력 후 저장 시도
  - Then 에러 메시지 `"시각을 HH:mm 형식(00:00~23:59)으로 입력해주세요"`가 표시되고 저장되지 않는다
  - And `breakMinutes`가 실근로시간 총합(분) 이상이면 `"휴게시간이 근무시간보다 길 수 없어요"`가 표시된다

- **AC-6 [W][P1]**: Scenario: 중복 기록 차단 — 신규 생성
  - Given `{ workplaceId: "wp-1", date: "2026-03-02", startTime: "18:00" }` 기록이 이미 존재할 때
  - When `/record/new`에서 동일한 조합으로 새 기록 저장 시도
  - Then TDS Toast `"같은 시간에 이미 기록이 있어요"`가 표시되고 저장되지 않으며 `apg:records:v1` 배열 길이가 증가하지 않는다

- **AC-7 [W][P1]**: Scenario: 근무지 미등록 상태 진입
  - Given `apg:workplaces:v1`가 빈 배열일 때
  - When `/record/new`에 직접 진입
  - Then 폼 대신 `"먼저 근무지를 등록해주세요"` 안내와 TDS Button `"근무지 등록하기"`(`navigate('/workplace/new')`)가 표시된다

- **AC-8 [U][P1]**: Scenario: 모바일 키보드 대응
  - Given 기록 입력 폼이 렌더링될 때
  - Then 시각/휴게시간/금액 TDS TextField는 `inputMode="numeric"`을 가지고
  - And 1차 액션 버튼은 `SubmitFooter` 내부에 위치해 키보드 노출 시에도 입력 필드를 가리지 않으며
  - And 마지막 필드에서 키보드 "완료" 입력 시 포커스가 해제된다(`blur`)

- **AC-9 [W][P1]**: Scenario: 중복 기록 차단 — 수정 저장 경로
  - Given `apg:records:v1`에 `rec-1 = { workplaceId: "wp-1", date: "2026-03-02", startTime: "18:00" }`과 `rec-2 = { workplaceId: "wp-1", date: "2026-03-05", startTime: "09:00" }` 2건이 있을 때
  - When `/record/rec-1/edit`에서 `date`를 `"2026-03-05"`, `startTime`을 `"09:00"`으로 바꿔 `rec-2`와 동일한 `(workplaceId, date, startTime)` 조합이 되도록 저장 시도
  - Then AC-6과 동일한 TDS Toast `"같은 시간에 이미 기록이 있어요"`가 표시되고 저장이 수행되지 않는다
  - And `rec-1`은 저장소에서 `{ date: "2026-03-02", startTime: "18:00" }` 원래 값으로 유지되며 `updatedAt`도 갱신되지 않는다
  - And `apg:records:v1` 배열 길이는 2로 유지되고 동일 `(workplaceId, date, startTime)` 조합의 행 수는 최대 1건이다
  - And `rec-1`에서 `date`/`startTime`은 그대로 두고 `endTime`·`breakMinutes`·`memo`만 수정하는 경우, 자기 자신은 비교에서 제외되므로 중복으로 판정되지 않고 정상 저장된다(AC-4)

---

### F3. 급여 계산 엔진 (순수 함수)

- **Description**: WorkRecord 배열과 Workplace를 입력받아 기본급·야간·연장·휴일 가산·주휴수당·최저임금 위반 여부를 산출하는 순수 함수 모듈(`payroll.ts`)을 구현한다. UI 의존성이 없어 단위 테스트로 전량 검증 가능하며, F4~F6의 모든 화면이 이 모듈만을 계산 소스로 사용한다.
- **Data**: 입력 `WorkRecord[]`, `Workplace` / 출력 `MonthlyPayroll`(메모리 전용, 저장 안 함)
- **API**: 해당 없음

```ts
export interface DailyPay {
  date: string; workedMinutes: number; nightMinutes: number; overtimeMinutes: number;
  basePay: number; nightPay: number; overtimePay: number; holidayPay: number; total: number;
}
export interface WeeklyHoliday {
  weekStart: string;      // 'YYYY-MM-DD' (월요일)
  weeklyMinutes: number;
  eligible: boolean;      // weeklyMinutes >= 900 (15h)
  amount: number;
}
export interface MonthlyPayroll {
  yearMonth: string; daily: DailyPay[]; weeks: WeeklyHoliday[];
  basePay: number; nightPay: number; overtimePay: number; holidayPay: number; weeklyHolidayPay: number;
  gross: number; net: number; totalMinutes: number;
  minimumWage: number; isBelowMinimumWage: boolean; minimumWageShortfall: number;
}
```

- **AC-1 [U][P0]**: Scenario: 기본급 + 야간가산 계산
  - Given `{ hourlyWage: 10320, isFiveOrMore: true }`, 기록 `{ date: "2026-03-02", startTime: "18:00", endTime: "23:00", breakMinutes: 30 }`
  - When `calcMonthly()` 호출
  - Then `daily[0].workedMinutes === 270`, `basePay === 46440`, `nightMinutes === 60`, `nightPay === 5160`, `daily[0].total === 51600`

- **AC-2 [U][P0]**: Scenario: 주휴수당 지급 조건 충족
  - Given `{ hourlyWage: 10320 }`, 2026-03-02(월)~03-06(금) 각 4시간 근무(주 20시간)
  - When `calcMonthly("2026-03")` 호출
  - Then `weeks[0] === { weekStart: "2026-03-02", weeklyMinutes: 1200, eligible: true, amount: 41280 }`
  - And `weeklyHolidayPay === 41280`

- **AC-3 [U][P0]**: Scenario: 주 15시간 미만 주휴수당 미지급
  - Given `{ hourlyWage: 10320 }`, 2026-03-02(월)~03-04(수) 각 4시간 근무(주 12시간)
  - When `calcMonthly("2026-03")` 호출
  - Then `weeks[0].eligible === false`, `weeks[0].amount === 0`, `weeklyHolidayPay === 0`

- **AC-4 [U][P0]**: Scenario: 5인 미만 사업장 가산수당 제외
  - Given `{ hourlyWage: 10320, isFiveOrMore: false }`, 기록 `{ startTime: "13:00", endTime: "24:00", breakMinutes: 60 }` (10시간, 야간 2시간, 연장 2시간)
  - When `calcMonthly()` 호출
  - Then `nightPay === 0`, `overtimePay === 0`, `holidayPay === 0`, `basePay === 103200`

- **AC-5 [U][P0]**: Scenario: 연장근로 가산 (1일 8시간 초과)
  - Given `{ hourlyWage: 10320, isFiveOrMore: true }`, 기록 `{ startTime: "09:00", endTime: "21:00", breakMinutes: 60 }` (11시간 근로)
  - When `calcMonthly()` 호출
  - Then `overtimeMinutes === 180`, `overtimePay === 15480`, `nightMinutes === 0`

- **AC-6 [U][P0]**: Scenario: 최저임금 위반 판정
  - Given `{ hourlyWage: 9800 }`, 2026년 기록이 1건 이상 존재
  - When `calcMonthly("2026-03")` 호출
  - Then `minimumWage === 10320`, `isBelowMinimumWage === true`
  - And `minimumWageShortfall === Math.floor((10320 - 9800) × totalMinutes / 60)`

- **AC-7 [W][P1]**: Scenario: 비정상 입력 방어
  - Given 기록 배열에 `{ startTime: "abc", endTime: "18:00" }` 또는 `breakMinutes: -10`인 항목이 섞여 있을 때
  - When `calcMonthly()` 호출
  - Then 해당 항목을 `daily`에서 제외하고 나머지만 계산하며, 예외를 throw하지 않고 `console.error`도 호출하지 않는다

- **AC-8 [S][P1]**: Scenario: 기록 없는 달
  - Given 해당 `yearMonth`에 기록이 0건일 때
  - When `calcMonthly("2026-04")` 호출
  - Then `gross === 0`, `net === 0`, `daily === []`, `weeks === []`, `isBelowMinimumWage === false`를 반환한다

---

### F4. 홈 대시보드 — 월 예상 급여 실시간 누적

- **Description**: 활성 근무지의 이번 달 예상 급여를 CountUp 히어로로 보여주고, 일별 누적 추이 Sparkline과 급여 구성 비중 MiniBar를 제공한다. 최근 기록 5건과 빠른 기록 추가 CTA를 배치해 매일 앱을 여는 습관을 만든다.
- **Data**: `WorkRecord`, `Workplace`, `AppSettings.activeWorkplaceId`
- **API**: 해당 없음
- **Requirements**: 근무지 전환, 월 전환, 배너 광고 배치, 빈 상태, 저장소 손상 시 폴백

- **AC-1 [U][P0]**: Scenario: 이번 달 예상 급여 표시
  - Given `{ hourlyWage: 10320, isFiveOrMore: true, taxType: "none" }`, 2026-03-02~03-06 각 4시간 기록 5건
  - When `/` 진입 (현재 2026-03)
  - Then `data-testid="pay-hero"`인 `SummaryHero`에 CountUp 애니메이션으로 `247,680원`(기본 206,400 + 주휴 41,280)이 표시되고
  - And 보조 라벨에 `"이번 달 예상 급여 · 20시간"`이 표시된다

- **AC-2 [U][P0]**: Scenario: 홈 레이아웃 계약
  - Given 기록이 1건 이상 있을 때
  - When `/` 진입
  - Then 화면은 `ScreenScaffold`로 감싸지고
  - And `data-testid="pay-hero"` 1개, `data-testid="pay-trend-sparkline"`(일별 누적 Sparkline) 1개, `data-testid="pay-composition-bar"`(기본/주휴/가산 비중 MiniBar) 1개, `data-testid="recent-records-card"` TDS Card 1개를 포함한다
  - And `data-testid="cta-add-record"` TDS Button은 `display="block"`으로 렌더링된다

- **AC-3 [E][P0]**: Scenario: 근무지 전환
  - Given 근무지가 `wp-1`(활성), `wp-2` 2개 있을 때
  - When 상단 TDS Chip 목록에서 `wp-2` Chip을 탭
  - Then `apg:settings:v1.activeWorkplaceId === "wp-2"`로 저장되고
  - And 히어로 금액이 `wp-2` 기준으로 재계산되어 즉시 갱신된다

- **AC-4 [E][P1]**: Scenario: 월 전환
  - Given 현재 `2026-03`이 표시되고 있을 때
  - When 좌측 `‹` 버튼(44×44px)을 탭
  - Then 표시 월이 `2026-02`로 바뀌고 해당 월 계산 결과가 반영되며
  - And 미래 월로는 이동할 수 없어 현재 월에서 `›` 버튼은 `disabled` 상태가 된다

- **AC-5 [S][P1]**: Scenario: 기록 없는 빈 상태 (근무지는 1개 이상 존재)
  - Given 활성 근무지가 존재하고 해당 근무지에 이번 달 기록이 0건일 때
  - When `/` 진입
  - Then Sparkline/MiniBar 대신 `Asset.ContentIcon`과 `"아직 이번 달 기록이 없어요"` 문구가 표시되고
  - And 히어로 금액은 `0원`으로 표시되며 `data-testid="cta-add-record"` 버튼이 노출된다
  - And 이 빈 상태는 **근무지가 1개 이상 존재할 때만** 적용된다. 근무지가 0개인 경우는 AC-10의 `"등록된 근무지가 없어요"` 상태를 표시한다

- **AC-6 [S][P1]**: Scenario: 로딩 상태
  - Given localStorage 읽기가 완료되기 전일 때
  - Then 히어로·리스트 영역에 TDS Skeleton이 표시되고 숫자 `0원`이 먼저 깜빡이지 않는다

- **AC-7 [U][P1]**: Scenario: 배너 광고 배치
  - Given `/` 화면이 렌더링될 때
  - Then `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`가 `recent-records-card` **아래**, FloatingTabBar **위**에 1개만 배치되고
  - And 광고 영역이 기록 리스트나 히어로 금액을 가리지 않는다(겹침 0px)

- **AC-8 [E][P0]**: Scenario: 홈에서 나가는 내비게이션
  - Given `/` 화면에 있을 때
  - When `data-testid="cta-add-record"` 탭
  - Then `navigate('/record/new', { state: { workplaceId: string, date: string } })`가 호출되고 `date`는 오늘 날짜(`YYYY-MM-DD`)이다

- **AC-9 [W][P1]**: Scenario: 저장소 손상 시 홈 폴백 (키별 백업)
  - Given `apg:records:v1`의 값이 `"{{broken"`이고 `apg:workplaces:v1`는 정상일 때
  - When `/` 진입
  - Then 기록 읽기는 F1 AC-6에 따라 빈 배열로 폴백되고 원본은 `` `${key}:corrupt:${timestamp}` `` 템플릿에 따라 `apg:records:v1:corrupt:{timestamp}`로 백업되며
  - And TDS Toast `"일부 데이터를 불러오지 못했어요"`가 1회 표시되고
  - And `data-testid="pay-hero"`는 `0원`으로 렌더링되며 Sparkline/MiniBar 대신 `Asset.ContentIcon` + `"아직 이번 달 기록이 없어요"` 빈 상태가 표시된다
  - And 손상된 키가 다른 경우에도 동일하게 처리된다:
    - `apg:workplaces:v1` 손상 → `apg:workplaces:v1:corrupt:{timestamp}`로 백업 후 근무지 0개로 폴백되어 AC-10의 `"등록된 근무지가 없어요"` 상태를 표시
    - `apg:settings:v1` 손상 → `apg:settings:v1:corrupt:{timestamp}`로 백업 후 `DEFAULT_SETTINGS`로 폴백(`activeWorkplaceId === null` → AC-10 재지정 규칙 적용)
    - `apg:paychecks:v1` 손상 → `apg:paychecks:v1:corrupt:{timestamp}`로 백업 후 `[]`로 폴백(홈 렌더링에는 영향 없음)
  - And 복수 키가 동시에 손상돼도 Toast는 1회만 표시되고, `console.error`는 0건이며 화이트 스크린이 발생하지 않는다

- **AC-10 [W][P1]**: Scenario: 활성 근무지 포인터가 유실된 경우 / 근무지 0개 빈 상태
  - Given `apg:settings:v1.activeWorkplaceId === "wp-deleted"`이고 `apg:workplaces:v1`에 해당 id가 존재하지 않을 때 (외부 조작·마이그레이션 잔여)
  - When `/` 진입
  - Then 앱은 F1 AC-9와 동일 규칙으로 `createdAt` 오름차순 첫 근무지 id를 `activeWorkplaceId`에 저장하고 그 근무지 기준으로 렌더링하며
  - And 근무지가 0개면 `activeWorkplaceId === null`로 저장하고 `Asset.ContentIcon` + `"등록된 근무지가 없어요"` 안내와 TDS Button `"근무지 추가하기"`(`navigate('/workplace/new')`)를 표시한다 — 이때 AC-5의 `"아직 이번 달 기록이 없어요"` 문구와 `data-testid="cta-add-record"` 버튼은 렌더링되지 않는다
  - And 어느 경우에도 `console.error`를 호출하지 않는다

---

### F5. 급여 상세 내역 & 최저임금 경고

- **Description**: 이번 달 급여를 기본급/야간/연장/휴일/주휴수당 항목별로 분해해 Card로 보여준다. 주차별 주휴수당 충족 여부를 "주 15시간까지 N시간 남음" 형태로 안내해 사용자가 근무 스케줄을 조정할 수 있게 한다. 시급이 최저임금 미만이면 상단에 경고 배너와 부족액을 표시한다.
- **Data**: `MonthlyPayroll`(F3 산출), `Workplace`
- **API**: 해당 없음

- **AC-1 [U][P0]**: Scenario: 항목별 상세 표시
  - Given `{ hourlyWage: 10320, isFiveOrMore: true }`, 2026-03 근무로 `basePay: 206400, nightPay: 5160, overtimePay: 0, holidayPay: 0, weeklyHolidayPay: 41280`일 때
  - When `/breakdown` 진입
  - Then `data-testid="breakdown-card"` TDS Card 안에 TDS ListRow 5개가 각각 `"기본급 206,400원"`, `"야간수당 5,160원"`, `"연장수당 0원"`, `"휴일수당 0원"`, `"주휴수당 41,280원"`으로 표시되고
  - And 합계 행에 `"합계 252,840원"`이 t2 강조 타이포로 표시된다

- **AC-2 [U][P0]**: Scenario: 주차별 주휴수당 카드
  - Given 2026-03-02 주에 주 12시간, 2026-03-09 주에 주 20시간 근무했을 때
  - When `/breakdown` 진입
  - Then `data-testid="weekly-holiday-card"` TDS Card에 주차 행 2개가 표시되고
  - And 1주차 행에 `"3시간 더 일하면 주휴수당 받을 수 있어요"` 및 TDS Badge `"미충족"`이,
  - And 2주차 행에 `"41,280원"` 및 TDS Badge `"충족"`이 표시된다

- **AC-3 [E][P0]**: Scenario: 최저임금 위반 경고
  - Given `{ hourlyWage: 9800 }`이고 2026-03 총 근로시간이 80시간일 때
  - When `/breakdown` 진입
  - Then `data-testid="minimum-wage-warning"` 요소가 표시되고
  - And 문구 `"2026년 최저임금 10,320원보다 520원 낮아요"`, `"부족액 41,600원"`이 포함된다

- **AC-4 [U][P1]**: Scenario: 최저임금 준수 시 경고 미노출
  - Given `{ hourlyWage: 10320 }`이고 2026년 기록이 있을 때
  - When `/breakdown` 진입
  - Then `data-testid="minimum-wage-warning"` 요소가 DOM에 존재하지 않는다

- **AC-5 [U][P0]**: Scenario: 세금 옵션 반영
  - Given `{ taxType: "freelance3_3" }`이고 `gross === 252840`일 때
  - When `/breakdown` 진입
  - Then `data-testid="net-pay-row"`에 `"세후 예상 244,496원"`이 표시되고 보조 텍스트 `"사업소득세 3.3% 공제 기준"`이 함께 노출된다

- **AC-6 [W][P1]**: Scenario: 5인 미만 안내
  - Given `{ isFiveOrMore: false }`인 근무지를 볼 때
  - When `/breakdown` 진입
  - Then 야간·연장·휴일수당 행에 값 `0원`과 함께 `"5인 미만 사업장은 가산수당 의무가 없어요"` 보조 텍스트가 표시된다

- **AC-7 [S][P1]**: Scenario: 빈 상태 / 로딩 상태
  - Given 해당 월 기록이 0건일 때
  - Then `Asset.ContentIcon`과 `"계산할 기록이 없어요"` 문구, TDS Button `"기록 추가하기"`가 표시되고 Card들은 렌더링되지 않는다
  - And 데이터 로딩 중에는 TDS Skeleton 3개가 표시된다

- **AC-8 [U][P1]**: Scenario: 법적 고지
  - Given `/breakdown` 화면이 렌더링될 때
  - Then 화면 하단에 `"법정 기준 자동 계산 결과이며 법적 효력이 없습니다"` 텍스트가 표시되고
  - And 외부 사이트로 이동하는 링크(`window.open`, `window.location.href`)가 존재하지 않는다

---

### F6. 실지급액 비교 & 미지급 분석 (리워드 광고 게이팅)

- **Description**: 사용자가 실제 받은 급여액을 입력하면 앱이 계산한 금액과 비교해 차액과 미지급 추정 항목을 산출한다. 분석 결과는 TossRewardAd로 게이팅되어, 광고 시청 완료 후에만 상세 리포트가 공개된다. 한 번 해제한 `(근무지, 년월)` 조합은 24시간 동안 재시청 없이 열람 가능하다.
- **Data**: `PayCheck`, `MonthlyPayroll`, `AppSettings.rewardUnlocks` / 키 `apg:paychecks:v1`
- **API**: 해당 없음

- **AC-1 [E][P0]**: Scenario: 실지급액 입력 후 분석 요청
  - Given `wp-1`의 2026-03 계산액이 `calculatedNet: 252840`일 때
  - When `/check`에서 `{ yearMonth: "2026-03", actualPaidAmount: 206400 }` 입력 후 TDS Button `"미지급 분석하기"` 탭
  - Then `navigate('/check/result', { state: { workplaceId: "wp-1", yearMonth: "2026-03", actualPaidAmount: 206400 } })`가 호출된다

- **AC-2 [E][P0]**: Scenario: 결과 보기 전 보상형 광고
  - Given `apg:settings:v1.rewardUnlocks["wp-1:2026-03"]`가 없거나 만료되었을 때
  - When `/check/result` 진입
  - Then 결과 Card가 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`로 감싸져 잠금 상태로 표시되고
  - And 광고 시청 완료 시 `rewardUnlocks["wp-1:2026-03"]`에 `now + 24h`의 ISO8601 값이 저장되며 분석 결과 Card가 표시된다

- **AC-3 [S][P0]**: Scenario: 24시간 내 재열람
  - Given `rewardUnlocks["wp-1:2026-03"]`가 현재 시각보다 미래일 때
  - When `/check/result`에 재진입
  - Then 광고 게이트 없이 즉시 결과 Card가 표시된다

- **AC-4 [U][P0]**: Scenario: 미지급 추정 항목 산출
  - Given `calculatedNet: 252840`, `actualPaidAmount: 206400`, 주휴수당 `41280`, 야간수당 `5160`일 때
  - When 분석이 수행되면
  - Then `diff === 46440`이고 `suspects`에 `{ kind: "weeklyHoliday", amount: 41280 }`, `{ kind: "night", amount: 5160 }`이 포함되며
  - And `data-testid="diff-hero"`에 CountUp으로 `46,440원`이, `data-testid="suspect-card"` TDS Card가 2개 렌더링된다

- **AC-5 [U][P0]**: Scenario: 결과 화면 레이아웃 계약
  - Given 광고 해제 상태로 결과가 표시될 때
  - Then 화면은 `ScreenScaffold`로 감싸지고
  - And `data-testid="compare-card"` TDS Card 1개(계산액 vs 실지급액 2행 + `MiniBar` 비교), `data-testid="diff-hero"` 1개, `data-testid="suspect-card"` 1개 이상을 포함하며
  - And 차액은 t2 강조 타이포와 TDS Badge(`"미지급 의심"` 또는 `"정상 지급"`)로 표시된다

- **AC-6 [E][P0]**: Scenario: 분석 결과 저장 및 덮어쓰기
  - Given 결과가 표시되었을 때
  - When 사용자가 `SubmitFooter`의 TDS Button `"분석 결과 저장"` 탭
  - Then `apg:paychecks:v1`에 `{ id, workplaceId, yearMonth, actualPaidAmount, calculatedGross, calculatedNet, diff, suspects, createdAt, updatedAt }` 1건이 추가되고(`createdAt === updatedAt`) TDS Toast `"분석 결과를 저장했어요"`가 표시된다
  - And 동일 `(workplaceId, yearMonth)` 기록이 이미 있으면 새 행을 추가하지 않고 기존 행을 덮어쓴다: `id`·`createdAt`은 기존 값을 유지하고, `actualPaidAmount`/`calculatedGross`/`calculatedNet`/`diff`/`suspects`를 새 값으로 교체하며 `updatedAt`을 저장 시각 ISO8601로 갱신해 `updatedAt > createdAt`이 된다
  - And 덮어쓰기 후에도 `apg:paychecks:v1`에서 해당 `(workplaceId, yearMonth)` 조합의 행 수는 1건이다

- **AC-7 [W][P1]**: Scenario: 잘못된 입력 / 과다 지급
  - Given `/check` 화면에서
  - When `actualPaidAmount`를 비우고 제출
  - Then 에러 메시지 `"실제 받은 금액을 입력해주세요"`가 표시되고 이동하지 않는다
  - And `actualPaidAmount: 300000`(계산액 초과) 제출 시 결과 화면에서 `diff`가 음수이므로 TDS Badge `"정상 지급"`과 `"계산액보다 47,160원 더 받았어요"`가 표시된다

- **AC-8 [W][P1]**: Scenario: 계산 대상 기록 없음 / 광고 실패
  - Given 해당 월 기록이 0건일 때
  - When `/check`에서 분석 요청
  - Then TDS Toast `"해당 월 출퇴근 기록이 없어요"`가 표시되고 결과 화면으로 이동하지 않는다
  - And 광고 로드/시청이 실패하면 `"광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"` 문구와 TDS Button `"다시 시도"`가 표시되며 결과는 잠금 상태를 유지한다

- **AC-9 [S][P1]**: Scenario: 로딩 상태
  - Given `/check/result` 진입 직후 계산 및 광고 로드가 진행 중일 때
  - Then TDS Skeleton이 결과 Card 자리에 표시되고, 계산 완료 전 `0원`이 노출되지 않는다

---

### F7. 기록 목록 & 월별 조회

- **Description**: 선택한 근무지의 월별 출퇴근 기록을 날짜 역순 리스트로 보여주고, 각 행에서 근무시간·일급·야간/연장/휴일 배지를 확인할 수 있다. 행 탭으로 수정 화면에 진입하며, 기록이 많아질 경우 페이지네이션으로 렌더링 부하를 제한한다.
- **Data**: `WorkRecord`, `Workplace`, `DailyPay` / 키 `apg:records:v1`, `apg:workplaces:v1`, `apg:settings:v1`
- **API**: 해당 없음

- **AC-1 [U][P0]**: Scenario: 월별 기록 리스트
  - Given `wp-1`에 2026-03 기록 5건, 2026-02 기록 3건이 있을 때
  - When `/records` 진입 (표시 월 2026-03)
  - Then TDS ListRow 5개가 `date` 내림차순으로 렌더링되고
  - And 각 행에 `"03월 02일 (월)"`, `"18:00–23:00 · 4시간 30분"`, 우측에 `"51,600원"`이 표시된다

- **AC-2 [E][P0]**: Scenario: 행 탭 → 수정 진입
  - Given `id: "rec-1"` 행이 표시되어 있을 때
  - When 해당 TDS ListRow(높이 ≥ 56px)를 탭
  - Then `navigate('/record/rec-1/edit', { state: { recordId: "rec-1" } })`가 호출된다

- **AC-3 [U][P1]**: Scenario: 가산 배지 표시
  - Given 기록이 야간 60분·연장 0분·`isHoliday: false`일 때
  - Then 해당 행에 TDS Badge `"야간"` 1개만 표시되고 `"연장"`, `"휴일"` 배지는 표시되지 않는다

- **AC-4 [S][P1]**: Scenario: 스크롤 / 페이지네이션
  - Given 표시 월의 기록이 50건을 초과할 때
  - When `/records`를 스크롤해 리스트 하단에 도달
  - Then 다음 50건이 추가 렌더링되고, 동시에 DOM에 존재하는 ListRow는 초기 50개를 넘지 않는다
  - And 세로 스크롤은 페이지 스크롤을 사용하며 리스트 내부 중첩 스크롤 컨테이너를 만들지 않는다

- **AC-5 [S][P1]**: Scenario: 빈 상태
  - Given 표시 월의 기록이 0건일 때
  - Then `Asset.ContentIcon`과 `"2026년 3월 기록이 없어요"` 문구, `display="block"` TDS Button `"기록 추가하기"`가 표시된다

- **AC-6 [S][P1]**: Scenario: 로딩 상태
  - Given localStorage 읽기 완료 전일 때
  - Then TDS Skeleton ListRow 3개가 표시된다

- **AC-7 [E][P1]**: Scenario: 스와이프 없이 삭제
  - Given 리스트 상단 TDS Button `"편집"`을 탭해 편집 모드로 진입했을 때
  - When 특정 행의 삭제 버튼(44×44px)을 탭하고 TDS AlertDialog `"이 기록을 삭제할까요?"`에서 "삭제" 탭
  - Then 해당 기록이 `apg:records:v1`에서 제거되고 TDS Toast `"기록을 삭제했어요"`가 표시된다

- **AC-8 [U][P1]**: Scenario: 배너 광고 배치
  - Given `/records`가 렌더링될 때
  - Then `<AdSlot />`이 리스트 **하단**(마지막 행 아래), FloatingTabBar 위에 1개 배치되고 리스트 행과 겹치지 않는다

- **AC-9 [W][P1]**: Scenario: 저장소 손상 시 리스트 폴백
  - Given `apg:records:v1`의 값이 `"{{broken"`이고 `apg:workplaces:v1`는 정상(근무지 1개 이상)일 때
  - When `/records` 진입
  - Then 기록 읽기는 F1 AC-6 규칙에 따라 빈 배열로 폴백되고 원본은 `` `${key}:corrupt:${timestamp}` `` 템플릿에 따라 `apg:records:v1:corrupt:{timestamp}`로 백업된다
  - And TDS Toast `"일부 데이터를 불러오지 못했어요"`가 1회 표시되고(F4 AC-9와 동일 문구)
  - And `data-testid="record-list"` 컨테이너는 렌더링되되 `data-testid="record-row"`는 0개이며, AC-5와 동일한 빈 상태(`Asset.ContentIcon` + `"2026년 3월 기록이 없어요"` + `"기록 추가하기"` Button)가 표시된다
  - And `apg:workplaces:v1` 또는 `apg:settings:v1`이 손상된 경우에도 각각 `apg:workplaces:v1:corrupt:{timestamp}`, `apg:settings:v1:corrupt:{timestamp}`로 백업되고 각 기본 폴백값(`[]`, `DEFAULT_SETTINGS`)이 적용된다
  - And `console.error`는 0건이고 화이트 스크린이 발생하지 않으며, 복수 키가 동시에 손상돼도 Toast는 1회만 표시된다

- **AC-10 [W][P1]**: Scenario: 잘못된 근무지 / 라우트 파라미터 방어
  - Given `/records`에 `location.state = { workplaceId: "wp-deleted", yearMonth: "2026-03" }`로 진입했고 `apg:workplaces:v1`에 `wp-deleted`가 존재하지 않을 때
  - Then F1 AC-9·F4 AC-10과 동일 규칙으로 `createdAt` 오름차순 첫 근무지를 선택해 그 근무지 기준으로 리스트를 렌더링하고 `apg:settings:v1.activeWorkplaceId`를 해당 id로 저장한다
  - And 근무지가 0개인 경우 `activeWorkplaceId === null`로 저장하고, 리스트 대신 `Asset.ContentIcon` + `"등록된 근무지가 없어요"` 안내와 TDS Button `"근무지 추가하기"`(`navigate('/workplace/new')`)를 표시한다 (AC-5의 `"2026년 3월 기록이 없어요"` 빈 상태는 표시하지 않는다)
  - And `location.state.yearMonth`가 `"2026-13"`·`"abc"` 등 `^\d{4}-(0[1-9]|1[0-2])$`에 맞지 않거나 미래 월이면 해당 값을 무시하고 현재 월(오늘 기준 `YYYY-MM`)로 폴백해 렌더링한다
  - And 존재하지 않는 `recordId`로 수정 화면(`/record/zzz/edit`)에 진입한 경우는 F8 AC-8에 따라 `"페이지를 찾을 수 없어요"` 화면이 표시된다
  - And 위 어떤 경우에도 예외를 throw하지 않고 `console.error`를 호출하지 않으며 화이트 스크린이 발생하지 않는다

---

### F8. 온보딩 · 고지 · 검수 정책 준수

- **Description**: 최초 실행 시 앱 사용 목적과 계산 기준을 안내하고 근무지 등록으로 연결하는 온보딩을 제공한다. 모든 결과 화면에 법적 고지를 노출하고, 토스 검수 가이드(외부 이탈 금지, 설치 유도 금지, 외부 로깅 금지, HEX 하드코딩 금지, 다크모드)를 앱 전역에서 강제한다.
- **Data**: `AppSettings.onboardingSeenAt`, `AppSettings.disclaimerAckAt`
- **API**: 해당 없음

- **AC-1 [E][P0]**: Scenario: 최초 실행 온보딩
  - Given `apg:settings:v1.onboardingSeenAt === null`일 때
  - When 앱을 실행해 `/` 진입
  - Then `/onboarding`으로 리다이렉트되어 3단계 안내(`"출퇴근만 기록하세요"`, `"주휴수당까지 자동 계산"`, `"미지급 여부까지 확인"`)가 TDS Top/Paragraph.Text로 표시된다

- **AC-2 [E][P0]**: Scenario: 온보딩 완료 후 재노출 금지
  - Given 온보딩 마지막 단계에서
  - When `SubmitFooter`의 TDS Button `"시작하기"` 탭
  - Then `apg:settings:v1.onboardingSeenAt`에 ISO8601 값이 저장되고 `navigate('/workplace/new', { replace: true })`로 이동하며
  - And 이후 앱 재실행 시 `/onboarding`으로 리다이렉트되지 않는다

- **AC-3 [E][P0]**: Scenario: 법적 고지 1회 확인
  - Given `apg:settings:v1.disclaimerAckAt === null`이고 사용자가 처음으로 급여 계산 결과를 여는 상황일 때
  - When `/breakdown` 또는 `/check/result`에 진입
  - Then TDS AlertDialog에 `"본 계산 결과는 근로기준법 기준 참고용이며 법적 효력이 없습니다"`가 1회 표시되고
  - And "확인" 탭 시 `disclaimerAckAt`이 저장되어 다음 진입부터 표시되지 않는다

- **AC-4 [W][P0]**: Scenario: 외부 도메인 이탈 금지
  - Given 앱 소스 전체에 대해
  - Then `window.location.href = 'http...'` 및 `window.open(...)` 호출이 0건이고
  - And 외부 앱 설치를 유도하는 문구(`"앱을 설치"`, `"다운로드"`)나 배너·링크가 0건이며
  - And 서비스 본질과 무관한 외부 웹/앱 이동 경로가 존재하지 않는다

- **AC-5 [U][P0]**: Scenario: 색상 토큰 / 다크모드
  - Given 프로덕션 빌드 산출물(`dist/**/*.{js,css}`)에 대해
  - When HEX 색상 리터럴(`#[0-9a-fA-F]{3,8}`)을 검색
  - Then 앱 소스 유래 HEX 하드코딩이 0건이고 모든 색상이 `var(--tds-color-*)` 또는 TDS 컴포넌트 기본값을 사용한다
  - And 다크모드에서 히어로 금액 텍스트와 배경의 대비비가 4.5:1 이상이다

- **AC-6 [U][P0]**: Scenario: 콘솔 에러 / 외부 로깅 / 호환성
  - Given 프로덕션 빌드를 실행해 전체 화면(`/`, `/records`, `/record/new`, `/breakdown`, `/check`, `/check/result`, `/workplace`)을 순회할 때
  - Then `console.error` 출력이 0건이고
  - And 외부 분석 SDK(Google Analytics, Amplitude, Sentry 등) 네트워크 요청이 0건이며
  - And 외부 API 호출이 0건이므로 CORS 에러가 0건이다
  - And `Object.groupBy` / `Array.prototype.at` / `structuredClone` / `Intl.Segmenter` 사용이 0건이다 (Android 7+, iOS 16+ 호환)

- **AC-7 [W][P1]**: Scenario: 프로모션 지급 한도 (향후 대비)
  - Given `grantPromotionReward({ promotionCode, amount })`를 호출하는 코드가 추가되는 경우
  - When `amount > 5000`인 값이 전달되면
  - Then 호출을 차단하고 TDS Toast `"지급 한도를 초과했어요"`를 표시한다
  - And MVP 범위에서는 해당 호출이 0건이다

- **AC-8 [S][P1]**: Scenario: 잘못된 경로 접근
  - Given 사용자가 `/unknown-path` 또는 존재하지 않는 `recordId`(`/record/zzz/edit`)로 진입할 때
  - Then `Asset.ContentIcon`과 `"페이지를 찾을 수 없어요"` 문구, TDS Button `"홈으로"`(`navigate('/', { replace: true })`)가 표시되고 화이트 스크린이 발생하지 않는다

---

## Screen Definitions

### 공통 내비게이션
- **FloatingTabBar** (템플릿 제공, TDS에 TabBar 없음): 4탭 — `홈(/)`, `기록(/records)`, `분석(/check)`, `설정(/workplace)`
- 탭 아이템 터치 타깃 ≥ 48×48px. `/onboarding`, `/record/*`, `/check/result`, `/workplace/new`, `/workplace/:id`에서는 FloatingTabBar 숨김

---

### S0. 온보딩 — `/onboarding`
- **TDS**: `Top`(단계 제목), `Paragraph.Text`(설명), `Asset.ContentIcon`(단계 일러스트), `Button`(SubmitFooter 내 `display="block"`), 단계 인디케이터는 TDS `Chip` 3개
- **골격**: `ScreenScaffold` + `SubmitFooter`
- **상태**: 로딩 없음 / 빈 상태 없음 / 에러 없음
- **터치**: "다음"·"시작하기" 버튼 높이 ≥ 48px, 단계 인디케이터 탭 불가(표시 전용)
- **Navigation state contract**
  - Incoming: `location.state = undefined`
  - Outgoing: `navigate('/workplace/new', { replace: true, state: { from: 'onboarding' } })`
- **Layout AC**: `data-testid="onboarding-step"` 요소가 정확히 1개 렌더링되고, 1차 액션 버튼은 `SubmitFooter` 내부에 존재한다

---

### S1. 홈 대시보드 — `/`
- **TDS**: `Top`(월 타이틀 + 좌우 이동 버튼), `Chip`(근무지 전환), `Card`(최근 기록), `ListRow`(기록 행), `Button`(기록 추가), `Skeleton`(로딩), `Badge`(가산 표시), `Toast`
- **템플릿**: `ScreenScaffold`, `SummaryHero`(CountUp), `Sparkline`(일별 누적 추이), `MiniBar`(기본/주휴/가산 비중), `AdSlot`, `Asset.ContentIcon`
- **상태**
  - Loading: `SummaryHero` 자리 Skeleton 1개 + ListRow Skeleton 3개
  - Empty(기록 0건, 근무지 ≥ 1): `Asset.ContentIcon` + `"아직 이번 달 기록이 없어요"` + `"기록 추가하기"` Button (F4 AC-5)
  - Empty(근무지 0개): `Asset.ContentIcon` + `"등록된 근무지가 없어요"` + `"근무지 추가하기"` Button (F4 AC-10). 기록 빈 상태와 동시에 표시하지 않는다
  - Error: 저장소 파싱 실패 시 Toast `"일부 데이터를 불러오지 못했어요"` 1회 + 히어로 `0원` 유지 + 손상 키를 `` `${key}:corrupt:{timestamp}` ``로 백업 후 빈 상태 렌더 (F4 AC-9)
  - Error(포인터 유실): `activeWorkplaceId`가 실재하지 않으면 `createdAt` 오름차순 첫 근무지로 자동 재지정, 근무지 0개면 `"등록된 근무지가 없어요"` 안내 (F4 AC-10)
- **터치**: 월 이동 `‹`/`›` 44×44px, 근무지 Chip 높이 ≥ 44px, ListRow 높이 ≥ 56px, CTA Button 높이 ≥ 48px
- **광고**: `AdSlot` — 최근 기록 Card **아래**, FloatingTabBar 위. 콘텐츠 겹침 0px
- **Navigation state contract**
  - Incoming: `location.state = undefined | { toast: string }`
  - Outgoing:
    - 기록 추가 → `navigate('/record/new', { state: { workplaceId: string; date: string } })`
    - 상세 보기 → `navigate('/breakdown', { state: { workplaceId: string; yearMonth: string } })`
    - 기록 행 탭 → `navigate('/record/:id/edit', { state: { recordId: string } })`
- **Layout AC**: `data-testid` = `pay-hero`, `pay-trend-sparkline`, `pay-composition-bar`, `recent-records-card`, `cta-add-record` 5개가 모두 존재하며 `cta-add-record`는 `display="block"`

---

### S2. 기록 입력/수정 — `/record/new`, `/record/:id/edit`
- **TDS**: `Top`, `TextField`(날짜/출근/퇴근/휴게/메모, 모두 `inputMode="numeric"` 단 메모 제외), `Chip`(시각 프리셋 `09:00`·`13:00`·`18:00`·`22:00`), `Switch`(휴일 근무 여부 — Toggle 없음), `Button`(SubmitFooter 저장), `AlertDialog`(삭제 확인), `Toast`, `Card`(일급 미리보기)
- **템플릿**: `ScreenScaffold`, `SubmitFooter`
- **상태**
  - Loading(수정 모드): TextField 자리 Skeleton 5개
  - Empty: 근무지 0개 시 폼 대신 `"먼저 근무지를 등록해주세요"` + Button
  - Error: 필드별 인라인 에러 메시지(F2 AC-5 문구 그대로), 중복 충돌 시 Toast `"같은 시간에 이미 기록이 있어요"`(신규 생성 F2 AC-6 / 수정 저장 F2 AC-9 공통)
- **터치**: 시각 프리셋 Chip 44×44px 이상, Switch 기본 터치 영역 ≥ 44px, 삭제 버튼 44×44px
- **모바일 키보드**: 숫자 필드 `inputMode="numeric"`, 포커스 시 `SubmitFooter`가 키보드 위로 밀려 입력 필드를 가리지 않음, 마지막 필드 "완료" 시 `blur()`
- **Navigation state contract**
  - Incoming: `location.state = { workplaceId: string; date: string } | { recordId: string } | undefined`
  - Outgoing: 저장/삭제 후 `navigate('/', { replace: true, state: { toast: string } })`
- **Layout AC**: `data-testid="daily-pay-preview"` Card 1개가 폼 하단에 존재하고 실근로시간·예상 일급 2행을 포함한다

---

### S3. 기록 목록 — `/records`
- **TDS**: `Top`(월 선택 + 편집 버튼), `Chip`(근무지 필터), `ListRow`(기록 행), `Badge`(야간/연장/휴일), `AlertDialog`(삭제 확인), `Skeleton`, `Toast`, `Button`
- **템플릿**: `ScreenScaffold`, `AdSlot`, `Asset.ContentIcon`
- **스크롤**: 페이지 스크롤 사용. 초기 50건 렌더 후 하단 도달 시 50건씩 추가(무한 스크롤). 중첩 스크롤 컨테이너 금지. 동시 DOM ListRow ≤ 50 + 추가분
- **상태**
  - Loading = Skeleton ListRow 3개
  - Empty(기록 0건, 근무지 ≥ 1) = `Asset.ContentIcon` + `"2026년 3월 기록이 없어요"` + `"기록 추가하기"` Button
  - Empty(근무지 0개) = `Asset.ContentIcon` + `"등록된 근무지가 없어요"` + `"근무지 추가하기"` Button (F7 AC-10)
  - Error(저장소 손상) = 손상 키를 `` `${key}:corrupt:{timestamp}` ``로 백업 후 폴백값 적용, Toast `"일부 데이터를 불러오지 못했어요"` 1회 + 빈 리스트 (F7 AC-9)
  - Error(잘못된 state) = 존재하지 않는 `workplaceId`는 `createdAt` 오름차순 첫 근무지로, 형식 불일치·미래 `yearMonth`는 현재 월로 폴백 (F7 AC-10)
- **터치**: ListRow ≥ 56px, 삭제 버튼 44×44px, 월 이동 버튼 44×44px
- **광고**: `AdSlot` — 리스트 마지막 행 아래
- **Navigation state contract**
  - Incoming: `location.state = undefined | { workplaceId: string; yearMonth: string }` (유효하지 않은 값은 F7 AC-10 규칙으로 폴백)
  - Outgoing: `navigate('/record/:id/edit', { state: { recordId: string } })`
- **Layout AC**: `data-testid="record-list"` 컨테이너 1개와 `data-testid="record-row"` N개(N = 표시 기록 수)가 존재한다

---

### S4. 급여 상세 — `/breakdown`
- **TDS**: `Top`, `Card`(항목 내역·주차별 주휴·세후), `ListRow`(항목 행), `Badge`(충족/미충족), `Paragraph.Text`(고지), `AlertDialog`(최초 법적 고지), `Skeleton`
- **템플릿**: `ScreenScaffold`, `MiniBar`(항목 비중), `Asset.ContentIcon`
- **상태**: Loading = Skeleton Card 3개 / Empty = `"계산할 기록이 없어요"` + Button / Error = 계산 실패 시 해당 항목 제외 후 나머지 표시
- **터치**: 주차 행 탭 시 해당 주 기록으로 이동(터치 타깃 ≥ 56px)
- **광고**: `AdSlot` — 고지 문구 **위**, 마지막 Card 아래
- **Navigation state contract**
  - Incoming: `location.state = { workplaceId: string; yearMonth: string } | undefined` (undefined이면 `activeWorkplaceId` + 현재 월 사용)
  - Outgoing: 주차 행 탭 → `navigate('/records', { state: { workplaceId: string; yearMonth: string } })`
- **Layout AC**: `data-testid` = `breakdown-card`, `weekly-holiday-card`, `net-pay-row` 3개가 존재하고, 최저임금 위반 시에만 `minimum-wage-warning`이 추가된다

---

### S5. 미지급 분석 입력 — `/check`
- **TDS**: `Top`, `Chip`(근무지 선택), `TextField`(대상 월 `YYYY-MM`, 실지급액 — `inputMode="numeric"`), `Card`(계산액 요약), `Button`(SubmitFooter `"미지급 분석하기"`), `Toast`
- **템플릿**: `ScreenScaffold`, `SubmitFooter`
- **상태**: Loading = Skeleton Card 1개 / Empty = 기록 0건 시 `"해당 월 출퇴근 기록이 없어요"` 인라인 안내 + 버튼 `disabled` / Error = 인라인 에러 메시지
- **모바일 키보드**: 금액 필드 `inputMode="numeric"`, 천 단위 콤마 자동 포맷(`206,400`), 저장 시 숫자로 파싱
- **터치**: 근무지 Chip ≥ 44px, 제출 버튼 ≥ 48px
- **Navigation state contract**
  - Incoming: `location.state = undefined | { workplaceId: string; yearMonth: string }`
  - Outgoing: `navigate('/check/result', { state: { workplaceId: string; yearMonth: string; actualPaidAmount: number } })`
- **Layout AC**: `data-testid="calculated-summary-card"` Card 1개가 존재하고 `"계산 예상액"` 값을 포함한다

---

### S6. 미지급 분석 결과 — `/check/result`
- **TDS**: `Top`, `Card`(비교·차액·추정 항목), `Badge`(`"미지급 의심"`/`"정상 지급"`), `ListRow`(추정 항목), `Button`(SubmitFooter `"분석 결과 저장"`), `Paragraph.Text`(고지), `Skeleton`, `Toast`
- **템플릿**: `ScreenScaffold`, `SubmitFooter`, `TossRewardAd`(결과 게이트), `SummaryHero`(차액 CountUp), `MiniBar`(계산액 vs 실지급액 비교), `Asset.ContentIcon`
- **리워드 광고 게이트**: `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>` 안에 `compare-card` / `diff-hero` / `suspect-card` 전체를 감싼다. 잠금 상태에서는 항목명만 블러 처리되고 금액은 노출하지 않는다
- **상태**
  - Loading: 계산·광고 로드 중 Skeleton Card 2개, `0원` 선노출 금지
  - Empty: `location.state`가 없으면 `"분석할 데이터가 없어요"` + `navigate('/check')` Button
  - Error: 광고 실패 시 `"광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"` + `"다시 시도"` Button, 결과는 잠금 유지
- **터치**: `"결과 보기(광고 시청)"` 버튼 높이 ≥ 48px, `"다시 시도"` ≥ 44px
- **광고**: 리워드 광고만 사용. 이 화면에는 배너 `AdSlot`을 배치하지 않는다(결과 가림 방지)
- **Navigation state contract**
  - Incoming: `location.state = { workplaceId: string; yearMonth: string; actualPaidAmount: number }`
  - Outgoing: 저장 후 `navigate('/check', { replace: true, state: { toast: '분석 결과를 저장했어요' } })`
- **Layout AC**: 해제 상태에서 `data-testid` = `compare-card`, `diff-hero`, `suspect-card`(≥1개)가 존재하고 차액은 t2 강조 타이포 + Badge로 표기된다

---

### S7. 근무지 설정 — `/workplace`, `/workplace/new`, `/workplace/:id`
- **TDS**: `Top`, `ListRow`(근무지 행 — 이름/시급/5인 여부), `TextField`(이름·시급·지급일), `Switch`(5인 이상 사업장 / 3.3% 원천징수), `Chip`(색상 토큰 4종), `Button`(SubmitFooter 저장, 삭제), `AlertDialog`(삭제 확인), `Toast`, `Skeleton`
- **템플릿**: `ScreenScaffold`, `SubmitFooter`, `Asset.ContentIcon`
- **삭제 UX**: 근무지 삭제는 하드 삭제 1종만 제공한다(아카이브/숨김 액션 없음). 삭제 AlertDialog는 연결된 기록·분석 결과 건수를 문구에 포함하고(F1 AC-3), 확인 시 `apg:records:v1`·`apg:paychecks:v1`의 해당 `workplaceId` 행과 `activeWorkplaceId` 포인터까지 함께 정리한다(F1 AC-9)
- **상태**: Loading = Skeleton ListRow 2개 / Empty = `"등록된 근무지가 없어요"` + `"근무지 추가하기"` Button / Error = 인라인 에러 메시지(F1 AC-4 문구) · 삭제 실패 시 Toast `"삭제하지 못했어요. 다시 시도해주세요"`
- **터치**: ListRow ≥ 56px, Switch ≥ 44px, 색상 Chip 44×44px
- **모바일 키보드**: 시급·지급일 `inputMode="numeric"`, 시급 천 단위 콤마 포맷
- **Navigation state contract**
  - Incoming(`/workplace`): `location.state = undefined | { toast: string }`
  - Incoming(`/workplace/:id`): `location.state = { workplaceId: string } | undefined` (undefined이면 URL param 사용)
  - Incoming(`/workplace/new`): `location.state = { from: 'onboarding' } | undefined`
  - Outgoing: 저장 후 — `from === 'onboarding'`이면 `navigate('/', { replace: true })`, 그 외 `navigate('/workplace', { replace: true, state: { toast: '근무지가 저장되었어요' } })`
- **Layout AC**: `data-testid="workplace-row"` N개(N = `apg:workplaces:v1` 배열 길이, 최대 5)가 존재하고, 5인 이상 사업장인 행에만 TDS Badge `"5인 이상"`이 표시된다

---

### S8. 404 — `*`
- **TDS**: `Top`, `Paragraph.Text`, `Button`
- **템플릿**: `ScreenScaffold`, `Asset.ContentIcon`
- **Navigation state contract**: Incoming `undefined` / Outgoing `navigate('/', { replace: true })`
- **Layout AC**: `data-testid="not-found"` 요소 1개가 존재하고 화이트 스크린이 발생하지 않는다

---

## API Contract

**해당 없음.** 본 MVP는 모든 계산을 클라이언트에서 수행하고 데이터를 localStorage에만 저장하므로 외부 API 호출이 0건이다. 따라서 CORS 설정 대상 엔드포인트도 존재하지 않는다.

향후 다기기 동기화가 필요해질 경우에만 별도 Railway 배포 API 서버를 설계한다(MVP 범위 밖). 그 경우 적용할 규약:

| 항목 | 규약 |
|---|---|
| Base URL | `import.meta.env.VITE_API_BASE_URL` (env 주입, 재빌드 불필요) |
| 인증 | `Authorization: Bearer <토스 세션 기반 토큰>` |
| 에러 응답 | 모든 실패 응답은 `{ error: string }` 단일 형태 |
| 에러 코드 | `400` 검증 실패 / `401` 인증 실패 / `409` 충돌 / `500` 서버 오류 |
| 타입 | 요청/응답 모든 필드에 명시적 TypeScript 타입 정의 필수 |

---

## Assumptions

1. **최저임금 상수**: 2025년 10,030원, 2026년 10,320원을 코드 상수 `MINIMUM_WAGE_BY_YEAR`로 하드코딩한다. 미정의 연도는 가장 최근 정의 연도 값을 사용하고, 그 경우 위반 판정을 `false`로 고정한다.
2. **주 시작 요일**: 월요일(ISO week). 주휴수당의 월 귀속은 해당 주 월요일이 속한 달로 통일한다.
3. **개근 요건**: 주휴수당의 "결근 없이 개근" 요건은 앱이 소정근로일 정보를 보유하지 않으므로, **기록된 근무시간 기준(주 15시간 이상)**으로만 판정한다. 이 한계를 `/breakdown` 화면 보조 텍스트로 명시한다.
4. **가산수당 중복**: 야간 + 연장이 동시 발생하면 각각 0.5씩 별도 가산한다(중복 가산). 단 연장 판정에서 "1일 8h 초과"와 "주 40h 초과"는 중복 계산하지 않고 더 큰 쪽 하나만 적용한다.
5. **세금**: 4대보험 가입자(근로소득) 계산은 MVP 범위 밖이며, `taxType`은 `none` / `freelance3_3` 2종만 지원한다.
6. **생성형 AI 미사용**: 모든 결과물이 결정론적 규칙 계산이므로 생성형 AI 고지 의무(AI 사전 고지, AI 결과물 라벨) 대상이 아니다. 대신 법적 효력 관련 고지를 전 결과 화면에 노출한다.
7. **광고 식별자**: `VITE_TOSS_AD_GROUP_ID`, `VITE_TOSS_AD_SLOT_ID`는 앱인토스 콘솔에서 발급받아 env로 주입하며 코드에 하드코딩하지 않는다.
8. **수익화**: 광고 단독. IAP(`TossPurchase`)와 `grantPromotionReward`는 MVP에서 사용하지 않는다.
9. **기기/데이터 범위**: 데이터는 단일 기기 localStorage에만 존재하며 앱 삭제·브라우저 데이터 삭제 시 소실된다. 이 사실을 `/workplace` 화면 하단에 고지한다.
10. **근무지 삭제 정책**: 소프트 삭제(아카이브)를 도입하지 않고 하드 삭제만 제공한다. 따라서 `Workplace`에 `archived` 필드가 없으며, 5개 상한은 저장된 배열 길이로 판정한다. 삭제 시 연결 `WorkRecord`·`PayCheck`를 함께 제거하므로 고아 레코드가 발생하지 않는다.
11. **손상 백업 키 보존 정책**: `` `${key}:corrupt:{timestamp}` `` 백업 키는 자동 삭제하지 않는다(사용자 데이터 복구 가능성 보존). 단 백업 쓰기 시 `QuotaExceededError`가 발생하면 백업을 생략하고 폴백만 수행한다(F1 AC-6).
12. **AppSettings 싱글턴 예외**: `AppSettings`는 키당 1개만 존재하는 설정 객체이므로 `id`/`createdAt`/`updatedAt` 규약에서 명시적으로 제외한다(Data Models 참조). 마이그레이션(F1 AC-8)의 `updatedAt` 백필 대상은 `Workplace`·`WorkRecord`·`PayCheck` 3개 컬렉션이다.
13. **작업 패킷 매핑 기준**: F1(3패킷: 저장소 유틸·키별 손상 복구 / 근무지 CRUD UI / 연쇄 삭제·활성 포인터 정합성), F2(2패킷: 폼 + 검증 / 수정·삭제·수정 시 중복 검사), F3(2패킷: 일별 계산 / 주휴·최저임금), F4(2패킷: 히어로+계산 연동 / 시각화+광고+에러 폴백), F5(1패킷), F6(2패킷: 입력·계산 / 광고 게이트·결과 UI·덮어쓰기), F7(2패킷: 리스트·페이지네이션·삭제 / 손상·잘못된 파라미터 폴백), F8(1패킷) — 총 **15 패킷**.

---

## Open Questions

1. **주 40시간 상한 주휴수당**: 주 48시간 근무 시 주휴수당을 40시간 기준(8시간분)으로 상한 처리하는 현행 규칙을 유지할지, 실근로시간 전량 기준으로 계산할지 확정 필요. (현재 SPEC은 40시간 상한)
2. **여러 근무지 합산 뷰**: 홈 히어로를 "활성 근무지 1곳"이 아닌 "전체 근무지 합산"으로 보여주는 모드를 MVP에 포함할지. (현재 SPEC은 근무지별 분리)
3. **리워드 광고 해제 기간**: 24시간 해제가 적절한지, 혹은 "월 1회 시청 시 해당 월 영구 해제"가 전환율·유저 불만 균형상 나은지 A/B 필요.
4. **캘린더 뷰**: 기록 목록을 리스트 대신 월 캘린더 그리드로 제공할지 여부(P2 후보, 현재 SPEC 미포함).
5. **주휴일 지정**: 사용자가 근무지별 주휴일 요일(예: 일요일)을 직접 지정하게 할지. 현재는 `isHoliday` 수동 체크로 대체.
6. **최저임금 위반 후속 행동**: 고용노동부 임금체불 신고 안내를 텍스트로만 제공 중. 공공기관 링크는 검수 허용 범위이나 실제 링크 노출 여부는 검수 리스크 검토 후 결정 필요.
7. **퇴사 근무지 보관**: 하드 삭제만 제공하면 "그만둔 알바의 과거 급여 기록"을 남길 방법이 없다. 향후 아카이브(읽기 전용 보관) 기능을 별도 액션으로 추가할지, 상한 5개에서 제외할지 검토 필요. (현재 SPEC은 하드 삭제만)
8. **중복 기록 UX**: 수정 시 중복이 감지되면 현재는 저장 거부(F2 AC-9)만 제공한다. 향후 "기존 기록으로 이동" 또는 "두 기록 병합" 액션을 AlertDialog로 제공할지 검토 필요.

---

## 변경 요약 (1차 수정)

| 이슈 | 반영 위치 |
|---|---|
| `updatedAt` 부재 | `Workplace`/`PayCheck` 스키마에 `updatedAt: string` 추가, F1 AC-1·AC-2(시급 수정)·AC-8(마이그레이션), F6 AC-6(덮어쓰기) 갱신 |
| PayCheck 연쇄 삭제 미정의 | F1 AC-3에 `apg:paychecks:v1` 동시 삭제 + 롤백 조건 추가, S7 삭제 UX 명시 |
| `activeWorkplaceId` 댕글링 | F1 AC-9 신설(`createdAt` 오름차순 첫 근무지 또는 `null`), F4 AC-10(포인터 유실 방어), S1 Error 상태 갱신 |
| `archived` 모순 | `Workplace`에서 `archived` 제거, F1 AC-5를 배열 길이 기준으로 수정, Assumption 10 신설, Open Question 7 추가 |
| F4 실패 AC 부재 | F4 AC-9(저장소 손상 폴백: 토스트 + 히어로 0원 + 빈 상태) 및 AC-10 추가로 실패 AC 2건 확보 |

## 변경 요약 (2차 수정)

| 이슈 | 반영 위치 |
|---|---|
| 손상 백업 키가 `apg:records:v1:corrupt:*`로 하드코딩 | localStorage 섹션의 손상 복구 규칙을 `` `${key}:corrupt:${timestamp}` `` 템플릿으로 변경 + 키별 기본 폴백값 표(`DEFAULT_SETTINGS` 포함) 추가, F1 AC-6을 4개 키 공통으로 재작성, F4 AC-9에 키별 백업·폴백 분기 추가, Assumption 11 신설 |
| F1 AC-9의 근무지 0개 빈 상태 참조 오류 | F1 AC-9의 교차 참조를 F4 AC-5 → **F4 AC-10**으로 수정하고 `"등록된 근무지가 없어요"` 문구 명시, F4 AC-5에 "근무지 ≥ 1일 때만 적용" 조건 추가, S1 상태 목록을 두 빈 상태로 분리 |
| F7에 `[W]` AC 부재 | F7 AC-9(저장소 손상 → 빈 리스트 + Toast 1회 + 키별 백업, `console.error` 0건), F7 AC-10(존재하지 않는 `workplaceId` 재지정·근무지 0개 안내·잘못된 `yearMonth` 현재 월 폴백) 신설, S3 상태/Incoming 계약 갱신 |
| `AppSettings`의 id/createdAt/updatedAt 규약 불일치 | Data Models의 `AppSettings`에 **싱글턴 예외** 근거 3가지 명시, F1 AC-8에 "AppSettings는 백필 대상 제외" 및 `WorkRecord` 포함 3컬렉션 대상 명시, Assumption 12 신설 |
| 수정 경로에서 중복 기록 검사 누락 | `WorkRecord` 제약에 "생성·수정 공통, 자기 자신 제외" 규칙 추가, F2 AC-4에 저장 전 유니크 재검사 단계 추가, F2 AC-6 제목을 "신규 생성"으로 한정, **F2 AC-9 [W] 신설**(rec-1을 rec-2와 동일 조합으로 수정 시 거부), F2 Requirements·S2 Error 상태·Open Question 8 갱신 |