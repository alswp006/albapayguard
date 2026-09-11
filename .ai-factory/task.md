# TASK — AlbaPayGuard

전제: 템플릿이 이미 제공하는 것(`ScreenScaffold`/`PageShell`, `SubmitFooter`, `FloatingTabBar`, `SummaryHero`, `Sparkline`, `MiniBar`, `AdSlot`, `TossRewardAd`, TDS 셋업, 토스 로그인 자동)에 대한 작업 패킷은 만들지 않는다. 총 25 패킷.

---

## Epic 1. TypeScript 타입 + 인터페이스

**Risk Assessment**
Complexity: Low
Risk factors: `RouteState` 누락 시 7개 페이지가 서로 다른 `location.state` 형태를 가정해 새로고침·딥링크에서 런타임 크래시(SplitMate 실사고 유형) / 필드명(`updatedAt`, `colorToken`, `rewardUnlocks`)이 SPEC과 어긋나면 저장소·계산·UI 전 계층 재작업 / `AppSettings` 싱글턴 예외(id·createdAt·updatedAt 없음)를 어기면 F1-AC-8 위반
Mitigation: 런타임 코드보다 먼저 순수 타입만 확정 → 이후 모든 패킷이 이 파일을 import하므로 불일치가 컴파일 타임에 즉시 드러난다. 순수 타입 파일이라 10분 내 완료 가능.

### Task 1.1 엔티티 타입 · 상수 · RouteState 정의
- Description: `src/lib/types.ts`에 SPEC Data Models 전체를 타입으로 정의한다. 엔티티 `TaxType`/`Workplace`/`WorkRecord`/`PayCheck`/`SuspectKind`/`PaySuspect`/`AppSettings`, 계산 결과 `DailyPay`/`WeeklyHoliday`/`MonthlyPayroll`, 상수 `STORAGE_KEYS`(`apg:workplaces:v1`·`apg:records:v1`·`apg:paychecks:v1`·`apg:settings:v1`)·`DEFAULT_SETTINGS`·`MINIMUM_WAGE_BY_YEAR = { 2025: 10030, 2026: 10320 }`·`SCHEMA_VERSION = 1`·`MAX_WORKPLACES = 5`·`MAX_SERIALIZED_LENGTH = 4_500_000`·`COLOR_TOKENS`. 그리고 **RouteState 필수**: `export type RouteState = { '/': { toast: string } | undefined; '/onboarding': undefined; '/record/new': { workplaceId: string; date: string } | undefined; '/record/edit': { recordId: string } | undefined; '/records': { workplaceId: string; yearMonth: string } | undefined; '/breakdown': { workplaceId: string; yearMonth: string } | undefined; '/check': { workplaceId: string; yearMonth: string } | { toast: string } | undefined; '/check/result': { workplaceId: string; yearMonth: string; actualPaidAmount: number } | undefined; '/workplace': { toast: string } | undefined; '/workplace/new': { from: 'onboarding' } | undefined; '/workplace/detail': { workplaceId: string } | undefined; }`. 런타임 로직 금지(상수 선언만 허용).
- DoD: `npx tsc --noEmit`(strict) 통과 · `AppSettings`에 `id`/`createdAt`/`updatedAt` 필드 0개 · `Workplace`·`WorkRecord`·`PayCheck` 3종 모두 `createdAt: string`과 `updatedAt: string` 보유 · `RouteState`의 모든 키가 `| undefined`를 포함해 "state 없이 진입"을 타입 수준에서 강제 · 파일 내 `function` 선언 0건, DOM/localStorage 참조 0건, React import 0건
- Covers: [F1-AC-8 (스키마 필드 정의), F3-AC-8 (MonthlyPayroll 계약), F8-AC-6 (최신 전용 API 미사용 타입 기반)]
- Files: [src/lib/types.ts]
- Depends on: none

---

## Epic 2. 데이터 레이어 + 계산 엔진 (API Routes 대체 — 외부 API 0건)

**Risk Assessment**
Complexity: High
Risk factors: 손상 백업 키를 `apg:records:v1:corrupt:*`로 하드코딩하는 실수(2차 수정 지적 결함) → F1-AC-6·F4-AC-9·F7-AC-9 동시 실패 / 연쇄 삭제 3키 쓰기 부분 실패 시 고아 레코드 발생 → F1-AC-3 실패 / 급여 계산을 한 함수에 몰면 10분 초과 + F3 AC 일부가 조용히 틀림 / `console.error` 1건이라도 남으면 F8-AC-6 실패 / localStorage 5MB 한도는 추정 0.29MB로 여유 있으나 `:corrupt:` 백업 누적 시 접근 가능
Mitigation: 원시 I/O(2.1) → 컬렉션 CRUD(2.2) → 정합성·연쇄(2.3)로 3단 분리해 백업 키 템플릿을 단 한 곳에서만 구현 / 계산 엔진을 일별(2.4)·월별주휴(2.5)·분석(2.6)로 3분할해 단위 테스트로 전량 검증 / 상태 관리(2.7)를 마지막에 두어 UI가 저장소를 직접 만지지 못하게 차단 / 4,500,000자 가드와 QuotaExceeded 롤백을 2.1에 선제 내장

### Task 2.1 저장소 원시 I/O — 키별 손상 복구 & 쓰기 가드
- Description: `src/lib/storage.ts`에 `readRaw<T>(key, fallback, isValid)`(파싱 실패·형태 불일치 시 원본을 `` `${key}:corrupt:${Date.now()}` ``에 백업 → 원본 키를 fallback으로 덮어쓰기 → fallback 반환 → 내부 플래그 `corruptionDetected = true`), `writeRaw<T>(key, value): { ok: true } | { ok: false; reason: 'quota' | 'size' }`(`JSON.stringify` 길이 > 4,500,000이면 `size`, `QuotaExceededError`면 `quota`, throw 금지), `consumeCorruptionFlag(): boolean`(최초 1회만 true), 타입 가드 `isWorkplaceArray`/`isRecordArray`/`isPayCheckArray`/`isSettingsObject`(객체이며 null·배열 아님)를 구현한다.
- DoD: 소스에 `':corrupt:'` 리터럴이 템플릿 조립부 1곳에만 등장하고 백업 키가 `key` 변수로 조립됨(`apg:records:v1:corrupt` 등 하드코딩 0건) · `apg:workplaces:v1="[[bad"` → 반환 `[]` + 백업 키 `apg:workplaces:v1:corrupt:{Date.now()}` 생성 · `apg:paychecks:v1="null"` → 반환 `[]` · `apg:settings:v1="[]"` → 반환 `DEFAULT_SETTINGS` + 백업 키 `apg:settings:v1:corrupt:{Date.now()}` · 백업 키 문자열에 `"undefined"` 미포함 · 백업 쓰기가 quota로 실패하면 백업 생략 후 폴백 반환만 수행 · `writeRaw`가 실패 시에도 예외 미전파 · 파일 내 `console.error` 0건, React/TDS import 0건
- Covers: [F1-AC-6]
- Files: [src/lib/storage.ts]
- Depends on: Task 1.1

