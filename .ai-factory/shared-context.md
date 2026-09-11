# Shared Context (auto-generated — do NOT modify)


## 패킷 간 계약 (src/lib/contract.ts — 자동 생성, 수정 금지)
여기 선언된 이름·인자·반환 타입은 확정이다. 기반 패킷은 이대로 구현하고,
화면 패킷은 이대로 호출하라. 다르게 만들지 마라.

```typescript
/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

/** 라우팅 상태, 0017과 0008 컨텍스트 조율 (구현: 패킷 0001) */
export type RouteState = { section: 'home' | 'record' | 'breakdown' | 'check' | 'checkResult' | 'records' | 'workplace'; recordId?: string; month?: string };

/** 근무 기록 엔티티, 전방위 공유 (구현: 패킷 0001) */
export type Record = { id: string; workplaceId: string; date: string; hoursWorked: number; hourlyRate: number; memo?: string };

/** 근무지 엔티티 (구현: 패킷 0001) */
export type Workplace = { id: string; name: string; baseHourlyRate: number; isActive: boolean; createdAt: string };

/** 일별 급여 계산 결과 (구현: 패킷 0001) */
export type PayrollEntry = { date: string; hoursWorked: number; rate: number; dailyWages: number; adjustments?: { sundayPay?: number; weeklyRest?: number; minWageGap?: number } };

/** 모든 페이지(0009-0016)의 상태·CRUD 인터페이스 (구현: 패킷 0008) */
export type useAppDataFn = () => { records: Record[]; workplaces: Workplace[]; addRecord: (r: Record) => Promise<void>; updateRecord: (id: string, r: Partial<Record>) => Promise<void>; deleteRecord: (id: string) => Promise<void>; addWorkplace: (w: Workplace) => Promise<void>; updateWorkplace: (id: string, w: Partial<Workplace>) => Promise<void>; deleteWorkplace: (id: string) => Promise<void>; getMonthRecords: (month: string) => Record[] };

/** 일별 급여 계산, 0006/0007/0011에서 사용 (구현: 패킷 0005) */
export type calculateDailyPayrollFn = (record: Record, opts?: { weeklyRestDay?: boolean; isSunday?: boolean }) => PayrollEntry;

/** 월 통계 산출 (구현: 패킷 0006) */
export type calculateMonthlyPayrollFn = (entries: PayrollEntry[]) => { totalWages: number; minWageAdjustment: number; grossPay: number };

/** 미지급 분석, 0012-0013 진입로 (구현: 패킷 0007) */
export type analyzeUnpaidFn = (records: Record[], targetAmount: number) => { unpaidDays: string[]; amountShortfall: number; estimatedReward: number };

/** 금액 포맷팅, 모든 페이지에서 사용 (구현: 패킷 0007) */
export type formatCurrencyFn = (amount: number, currency?: string) => string;

/** 햅틱 피드백, 0010/0012-0015 상호작용 피드백 (구현: 패킷 0018) */
export type useHapticFn = () => { pulse: (pattern?: 'light' | 'medium' | 'heavy') => void };

```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
// Domain types — add your app-specific types here
export {};

```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
  lib/
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Breakdown.tsx
    Check.tsx
    CheckResult.tsx
    Home.tsx
    NotFound.tsx
    Onboarding.tsx
    Records.tsx
    Workplace.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Available exports from existing files
// src/App.tsx
export default function App() {

// src/components/AdSlot.tsx
export function AdSlot({ adGroupId, className, variant, theme }: AdSlotProps) {

// src/components/Amount.tsx
export function Amount({

// src/components/BottomCTA.tsx
export function SubmitFooter({
export function ButtonStack({

// src/components/Card.tsx
export function Card({

// src/components/CountUp.tsx
export function CountUp({

// src/components/FloatingTabBar.tsx
export type TabItem = {
export function FloatingTabBar({ items }: { items: TabItem[] }) {

// src/components/MiniBar.tsx
export function MiniBar({

// src/components/PageShell.tsx
export function PageShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {

// src/components/ScreenScaffold.tsx
export function ScreenScaffold({

// src/components/Sparkline.tsx
export function Sparkline({

// src/components/StateView.tsx
export function EmptyState({
export function LoadingState({

// src/components/SummaryHero.tsx
export function SummaryHero({

// src/components/TossPurchase.tsx
export interface TossPurchaseResult {
export function TossPurchase({

// src/components/TossRewardAd.tsx
export function TossRewardAd({

// src/lib/contract.ts
export type RouteState = { section: 'home' | 'record' | 'breakdown' | 'check' | 'checkResult' | 'records' | 'workplace'; recordId?: string; month?: string };
export type Record = { id: string; workplaceId: string; date: string; hoursWorked: number; hourlyRate: number; memo?: string };
export type Workplace = { id: string; name: string; baseHourlyRate: number; isActive: boolean; createdAt: string };
export type PayrollEntry = { date: string; hoursWorked: number; rate: number; dailyWages: number; adjustments?: { sundayPay?: number; weeklyRest?: number; minWageGap?: number } };
export type useAppDataFn = () => { records: Record[]; workplaces: Workplace[]; addRecord: (r: Record) => Promise<void>; updateRecord: (id: string, r: Partial<Record>) => Promise<void>; deleteRecord: (id:

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(4), general(12), testing(1), ui(1)

Key lessons (verify against actual code before applying):
- [deploy] 매 에이전트 실행마다 재생성되는 도구용 파일은 반드시 .gitignore에 넣고, 진입점(라우터·앱 셸) 배선 패킷을 가장 먼저 병합한 뒤 미구현 화면은 플레이스홀더 모듈로 import를 성립시켜 각 패킷이 단독으로 타입체크·빌드를 통과하게 하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 화면·라우팅 등 소비자 모듈은 그것이 import하는 생산자 모듈이 병합된 뒤에만 병합하고, 순서를 지킬 수 없으면 소비자 병합과 동시에 최소 플레이스홀더를 만들어 매 병합 직후 타입체크와 빌드가 항상 통과하도록 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 전역 라우팅·탭바·Provider 배선은 개별 화면보다 먼저(초반 20% 안에) 완료하고 미구현 화면은 스텁 라우트로 연결해, 시간 예산이 소진돼도 앱이 항상 실행 가능한 상태를 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)