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