### Task 2.2 컬렉션 리포지토리 · 검증 · 스키마 마이그레이션
- Description: `src/lib/repository.ts`에 2.1만을 통한 CRUD를 구현한다 — `getWorkplaces`/`saveWorkplace`(`crypto.randomUUID()`, `createdAt === updatedAt`)/`updateWorkplace`(createdAt 유지, updatedAt 갱신), `getRecords`/`getRecordById`/`saveRecord`/`updateRecord`/`deleteRecord`, `isDuplicateRecord({ id?, workplaceId, date, startTime })`(id가 있으면 동일 id를 비교에서 제외 — 생성·수정 공용), `getPayChecks`/`upsertPayCheck`(동일 `(workplaceId, yearMonth)` 존재 시 id·createdAt 유지 + 나머지 교체 + updatedAt 갱신, 없으면 신규), `getSettings`/`patchSettings`, `runMigration()`(schemaVersion 없거나 1 미만이면 `schemaVersion:1` + `rewardUnlocks:{}` 보강, `Workplace`/`WorkRecord`/`PayCheck` 3컬렉션의 `updatedAt` 누락분을 `createdAt`으로 백필, `AppSettings`에는 id/createdAt/updatedAt 추가 금지), 검증 헬퍼 `validateWorkplace`(`"근무지 이름을 입력해주세요"`, `"시급을 1원 이상 입력해주세요"`)/`validateRecord`(`"시각을 HH:mm 형식(00:00~23:59)으로 입력해주세요"`, `"휴게시간이 근무시간보다 길 수 없어요"`).
- DoD: `updateWorkplace('wp-1',{hourlyWage:12000})` 후 createdAt 불변 + `updatedAt > createdAt` · `upsertPayCheck` 2회 후 `(wp-1,2026-03)` 행 수 1건 + `updatedAt > createdAt` + id·createdAt 유지 · `isDuplicateRecord({id:'rec-1',workplaceId:'wp-1',date:'2026-03-02',startTime:'18:00'})`가 rec-1 자신만 매칭될 때 `false` · 마이그레이션 후 `getSettings()` 키 집합에 id/createdAt/updatedAt 없음 · 모든 쓰기 경로가 `writeRaw` 반환값을 확인해 `{ok:false,reason}`을 호출자에게 전파(throw 0건) · React import 0건, `console.error` 0건
- Covers: [F1-AC-8, F2-AC-6, F2-AC-9, F6-AC-6]
- Files: [src/lib/repository.ts]
- Depends on: Task 2.1

### Task 2.3 연쇄 삭제 트랜잭션 & 활성 근무지 포인터 정합성
- Description: `src/lib/workplaceIntegrity.ts`에 `deleteWorkplaceCascade(id)`(3키 스냅샷 → workplaces에서 id 제거 + records·paychecks에서 `workplaceId===id` 전부 제거 → 쓰기 중 하나라도 실패하면 3키 모두 스냅샷 복원 후 `{ok:false}` → 성공 시 `resolveActiveWorkplaceId()` 결과를 `{ok:true,nextActiveId}`로 반환), `resolveActiveWorkplaceId()`(현재 포인터가 실재하면 유지, 실재하지 않거나 null이면 남은 근무지를 `createdAt` 오름차순 정렬한 첫 id를 저장 후 반환, 0개면 null 저장 후 반환), `countLinked(id): { records, paychecks }`, `canAddWorkplace(): boolean`(`length < 5`)을 구현한다.
- DoD: wp-1(기록3+분석2)/wp-2(기록2+분석1)에서 `deleteWorkplaceCascade('wp-1')` 후 `getRecords().length===2`, `getPayChecks().length===1`, `workplaceId==='wp-1'` 행 0건 · 쓰기 실패 주입 시 3키 모두 삭제 전 값과 정확히 일치 + `{ok:false}` 반환(고아 레코드 0건) · `activeWorkplaceId==='wp-1'`, wp-1(2026-01-01)/wp-2(2026-02-01)/wp-3(2026-03-01)에서 wp-1 삭제 → 저장된 `activeWorkplaceId==='wp-2'` · 전부 삭제 시 `activeWorkplaceId===null` 저장 · 비활성 근무지 삭제 시 포인터 불변 · `canAddWorkplace()`가 길이 5에서 false, 4에서 true · `console.error` 0건, throw 0건
- Covers: [F1-AC-3, F1-AC-5, F1-AC-9, F4-AC-10, F7-AC-10]
- Files: [src/lib/workplaceIntegrity.ts]
- Depends on: Task 2.2

### Task 2.4 급여 계산 엔진 ① 일별 계산 (순수 함수)
- Description: `src/lib/payrollDaily.ts`에 `parseHHmm(s)`(`^([01]\d|2[0-3]):([0-5]\d)$` 불일치 시 null), `calcWorkedMinutes(start,end,breakMinutes)`(`end <= start`면 +24h), `calcNightMinutes(start,end)`(22:00~06:00 교집합, 자정 넘김 포함), `calcDaily(record, workplace): DailyPay | null`을 구현한다. 비정상 입력(시각 파싱 실패, `breakMinutes < 0 || > 720`, 실근로시간 ≤ 0)이면 null 반환(throw·로그 없음). `basePay = floor(workedMinutes/60*wage)`, `overtimeMinutes = max(0, workedMinutes-480)`, `nightPay`/`overtimePay`는 `×0.5` 후 floor, `holidayPay`는 `isHoliday`일 때 8h 이내분×0.5 + 초과분×1.0, `isFiveOrMore===false`면 야간·연장·휴일 수당 0원(분 단위 값은 표시용 유지), `total = basePay+nightPay+overtimePay+holidayPay`. UI·저장소 import 0건.
- DoD: `{wage:10320,isFiveOrMore:true}` + `18:00~23:00/break30` → `workedMinutes===270`, `basePay===46440`, `nightMinutes===60`, `nightPay===5160`, `total===51600` · `22:00~02:00/break0` → `workedMinutes===240`, `basePay===41280`, `total===61920` · `{isFiveOrMore:false}` + `13:00~24:00/break60` → `nightPay===0`, `overtimePay===0`, `holidayPay===0`, `basePay===103200` · `{isFiveOrMore:true}` + `09:00~21:00/break60` → `overtimeMinutes===180`, `overtimePay===15480`, `nightMinutes===0` · `startTime:'abc'` 또는 `breakMinutes:-10` → `null` 반환, throw 0건, `console.error` 0건 · `Object.groupBy`/`Array.prototype.at`/`structuredClone`/`Intl.Segmenter` 사용 0건
- Covers: [F3-AC-1, F3-AC-4, F3-AC-5, F3-AC-7, F2-AC-2]
- Files: [src/lib/payrollDaily.ts]
- Depends on: Task 1.1

### Task 2.5 급여 계산 엔진 ② 주휴수당 · 최저임금 · 월 집계
- Description: `src/lib/payroll.ts`에 `calcMonthly(records, workplace, yearMonth): MonthlyPayroll`을 구현한다. 대상 필터는 `workplaceId` 일치 + `date.startsWith(yearMonth)`. `getWeekStart(date)`로 ISO week(월요일 시작) 월요일을 구하고, 주휴수당은 **해당 주 월요일이 속한 년월**이 `yearMonth`인 주만 `weeks`에 포함. `eligible = weeklyMinutes >= 900`, `amount = eligible ? floor(min(weeklyMinutes,2400)/5/60*wage) : 0`. 연장은 일 8h 초과분과 주 40h 초과분 중 **더 큰 쪽 하나만** 적용(Assumption 4). 최저임금은 `MINIMUM_WAGE_BY_YEAR[연도]`, 미정의 연도는 최근 정의 연도 값 사용 + `isBelowMinimumWage=false` 고정, `minimumWageShortfall = floor((minimumWage-wage)*totalMinutes/60)`(위반 시에만). `gross = base+night+overtime+holiday+weeklyHoliday`, `net = taxType==='freelance3_3' ? floor(gross*0.967) : gross`. 항목별 floor 후 합산.
- DoD: `{wage:10320}` + 2026-03-02(월)~03-06(금) 각 4시간 → `weeks[0]`가 `{weekStart:'2026-03-02',weeklyMinutes:1200,eligible:true,amount:41280}`와 정확히 일치, `weeklyHolidayPay===41280` · 03-02~03-04 각 4시간(주 12h) → `weeks[0].eligible===false`, `amount===0`, `weeklyHolidayPay===0` · `{wage:9800}` + 2026-03 기록 존재 → `minimumWage===10320`, `isBelowMinimumWage===true`, `minimumWageShortfall===Math.floor(520*totalMinutes/60)` · 기록 0건 `calcMonthly(...,'2026-04')` → `gross===0`, `net===0`, `daily.length===0`, `weeks.length===0`, `isBelowMinimumWage===false` · `{wage:10320,isFiveOrMore:true}` 5일×4시간 → `gross===247680` · `{taxType:'freelance3_3'}` + `gross===252840` → `net===244496` · 비정상 레코드 혼입 시 daily에서 제외 후 나머지 집계, throw·`console.error` 0건
- Covers: [F3-AC-2, F3-AC-3, F3-AC-6, F3-AC-8, F5-AC-5]
- Files: [src/lib/payroll.ts]
- Depends on: Task 2.4

### Task 2.6 미지급 분석 산출 · 리워드 해제 헬퍼 · 금액 포맷
- Description: `src/lib/analysis.ts`에 `buildSuspects(payroll, workplace): PaySuspect[]`(`weeklyHolidayPay>0` → `{kind:'weeklyHoliday',label:'주휴수당 미지급 의심',amount,description}`, 동일 방식 `night`/`overtime`/`holiday`, `isBelowMinimumWage`면 `{kind:'minimumWage',label:'최저임금 미달',amount:minimumWageShortfall}`, `amount===0` 항목 제외), `analyzePayCheck({payroll,actualPaidAmount,workplace})` → `{calculatedGross,calculatedNet,diff,suspects,isUnderpaid}`, `getUnlockKey(workplaceId,yearMonth)` → `` `${workplaceId}:${yearMonth}` ``, `isUnlocked(settings,workplaceId,yearMonth)`(저장 ISO8601이 현재보다 미래일 때만 true), `grantUnlock(workplaceId,yearMonth)`(`now+24h` ISO8601을 `patchSettings`로 저장), `formatWon`/`parseWon`을 구현한다.
- DoD: `calculatedNet:252840`, `actualPaidAmount:206400`, 주휴 41280·야간 5160 → `diff===46440`, suspects에 `{kind:'weeklyHoliday',amount:41280}`·`{kind:'night',amount:5160}` 포함, `suspects.length===2` · `actualPaidAmount:300000` → `diff===-47160`, `isUnderpaid===false` · `grantUnlock` 직후 `isUnlocked===true`, 저장값을 과거 ISO로 바꾸면 `false` · `formatWon(206400)==='206,400'`, `parseWon('206,400')===206400` · React import 0건, `console.error` 0건
- Covers: [F6-AC-2, F6-AC-3, F6-AC-4, F6-AC-7]
- Files: [src/lib/analysis.ts]
- Depends on: Task 2.5

### Task 2.7 상태 관리 — AppDataProvider (React Context)
- Description: `src/store/AppDataContext.tsx`에 전역 상태를 구현한다. 마운트 시 1회 `runMigration()` → 4키 로드 → `resolveActiveWorkplaceId()` → `consumeCorruptionFlag()`가 true면 TDS Toast `"일부 데이터를 불러오지 못했어요"`를 **1회만** 표시. 노출 값 `{ loading, workplaces, records, payChecks, settings, activeWorkplace, actions }`, actions는 `createWorkplace`/`editWorkplace`/`removeWorkplace`(2.3 호출 + 실패 시 Toast `"삭제하지 못했어요. 다시 시도해주세요"` + 상태 롤백)/`setActiveWorkplace`/`createRecord`/`editRecord`/`removeRecord`/`savePayCheck`/`markOnboardingSeen`/`markDisclaimerAck`/`unlockReward`. 모든 쓰기 액션은 `{ok:boolean}` 반환, `reason==='quota'|'size'`이면 Toast `"저장 공간이 부족합니다. 오래된 기록을 삭제해주세요"` 후 이전 상태로 롤백. `useAppData()`와 `useMonthlyPayroll(workplaceId, yearMonth)`(useMemo로 `calcMonthly`) 제공. 페이지는 저장소를 직접 호출하지 않는다.
- DoD: `loading`이 초기 true → 로드 완료 후 false로 전환(Skeleton 제어 가능) · 여러 키 동시 손상 시 손상 Toast 렌더 횟수가 정확히 1 · `removeWorkplace` 실패 시 컨텍스트의 workplaces/records/payChecks가 삭제 전 값과 동일 · Provider로 감싼 더미 컴포넌트 렌더 성공 + `npx tsc --noEmit` 통과 · Provider 내부 `console.error` 0건, 외부 네트워크 호출 0건
- Covers: [F1-AC-3, F4-AC-6, F4-AC-9, F7-AC-9]
- Files: [src/store/AppDataContext.tsx]
- Depends on: Task 2.3, Task 2.5, Task 2.6

---

## Epic 3. 코어 UI 페이지 (페이지당 1패킷)

**Risk Assessment**
Complexity: High
Risk factors: `location.state` 미검증 사용 → 새로고침·딥링크 시 화이트 스크린(실사고 2026-08-03 SplitMate, `undefined.map()`으로 완주율 0%) / TDS 컴포넌트에 Tailwind·인라인 padding·margin 덮어쓰기 → 검수 반려 / HEX 하드코딩 → 다크모드 대비 실패 + 검수 반려 / 홈·상세에 히어로+차트+광고+빈상태+에러 폴백을 한 패킷에 몰면 10분 초과 / 기록 목록을 중첩 스크롤 컨테이너로 구현하면 F7-AC-4 실패
Mitigation: 데이터·계산이 Epic 2에서 완결되어 페이지는 렌더링만 담당 → 패킷 크기 축소 / 홈·급여상세·기록목록을 각각 2패킷으로 분할 / state를 받는 모든 화면 DoD에 "state 없이 직접 진입해도 크래시하지 않는다"를 개별 명시 / 모든 페이지 DoD에 "TDS 컴포넌트 인라인 spacing 0건, HEX 0건" 포함

### Task 3.1 온보딩 페이지 `/onboarding`
- Description: 3단계 안내를 `ScreenScaffold` + `SubmitFooter`로 구현한다. 단계별 TDS `Top` 제목(`"출퇴근만 기록하세요"`, `"주휴수당까지 자동 계산"`, `"미지급 여부까지 확인"`), `Paragraph.Text` 설명, `Asset.ContentIcon` 일러스트, 상단 TDS Chip 3개 인디케이터(표시 전용, 탭 불가). 1~2단계는 `"다음"`, 3단계는 `"시작하기"`를 `SubmitFooter` 내부 `display="block"` Button으로 렌더하고, `"시작하기"` 탭 시 `markOnboardingSeen()` 후 `navigate('/workplace/new', { replace: true, state: { from: 'onboarding' } })`.
- DoD: `data-testid="onboarding-step"` 요소가 항상 정확히 1개 · 버튼 높이 ≥ 48px, 인디케이터 Chip에 onClick 0건 · `"시작하기"` 탭 후 `apg:settings:v1.onboardingSeenAt`이 ISO8601로 저장 · `replace:true`이므로 뒤로가기로 `/onboarding` 복귀 불가 · 1차 액션이 `SubmitFooter` 내부에 존재하고 좌측 글자폭 버튼 0건 · TDS 컴포넌트에 인라인 style·Tailwind `p-*`/`m-*` 0건, HEX 0건
- Covers: [F8-AC-1, F8-AC-2]
- Files: [src/pages/OnboardingPage.tsx]
- Depends on: Task 2.7

### Task 3.2 근무지 목록 `/workplace`
- Description: 근무지를 TDS ListRow(`data-testid="workplace-row"`)로 나열한다. 각 행은 이름 / `"시급 10,320원 · 지급일 10일"` 보조 텍스트 / `isFiveOrMore`인 행에만 TDS Badge `"5인 이상"`. 행 탭 → `navigate('/workplace/:id', { state: { workplaceId } })`. 상단 `"근무지 추가"` 버튼은 `canAddWorkplace()`가 false면 Toast `"근무지는 최대 5개까지 등록할 수 있어요"` 표시 후 이동하지 않는다. 빈 상태는 `Asset.ContentIcon` + `"등록된 근무지가 없어요"` + `display="block"` Button `"근무지 추가하기"`. 로딩 중 Skeleton ListRow 2개. 하단에 `"데이터는 이 기기에만 저장되며 앱 삭제 시 사라져요"` 고지. `location.state`는 `const s = (useLocation().state as RouteState['/workplace']) ?? null;`로 받아 `s?.toast`가 있을 때만 Toast 1회.
- DoD: `workplace-row` 개수가 `apg:workplaces:v1` 길이와 일치(최대 5) · 근무지 5개에서 추가 버튼 탭 → Toast 노출 + URL 변경 없음, 1개 삭제해 4개가 되면 동일 탭으로 `/workplace/new` 이동 · 빈 배열일 때 ContentIcon·`"등록된 근무지가 없어요"`·`"근무지 추가하기"` 3요소 모두 렌더 · ListRow 높이 ≥ 56px · `location.state` 없이 직접 진입해도 크래시 없이 정상 렌더(구조분해 캐스팅 0건) · TDS 인라인 spacing 0건, HEX 0건, `console.error` 0건
- Covers: [F1-AC-5, F1-AC-7]
- Files: [src/pages/WorkplaceListPage.tsx]
- Depends on: Task 2.7

### Task 3.3 근무지 생성/수정 `/workplace/new`, `/workplace/:id`
- Description: 이름·시급(`inputMode="numeric"`, 천 단위 콤마)·지급일(`inputMode="numeric"`) TextField, `5인 이상 사업장`/`3.3% 원천징수` TDS **Switch**, 색상 토큰 Chip 4종을 `SubmitFooter` 저장 버튼과 함께 렌더한다. 수정 모드에는 `"삭제"` 버튼 → AlertDialog `"기록 {n}건과 저장된 분석 결과 {m}건도 함께 삭제됩니다"`(`countLinked` 주입) → 확인 시 `removeWorkplace()`. 저장 성공 시 `from==='onboarding'`이면 `navigate('/', { replace: true })`, 아니면 `navigate('/workplace', { replace: true, state: { toast: '근무지가 저장되었어요' } })`. 생성 성공 시 `activeWorkplaceId`를 새 id로 설정. `location.state`는 null 체크 후 사용하고 없으면 URL param으로 폴백.
- DoD: 빈 저장소에서 `{name:'편의점 알바',hourlyWage:10320,isFiveOrMore:false,payday:10,taxType:'none'}` 저장 → 배열 1건, `createdAt===updatedAt`, `activeWorkplaceId`가 해당 id, Toast `"근무지가 저장되었어요"`, from 분기대로 이동 · `hourlyWage:0` 저장 시도 → TextField 하단 `"시급을 1원 이상 입력해주세요"` + 배열 길이 불변 · `name:''` → `"근무지 이름을 입력해주세요"` · wp-1(기록 3건 연결) 시급 12000 수정 → `hourlyWage===12000`, `updatedAt>createdAt`, createdAt 불변, 연결 기록 3건의 id·date·startTime 불변 · 삭제 다이얼로그 문구에 실제 연결 건수가 숫자로 표시, 삭제 실패 시 Toast `"삭제하지 못했어요. 다시 시도해주세요"`, 삭제 성공 시 홈이 `createdAt` 오름차순 첫 근무지 기준으로 렌더 · state 없이 `/workplace/wp-1` 진입 → URL param 폴백 정상 렌더, 미존재 id면 `"페이지를 찾을 수 없어요"` · Switch 터치 영역 ≥ 44px, 색상 Chip·삭제 버튼 44×44px 이상 · HEX 0건, TDS 인라인 spacing 0건
- Covers: [F1-AC-1, F1-AC-2, F1-AC-3, F1-AC-4, F1-AC-9]
- Files: [src/pages/WorkplaceFormPage.tsx]
- Depends on: Task 3.2

### Task 3.4 기록 입력 `/record/new` — 폼 · 검증 · 일급 미리보기
- Description: 날짜·출근·퇴근·휴게(모두 `inputMode="numeric"`)·메모 TextField, 시각 프리셋 Chip(`09:00`·`13:00`·`18:00`·`22:00`), 휴일 근무 Switch, `SubmitFooter` 저장 버튼을 렌더한다. 폼 하단에 `data-testid="daily-pay-preview"` TDS Card로 실근로시간·예상 일급 2행을 `calcDaily`로 실시간 표시. 휴게시간 자동 제안(직접 수정 전까지 4h↑→30, 8h↑→60) + 보조 텍스트 `"4시간 이상 30분, 8시간 이상 60분이 자동 적용돼요"`. 저장 전 `isDuplicateRecord` 검사. 근무지 0개면 폼 대신 `"먼저 근무지를 등록해주세요"` + Button `"근무지 등록하기"`. `location.state`는 null 체크 후 사용하고 없으면 오늘 날짜 + `activeWorkplaceId`로 폴백.
- DoD: `{date:'2026-03-02',startTime:'18:00',endTime:'23:00',breakMinutes:30,isHoliday:false,memo:''}` 저장 → 배열 +1건, Toast `"기록이 저장되었어요"`, `navigate('/', { replace: true })` · `22:00~02:00/break0` 입력 시 미리보기에 `"4시간 0분"`과 `"61,920원"` 표시 · `09:00~18:00` 입력 시 휴게 필드 자동 `60` + 보조 텍스트 노출, 사용자가 `30`으로 직접 수정한 뒤에는 시간대를 바꿔도 자동 채움이 덮어쓰지 않음 · `startTime:'25:00'` → `"시각을 HH:mm 형식(00:00~23:59)으로 입력해주세요"` + 미저장 · `breakMinutes` ≥ 총 근무분 → `"휴게시간이 근무시간보다 길 수 없어요"` · 기존 `{wp-1,2026-03-02,18:00}`과 동일 조합 저장 시도 → Toast `"같은 시간에 이미 기록이 있어요"` + 배열 길이 불변 · 근무지 0개로 직접 진입 → 폼 미렌더 + 안내와 `"근무지 등록하기"` 렌더 · state 없이 진입해도 크래시 없음 · 숫자 필드 전부 `inputMode="numeric"`, 저장 버튼이 `SubmitFooter` 내부라 키보드 노출 시 입력 필드를 가리지 않음, 마지막 필드 완료 시 `blur()` 호출 · 프리셋 Chip 44×44px 이상
- Covers: [F2-AC-1, F2-AC-2, F2-AC-3, F2-AC-5, F2-AC-6, F2-AC-7, F2-AC-8]
- Files: [src/pages/RecordFormPage.tsx, src/components/DailyPayPreview.tsx]
- Depends on: Task 2.7, Task 2.4

### Task 3.5 기록 수정/삭제 `/record/:id/edit` — 수정 시 중복 검사
- Description: 3.4의 폼을 수정 모드로 재사용한다. 진입 시 `recordId`(state 우선, 없으면 URL param)로 기존 값을 프리필하고, 저장 직전 `isDuplicateRecord({ id: recordId, ... })`로 **자기 자신 제외** 유니크 재검사를 수행한다. 하단 `"삭제"` 버튼 → AlertDialog `"이 기록을 삭제할까요?"` → 확인 시 제거 후 `navigate('/', { replace: true, state: { toast: '기록을 삭제했어요' } })`. 로딩 중 TextField 자리 Skeleton 5개. 존재하지 않는 `recordId`면 `"페이지를 찾을 수 없어요"` + Button `"홈으로"`.
- DoD: `rec-1.endTime`을 `"23:00"`→`"22:00"` 저장 → `endTime==='22:00'`, `updatedAt` 갱신, createdAt 유지 · rec-1의 date/startTime을 rec-2와 동일한 `(wp-1,2026-03-05,09:00)`으로 저장 시도 → Toast `"같은 시간에 이미 기록이 있어요"`, 저장 미수행, rec-1이 `{date:'2026-03-02',startTime:'18:00'}` 유지, `rec-1.updatedAt` 불변, 배열 길이 2 유지 · rec-1에서 endTime·breakMinutes·memo만 수정 → 중복 판정 없이 정상 저장 · 동일 `(workplaceId,date,startTime)` 행 수 항상 ≤ 1 · 삭제 확인 시 저장소에서 제거 + Toast · `/record/zzz/edit` 진입 → `"페이지를 찾을 수 없어요"` + `"홈으로"`, 화이트 스크린 0건 · state 없이 직접 진입해도 URL param 폴백으로 정상 동작
- Covers: [F2-AC-4, F2-AC-9, F8-AC-8]
- Files: [src/pages/RecordEditPage.tsx]
- Depends on: Task 3.4

### Task 3.6 홈 ① `/` — 히어로 · 근무지 전환 · 월 전환 · 최근 기록
- Description: `ScreenScaffold` + TDS `Top`(월 타이틀 + `‹`/`›` 44×44px)으로 홈 코어를 구현한다. 상단 TDS Chip 목록으로 근무지 전환(`setActiveWorkplace`). `SummaryHero`(`data-testid="pay-hero"`)에 `calcMonthly().gross`를 CountUp으로, 보조 라벨 `"이번 달 예상 급여 · N시간"`. `data-testid="recent-records-card"` TDS Card에 최근 기록 5건을 ListRow로. `data-testid="cta-add-record"` Button(`display="block"`) 탭 → `navigate('/record/new', { state: { workplaceId, date: 오늘 YYYY-MM-DD } })`. 기록 행 탭 → `navigate('/record/:id/edit', { state: { recordId } })`. 표시 월은 로컬 state로 제어하며 미래 월은 `›` `disabled`.
- DoD: `{wage:10320,isFiveOrMore:true,taxType:'none'}` + 2026-03-02~03-06 각 4시간 5건 → `pay-hero`에 `247,680원` CountUp, 보조 라벨 `"이번 달 예상 급여 · 20시간"` · wp-2 Chip 탭 → `activeWorkplaceId==='wp-2'` 저장 + 히어로 즉시 재계산 · 2026-03에서 `‹` 탭 → 타이틀 `2026-02` + 금액 재계산, 현재 월에서 `›`에 `disabled` 속성 존재 · `cta-add-record` 탭 시 전달 `state.date`가 오늘 `YYYY-MM-DD`와 일치 · `‹`/`›`·Chip ≥ 44px, ListRow ≥ 56px, CTA ≥ 48px · `const s = (useLocation().state as RouteState['/']) ?? null;` 패턴 사용, state 없이 진입해도 크래시 없음(toast만 생략) · TDS 인라인 spacing 0건, HEX 0건
- Covers: [F4-AC-1, F4-AC-3, F4-AC-4, F4-AC-8]
- Files: [src/pages/HomePage.tsx]
- Depends on: Task 2.7

### Task 3.7 홈 ② — 시각화 · 빈 상태 2종 · 로딩 · 배너 광고 · 손상 폴백
- Description: 3.6의 홈에 나머지 계약을 추가한다. `Sparkline`(`data-testid="pay-trend-sparkline"`, 일별 누적)과 `MiniBar`(`data-testid="pay-composition-bar"`, 기본/주휴/가산 비중). 빈 상태 2종 분기 — 근무지 ≥ 1 & 기록 0건이면 `Asset.ContentIcon` + `"아직 이번 달 기록이 없어요"` + 히어로 `0원` + `cta-add-record` 노출(차트 미렌더), 근무지 0개면 `Asset.ContentIcon` + `"등록된 근무지가 없어요"` + Button `"근무지 추가하기"`(`navigate('/workplace/new')`)만 노출. 로딩 중 히어로 Skeleton 1개 + ListRow Skeleton 3개(`0원` 선노출 금지). `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`를 `recent-records-card` 아래·FloatingTabBar 위에 1개 배치. 포인터 유실 시 `resolveActiveWorkplaceId()` 규칙 적용.
- DoD: 기록 1건 이상일 때 `pay-hero`/`pay-trend-sparkline`/`pay-composition-bar`/`recent-records-card`/`cta-add-record` 5개 testid 모두 존재하고 `cta-add-record`가 `display="block"` · 근무지 1개 + 기록 0건 → 차트 2종 미렌더, `"아직 이번 달 기록이 없어요"` 렌더, 히어로 `0원` · 근무지 0개 → `"등록된 근무지가 없어요"` 렌더 + `cta-add-record` 미렌더 + `"아직 이번 달 기록이 없어요"` 미렌더 · loading 동안 `0원` 문자열이 DOM에 미등장하고 Skeleton만 렌더 · `AdSlot` 정확히 1개이며 `recent-records-card` 다음 위치, 히어로·리스트와 겹침 0px · `apg:records:v1="{{broken"` 진입 → 히어로 `0원` + 기록 빈 상태 + Toast 1회 + `apg:records:v1:corrupt:{timestamp}` 생성 · `apg:workplaces:v1` 손상 → 자기 키 이름으로 백업 후 `"등록된 근무지가 없어요"` · `apg:settings:v1` 손상 → 자기 키 백업 + `DEFAULT_SETTINGS` 폴백 + 포인터 재지정 · `activeWorkplaceId==='wp-deleted'` → `createdAt` 오름차순 첫 근무지로 저장·렌더 · 복수 키 동시 손상 시 Toast 1회, `console.error` 0건, 화이트 스크린 0건
- Covers: [F4-AC-2, F4-AC-5, F4-AC-6, F4-AC-7, F4-AC-9, F4-AC-10]
- Files: [src/pages/HomePage.tsx, src/components/PayTrendSparkline.tsx, src/components/PayCompositionBar.tsx]
- Depends on: Task 3.6

### Task 3.8 기록 목록 `/records` — 리스트 · 배지 · 페이지네이션 · 삭제 · 광고
- Description: 선택 근무지의 표시 월 기록을 `date` 내림차순 ListRow로 렌더한다(`data-testid="record-list"` 컨테이너 + `data-testid="record-row"` N개). 각 행은 `"03월 02일 (월)"` / `"18:00–23:00 · 4시간 30분"` / 우측 `"51,600원"` / 가산 TDS Badge(`야간`·`연장`·`휴일`, 해당 값이 0 초과일 때만). 행 탭 → `navigate('/record/:id/edit', { state: { recordId } })`. 상단 `"편집"` 버튼으로 편집 모드 진입 → 행별 삭제 버튼(44×44px) → AlertDialog `"이 기록을 삭제할까요?"` → Toast `"기록을 삭제했어요"`. 초기 50건 렌더 후 하단 도달 시 50건씩 추가(페이지 스크롤, 중첩 스크롤 컨테이너 금지). 로딩 시 Skeleton ListRow 3개. 기록 0건이면 `Asset.ContentIcon` + `"2026년 3월 기록이 없어요"` + `display="block"` Button `"기록 추가하기"`. `<AdSlot />`을 마지막 행 아래·FloatingTabBar 위에 1개.
- DoD: 2026-03 기록 5건/2026-02 기록 3건 → 표시 월 2026-03에서 `record-row` 5개, date 내림차순 · 첫 행에 `"03월 02일 (월)"`·`"18:00–23:00 · 4시간 30분"`·`"51,600원"` 문자열 모두 존재 · 야간 60분·연장 0분·`isHoliday:false` 행 → Badge `"야간"` 1개만, `"연장"`/`"휴일"` 0개 · 기록 60건일 때 초기 `record-row` 50개, 하단 도달 후 60개, 리스트 조상 요소에 `overflow:auto|scroll` 0건 · 편집 모드 삭제 확인 → 저장소에서 제거 + Toast `"기록을 삭제했어요"` · 기록 0건 → 빈 상태 3요소 렌더 + `record-row` 0개 · 로딩 중 Skeleton ListRow 정확히 3개 · `AdSlot` 1개가 마지막 행 아래, 행과 겹침 0px · ListRow ≥ 56px, 삭제·월 이동 버튼 44×44px
- Covers: [F7-AC-1, F7-AC-2, F7-AC-3, F7-AC-4, F7-AC-5, F7-AC-6, F7-AC-7, F7-AC-8]
- Files: [src/pages/RecordListPage.tsx]
- Depends on: Task 2.7, Task 2.4

### Task 3.9 기록 목록 ② — 손상 폴백 & 잘못된 파라미터 방어
- Description: `/records`의 실패 경로를 구현한다. `const s = (useLocation().state as RouteState['/records']) ?? null;`로 받은 뒤 검증 — (a) `workplaceId`가 저장소에 없으면 `resolveActiveWorkplaceId()` 규칙으로 `createdAt` 오름차순 첫 근무지를 선택·저장, (b) 근무지 0개면 리스트 대신 `Asset.ContentIcon` + `"등록된 근무지가 없어요"` + Button `"근무지 추가하기"`(월별 빈 상태는 미표시), (c) `yearMonth`가 `^\d{4}-(0[1-9]|1[0-2])$` 불일치이거나 미래 월이면 현재 월로 폴백. 저장소 손상 시 `record-list` 컨테이너는 렌더하되 `record-row` 0개 + Toast 1회.
- DoD: `state={workplaceId:'wp-deleted',yearMonth:'2026-03'}` 진입 → 첫 근무지 기준 렌더 + `activeWorkplaceId`가 해당 id로 저장 · 근무지 0개 → `"등록된 근무지가 없어요"` 렌더, `"2026년 3월 기록이 없어요"` 미렌더, `activeWorkplaceId===null` 저장 · `yearMonth:'2026-13'`/`'abc'`/미래 월 → 현재 월로 렌더 · **state 없이 직접 진입(새로고침·링크)해도 크래시하지 않고 `activeWorkplaceId` + 현재 월로 렌더**, 구조분해 캐스팅 0건 · `apg:records:v1="{{broken"` 진입 → `record-list` 렌더 + `record-row` 0개 + 월별 빈 상태 + Toast `"일부 데이터를 불러오지 못했어요"` 1회 + `apg:records:v1:corrupt:{timestamp}` 백업 · `apg:workplaces:v1`/`apg:settings:v1` 손상 시 각각 자기 키 이름의 `:corrupt:` 백업 생성(다른 키 이름 사용 0건) · 복수 키 동시 손상 시 Toast 1회, `console.error` 0건, 화이트 스크린 0건
- Covers: [F7-AC-9, F7-AC-10]
- Files: [src/pages/RecordListPage.tsx]
- Depends on: Task 3.8

### Task 3.10 급여 상세 ① `/breakdown` — 항목 내역 · 세후 · 5인 미만 안내
- Description: `data-testid="breakdown-card"` TDS Card에 TDS ListRow 5개(기본급/야간수당/연장수당/휴일수당/주휴수당)와 합계 행(t2 강조 타이포)을 렌더하고 `MiniBar`로 항목 비중을 표시한다. `data-testid="net-pay-row"`에는 `taxType==='freelance3_3'`일 때 `"세후 예상 {net}원"` + 보조 텍스트 `"사업소득세 3.3% 공제 기준"`. `isFiveOrMore===false`이면 야간·연장·휴일 행에 `0원`과 `"5인 미만 사업장은 가산수당 의무가 없어요"`. `location.state`는 null 체크 후 사용하고 없으면 `activeWorkplaceId` + 현재 월로 폴백.
- DoD: `basePay:206400,nightPay:5160,overtimePay:0,holidayPay:0,weeklyHolidayPay:41280` → ListRow 5개가 각각 `"기본급 206,400원"`·`"야간수당 5,160원"`·`"연장수당 0원"`·`"휴일수당 0원"`·`"주휴수당 41,280원"` 포함 · 합계 행에 `"합계 252,840원"`이 t2 강조 타이포로 렌더 · `taxType:'freelance3_3'`, `gross:252840` → `net-pay-row`에 `"세후 예상 244,496원"` + `"사업소득세 3.3% 공제 기준"` · `isFiveOrMore:false` → 가산 3행 값 `0원` + 안내 문구 1회 노출 · **state 없이 `/breakdown` 직접 진입해도 크래시 없이 활성 근무지 + 현재 월로 렌더** · `breakdown-card`·`net-pay-row` testid 각각 1개 · TDS 인라인 spacing 0건, HEX 0건
- Covers: [F5-AC-1, F5-AC-5, F5-AC-6]
- Files: [src/pages/BreakdownPage.tsx]
- Depends on: Task 2.7, Task 2.5

### Task 3.11 급여 상세 ② — 주차별 주휴 · 최저임금 경고 · 빈/로딩 · 고지 · 광고
- Description: `data-testid="weekly-holiday-card"` TDS Card에 주차별 행을 렌더한다. 미충족 주는 `"{N}시간 더 일하면 주휴수당 받을 수 있어요"`(N = `ceil((900-weeklyMinutes)/60)`) + Badge `"미충족"`, 충족 주는 `"{amount}원"` + Badge `"충족"`. 주차 행 탭(≥56px) → `navigate('/records', { state: { workplaceId, yearMonth } })`. `isBelowMinimumWage`일 때만 `data-testid="minimum-wage-warning"`에 `"2026년 최저임금 10,320원보다 520원 낮아요"`와 `"부족액 41,600원"`을 렌더하고 임금체불 신고는 안내 텍스트만(링크 없음). 개근 요건 한계 보조 텍스트 노출. 빈 상태는 `Asset.ContentIcon` + `"계산할 기록이 없어요"` + Button `"기록 추가하기"`(Card 미렌더), 로딩 시 Skeleton Card 3개. 하단에 `"법정 기준 자동 계산 결과이며 법적 효력이 없습니다"`와 그 **위**에 `<AdSlot />` 1개.
- DoD: 1주차 주 12시간 / 2주차 주 20시간 → 주차 행 2개, 1주차에 `"3시간 더 일하면 주휴수당 받을 수 있어요"` + Badge `"미충족"`, 2주차에 `"41,280원"` + Badge `"충족"` · `{hourlyWage:9800}` + 총 80시간 → `minimum-wage-warning` 존재 + 지정 두 문구 포함 · `{hourlyWage:10320}` → `minimum-wage-warning`이 DOM에 존재하지 않음(queryByTestId === null) · 기록 0건 → `"계산할 기록이 없어요"` + Button 렌더, `breakdown-card`/`weekly-holiday-card` 미렌더 · 로딩 중 Skeleton 정확히 3개 · 하단 고지 문구 1회 렌더, 파일 내 `window.open`·`window.location.href` 0건, `<a href="http` 0건 · `AdSlot`이 마지막 Card 아래·고지 문구 위에 1개
- Covers: [F5-AC-2, F5-AC-3, F5-AC-4, F5-AC-7, F5-AC-8]
- Files: [src/pages/BreakdownPage.tsx, src/components/WeeklyHolidayCard.tsx]
- Depends on: Task 3.10

### Task 3.12 미지급 분석 입력 `/check`
- Description: 근무지 선택 Chip, 대상 월 TextField(`YYYY-MM`), 실지급액 TextField(`inputMode="numeric"`, 천 단위 콤마 자동 포맷 · 제출 시 숫자 파싱), `data-testid="calculated-summary-card"` TDS Card(`"계산 예상액"` 값 포함), `SubmitFooter` Button `"미지급 분석하기"`를 렌더한다. 해당 월 기록 0건이면 인라인 안내 `"해당 월 출퇴근 기록이 없어요"` + 버튼 `disabled`이며 제출 시도 시 동일 문구 Toast 후 이동하지 않는다. 금액 미입력 제출 → 인라인 `"실제 받은 금액을 입력해주세요"` + 이동 없음. 성공 시 `navigate('/check/result', { state: { workplaceId, yearMonth, actualPaidAmount } })`. 로딩 시 Skeleton Card 1개. `location.state`는 null 체크 후 사용하고 `toast` 수신 시 1회 표시.
- DoD: wp-1/2026-03 계산액 252,840원 상태에서 `206400` 입력 후 제출 → `navigate('/check/result',{state:{workplaceId:'wp-1',yearMonth:'2026-03',actualPaidAmount:206400}})` 호출(값 3개 일치) · 입력 중 화면에 `206,400` 콤마 표시되고 전달값은 number `206400` · 금액 비우고 제출 → `"실제 받은 금액을 입력해주세요"` + URL 변경 없음 · 기록 0건인 월 선택 → 버튼 `disabled` + 인라인 안내, 강제 제출 시 Toast `"해당 월 출퇴근 기록이 없어요"` + 이동 없음 · `calculated-summary-card` 1개 존재하고 `"계산 예상액"` 포함 · **state 없이 직접 진입해도 크래시 없이 활성 근무지 + 현재 월 폴백** · Chip ≥ 44px, 제출 버튼 ≥ 48px, 금액 필드 `inputMode="numeric"`
- Covers: [F6-AC-1, F6-AC-7, F6-AC-8]
- Files: [src/pages/CheckInputPage.tsx]
- Depends on: Task 2.7, Task 2.6

### Task 3.13 미지급 분석 결과 `/check/result` — 리워드 게이트 · 저장 · 실패 경로
- Description: `const s = (useLocation().state as RouteState['/check/result']) ?? null;`로 받고 `if (!s)`면 `Asset.ContentIcon` + `"분석할 데이터가 없어요"` + Button(`navigate('/check')`)를 렌더한다. 해제 상태가 아니면 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`로 `compare-card`/`diff-hero`/`suspect-card` 전체를 감싸 잠금(항목명만 블러, 금액 미노출), 시청 완료 시 `grantUnlock()`으로 `rewardUnlocks["wp-1:2026-03"] = now+24h` 저장 후 공개. `isUnlocked`가 true면 게이트 없이 즉시 공개. 결과는 `data-testid="compare-card"`(계산액 vs 실지급액 2행 + `MiniBar`), `data-testid="diff-hero"`(`SummaryHero` CountUp 차액, t2 강조 + Badge `"미지급 의심"`/`"정상 지급"`), `data-testid="suspect-card"` N개(ListRow 항목/금액/설명). `SubmitFooter` Button `"분석 결과 저장"` → `upsertPayCheck` → Toast `"분석 결과를 저장했어요"` → `navigate('/check', { replace: true, state: { toast: '분석 결과를 저장했어요' } })`. 광고 실패 시 `"광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"` + Button `"다시 시도"`(≥44px), 결과는 잠금 유지. 로딩 중 Skeleton Card 2개(`0원` 선노출 금지). 배너 `AdSlot` 미배치. 하단 법적 고지 문구 표시.
- DoD: **state 없이 `/check/result` 직접 진입(새로고침·링크)해도 크래시하지 않고 `"분석할 데이터가 없어요"` + `/check` 이동 버튼 표시**, `.map()` 직접 호출·구조분해 캐스팅 0건 · 해제 없음·만료 상태로 진입 → 결과 Card가 `TossRewardAd` 하위에 잠금 렌더되고 금액 문자열이 DOM에 미노출 · 시청 완료 후 `rewardUnlocks['wp-1:2026-03']`가 `now+24h` ISO8601로 저장 + 결과 공개 · 값이 미래 시각인 상태로 재진입 → 게이트 없이 즉시 결과 렌더 · `calculatedNet:252840`,`actualPaidAmount:206400` → `diff-hero`에 CountUp `46,440원`, `suspect-card` 2개, Badge `"미지급 의심"` · `actualPaidAmount:300000` → Badge `"정상 지급"` + `"계산액보다 47,160원 더 받았어요"` · 해제 상태에서 `compare-card` 1개 + `diff-hero` 1개 + `suspect-card` ≥ 1개, 차액이 t2 강조 타이포 · `"분석 결과 저장"` 1회 → 저장소 +1건(`createdAt===updatedAt`) + Toast, 동일 `(wp-1,2026-03)` 2회째 저장 → 배열 길이 불변, id·createdAt 유지, `updatedAt>createdAt`, 해당 조합 행 수 1건 · 광고 실패 주입 → 지정 문구 + `"다시 시도"` 렌더 + 잠금 유지 · 로딩 중 Skeleton 2개만 렌더되고 `0원` 미노출 · 이 화면에 `<AdSlot` 0건, 결과 보기 버튼 ≥ 48px
- Covers: [F6-AC-2, F6-AC-3, F6-AC-4, F6-AC-5, F6-AC-6, F6-AC-8, F6-AC-9]
- Files: [src/pages/CheckResultPage.tsx, src/components/SuspectCard.tsx]
- Depends on: Task 3.12

### Task 3.14 404 페이지 `*`
- Description: `ScreenScaffold` + `Asset.ContentIcon` + TDS `Top` + `Paragraph.Text` `"페이지를 찾을 수 없어요"` + Button `"홈으로"`(`navigate('/', { replace: true })`)를 `data-testid="not-found"`로 렌더하고, 3.3(미존재 workplaceId)·3.5(미존재 recordId)에서 재사용할 수 있도록 named export 한다.
- DoD: `/unknown-path` 진입 시 `not-found` 1개 렌더, 화이트 스크린 0건 · `"홈으로"` 탭 → `/` 이동하고 뒤로가기로 404 복귀 불가(`replace:true`) · named export로 다른 페이지에서 import 가능 · HEX 0건, TDS 인라인 spacing 0건
- Covers: [F8-AC-8]
- Files: [src/pages/NotFoundPage.tsx]
- Depends on: Task 1.1

---

## Epic 4. 통합 · 정책 준수 · 폴리시

**Risk Assessment**
Complexity: Medium
Risk factors: `FloatingTabBar` 숨김 경로 누락 시 입력 화면에서 탭바가 `SubmitFooter`를 가림 / 온보딩 리다이렉트를 렌더 중 `navigate`로 처리하면 무한 루프 / 법적 고지 AlertDialog가 매 진입마다 떠서 F8-AC-3 실패 / 검수 반려 항목(HEX, 외부 이탈, `console.error`, 최신 전용 API)은 전 파일에 흩어져 개별 패킷에서 잡히지 않음
Mitigation: 모든 페이지 완성 후 라우팅(4.1) → 공통 고지(4.2) → 전역 감사(4.3) 순으로 진행하고, 4.3은 소스·빌드 산출물 grep 결과를 DoD로 명시해 놓친 위반을 일괄 적발한다.

### Task 4.1 라우팅 배선 · 탭바 노출 규칙 · 온보딩 가드
- Description: `src/App.tsx`에 `BrowserRouter`와 12개 라우트(`/`, `/onboarding`, `/records`, `/record/new`, `/record/:id/edit`, `/breakdown`, `/check`, `/check/result`, `/workplace`, `/workplace/new`, `/workplace/:id`, `*`)를 배선하고 `AppDataProvider`로 감싼다. `FloatingTabBar` 4탭(`홈 /`, `기록 /records`, `분석 /check`, `설정 /workplace`)을 렌더하되 `/onboarding`, `/record/*`, `/check/result`, `/workplace/new`, `/workplace/:id`에서는 숨긴다. `loading===false`이고 `settings.onboardingSeenAt===null`이며 현재 경로가 `/onboarding`이 아니면 `useEffect` 내에서 `/onboarding`으로 리다이렉트한다.
- DoD: 12개 라우트 모두 등록되어 각 경로에서 해당 페이지가 렌더되고 `npx tsc --noEmit` 통과 + `npm run build` 성공 · `onboardingSeenAt===null`로 `/` 진입 → `/onboarding` 리다이렉트 1회, 렌더 루프 없음(React 경고 0건) · `onboardingSeenAt` 저장 후 재실행 → `/`에 머무르고 리다이렉트되지 않음 · 지정 5개 경로에서 `FloatingTabBar` DOM 0개, 나머지 경로에서 1개 · 탭 아이템 터치 타깃 ≥ 48×48px · 탭바가 `SubmitFooter`/`AdSlot`과 겹침 0px
- Covers: [F8-AC-1, F8-AC-2]
- Files: [src/App.tsx, src/main.tsx]
- Depends on: Task 3.1, Task 3.2, Task 3.3, Task 3.4, Task 3.5, Task 3.6, Task 3.7, Task 3.8, Task 3.9, Task 3.10, Task 3.11, Task 3.12, Task 3.13, Task 3.14

### Task 4.2 법적 고지 1회 확인 다이얼로그
- Description: `src/components/DisclaimerGate.tsx`를 만들어 `/breakdown`과 `/check/result` 진입 시 `settings.disclaimerAckAt===null`이면 TDS AlertDialog `"본 계산 결과는 근로기준법 기준 참고용이며 법적 효력이 없습니다"`를 1회 표시하고, `"확인"` 탭 시 `markDisclaimerAck()`로 ISO8601을 저장한다. 두 페이지에 래핑을 적용한다.
- DoD: `disclaimerAckAt===null`로 `/breakdown` 최초 진입 → AlertDialog 1회 렌더, 문구 정확히 일치 · `"확인"` 탭 → `apg:settings:v1.disclaimerAckAt`에 ISO8601 저장 + 다이얼로그 닫힘 · 같은 세션에서 `/check/result` 진입 시 미표시 · 앱 재실행 후 두 화면 모두 미표시 · 두 화면 연속 진입 시에도 다이얼로그 총 렌더 1회(스택 0건)
- Covers: [F8-AC-3]
- Files: [src/components/DisclaimerGate.tsx, src/pages/BreakdownPage.tsx, src/pages/CheckResultPage.tsx]
- Depends on: Task 4.1

### Task 4.3 검수 정책 전역 감사 & 최종 폴리시
- Description: 전체 소스와 프로덕션 빌드 산출물을 대상으로 토스 검수 항목을 일괄 점검·수정한다 — 외부 이탈(`window.open`, `window.location.href='http`, 외부 `<a href="http`) 0건화, 설치 유도 문구(`"앱을 설치"`, `"다운로드"`) 제거, HEX 리터럴을 `var(--tds-color-*)`로 치환하고 다크모드 히어로 대비비 ≥ 4.5:1 확인, `console.error` 전량 제거, 외부 분석 SDK·외부 API 호출 0건 확인, 최신 전용 API(`Object.groupBy`/`Array.prototype.at`/`structuredClone`/`Intl.Segmenter`) 0건화, `src/lib/promotion.ts`에 `grantPromotionReward` 래퍼 추가(`amount > 5000`이면 호출 차단 + Toast `"지급 한도를 초과했어요"`, MVP에서는 실제 호출 0건), 광고·슬롯 ID는 `import.meta.env.VITE_TOSS_AD_GROUP_ID`/`VITE_TOSS_AD_SLOT_ID`로만 참조.
- DoD: `grep -rE "window\.open|window\.location\.href\s*=\s*['\"]http" src/` 0건 · `grep -rE "앱을 설치|다운로드" src/` 0건 · `npm run build` 후 `dist/**/*.{js,css}`의 `#[0-9a-fA-F]{3,8}` 중 앱 소스 유래 HEX 0건 · `grep -rn "console.error" src/` 0건 · `grep -rE "Object\.groupBy|\.at\(|structuredClone|Intl\.Segmenter" src/` 0건 · 광고 ID 하드코딩 문자열 0건 · 프로덕션 빌드로 `/`, `/records`, `/record/new`, `/breakdown`, `/check`, `/check/result`, `/workplace` 7개 화면 순회 시 콘솔 에러 0건, 외부 네트워크 요청 0건, CORS 에러 0건 · `promotion.ts`에 `amount:6000` 전달 시 SDK 호출 미실행 + Toast 표시, 앱 전체 `grantPromotionReward` 실제 호출 0건 · 모든 인터랙티브 요소 터치 타깃 ≥ 44×44px(탭바 ≥ 48×48px)
- Covers: [F8-AC-4, F8-AC-5, F8-AC-6, F8-AC-7]
- Files: [src/lib/promotion.ts, src/index.css, src/App.tsx]
- Depends on: Task 4.2

---

## AC Coverage

- Total ACs in SPEC: 71 (F1: 9, F2: 9, F3: 8, F4: 10, F5: 8, F6: 9, F7: 10, F8: 8)
- Covered by tasks: 71
  - F1-AC-1 → 3.3 / F1-AC-2 → 3.3 / F1-AC-3 → 2.3 + 2.7 + 3.3 / F1-AC-4 → 3.3 / F1-AC-5 → 2.3 + 3.2 / F1-AC-6 → 2.1 / F1-AC-7 → 3.2 / F1-AC-8 → 1.1 + 2.2 / F1-AC-9 → 2.3 + 3.3
  - F2-AC-1 → 3.4 / F2-AC-2 → 2.4 + 3.4 / F2-AC-3 → 3.4 / F2-AC-4 → 3.5 / F2-AC-5 → 3.4 / F2-AC-6 → 2.2 + 3.4 / F2-AC-7 → 3.4 / F2-AC-8 → 3.4 / F2-AC-9 → 2.2 + 3.5
  - F3-AC-1 → 2.4 / F3-AC-2 → 2.5 / F3-AC-3 → 2.5 / F3-AC-4 → 2.4 / F3-AC-5 → 2.4 / F3-AC-6 → 2.5 / F3-AC-7 → 2.4 / F3-AC-8 → 1.1 + 2.5
  - F4-AC-1 → 3.6 / F4-AC-2 → 3.7 / F4-AC-3 → 3.6 / F4-AC-4 → 3.6 / F4-AC-5 → 3.7 / F4-AC-6 → 2.7 + 3.7 / F4-AC-7 → 3.7 / F4-AC-8 → 3.6 / F4-AC-9 → 2.7 + 3.7 / F4-AC-10 → 2.3 + 3.7
  - F5-AC-1 → 3.10 / F5-AC-2 → 3.11 / F5-AC-3 → 3.11 / F5-AC-4 → 3.11 / F5-AC-5 → 2.5 + 3.10 / F5-AC-6 → 3.10 / F5-AC-7 → 3.11 / F5-AC-8 → 3.11
  - F6-AC-1 → 3.12 / F6-AC-2 → 2.6 + 3.13 / F6-AC-3 → 2.6 + 3.13 / F6-AC-4 → 2.6 + 3.13 / F6-AC-5 → 3.13 / F6-AC-6 → 2.2 + 3.13 / F6-AC-7 → 2.6 + 3.12 + 3.13 / F6-AC-8 → 3.12 + 3.13 / F6-AC-9 → 3.13
  - F7-AC-1 → 3.8 / F7-AC-2 → 3.8 / F7-AC-3 → 3.8 / F7-AC-4 → 3.8 / F7-AC-5 → 3.8 / F7-AC-6 → 3.8 / F7-AC-7 → 3.8 / F7-AC-8 → 3.8 / F7-AC-9 → 2.7 + 3.9 / F7-AC-10 → 2.3 + 3.9
  - F8-AC-1 → 3.1 + 4.1 / F8-AC-2 → 3.1 + 4.1 / F8-AC-3 → 4.2 / F8-AC-4 → 4.3 / F8-AC-5 → 4.3 / F8-AC-6 → 1.1 + 4.3 / F8-AC-7 → 4.3 / F8-AC-8 → 3.14 + 3.5 + 3.3
- Uncovered: 0

### Screen Layout AC 커버 (9건)
S0 → 3.1 / S1 → 3.6 + 3.7 / S2 → 3.4 / S3 → 3.8 + 3.9 / S4 → 3.10 + 3.11 / S5 → 3.12 / S6 → 3.13 / S7 → 3.2 + 3.3 / S8 → 3.14 — 전부 커버.

### RouteState 계약 준수 체크 (state 수신 화면 7개)
- `/` → state 없으면 toast만 생략하고 정상 렌더 (Task 3.6 DoD)
- `/record/new` → 오늘 날짜 + `activeWorkplaceId` 폴백 (Task 3.4 DoD)
- `/record/:id/edit` → URL param 폴백, 미존재 시 404 (Task 3.5 DoD)
- `/records` → `activeWorkplaceId` + 현재 월 폴백 (Task 3.9 DoD)
- `/breakdown` → `activeWorkplaceId` + 현재 월 폴백 (Task 3.10 DoD)
- `/check` → `activeWorkplaceId` + 현재 월 폴백 (Task 3.12 DoD)
- `/check/result` → `"분석할 데이터가 없어요"` 빈 상태 + `/check` 이동 버튼 (Task 3.13 DoD)

공통 필수 패턴: `const s = (useLocation().state as RouteState['<path>']) ?? null;` 후 null 분기.
금지: `const { x } = useLocation().state as T;` / `(useLocation().state as T).items.map(...)`