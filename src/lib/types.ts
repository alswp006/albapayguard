// 도메인 타입 & 상수 — 순수 타입 정의 전용 (런타임 로직은 상수 선언 외 금지)

// ---------------------------------------------------------------------------
// Workplace — 근무지
// ---------------------------------------------------------------------------

export type TaxType = 'none' | 'freelance3_3';

export interface Workplace {
  id: string;
  name: string;
  hourlyWage: number;
  isFiveOrMore: boolean;
  payday: number;
  taxType: TaxType;
  colorToken: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// WorkRecord — 출퇴근 기록
// ---------------------------------------------------------------------------

export interface WorkRecord {
  id: string;
  workplaceId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  isHoliday: boolean;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// PayCheck — 실지급액 비교 기록
// ---------------------------------------------------------------------------

export type SuspectKind = 'weeklyHoliday' | 'night' | 'overtime' | 'holiday' | 'minimumWage';

export interface PaySuspect {
  kind: SuspectKind;
  label: string;
  amount: number;
  description: string;
}

export interface PayCheck {
  id: string;
  workplaceId: string;
  yearMonth: string;
  actualPaidAmount: number;
  calculatedGross: number;
  calculatedNet: number;
  diff: number;
  suspects: PaySuspect[];
  createdAt: string;
  updatedAt: string;
}

// PayAnalysis — PayCheck 저장 전 메모리상 분석 결과(F6, id/createdAt/updatedAt 없음)
export interface PayAnalysis {
  workplaceId: string;
  yearMonth: string;
  actualPaidAmount: number;
  calculatedGross: number;
  calculatedNet: number;
  diff: number;
  suspects: PaySuspect[];
}

// ---------------------------------------------------------------------------
// AppSettings — 싱글턴 앱 설정/상태 (id/createdAt/updatedAt 규약 면제)
// ---------------------------------------------------------------------------

export interface AppSettings {
  onboardingSeenAt: string | null;
  disclaimerAckAt: string | null;
  activeWorkplaceId: string | null;
  rewardUnlocks: Record<string, string>;
  schemaVersion: number;
}

// ---------------------------------------------------------------------------
// 급여 계산 결과 (F3, 메모리 전용 — 저장 안 함)
// ---------------------------------------------------------------------------

export interface DailyPay {
  date: string;
  workedMinutes: number;
  nightMinutes: number;
  overtimeMinutes: number;
  basePay: number;
  nightPay: number;
  overtimePay: number;
  holidayPay: number;
  total: number;
}

export interface WeeklyHoliday {
  weekStart: string;
  weeklyMinutes: number;
  eligible: boolean;
  amount: number;
}

export interface MonthlyPayroll {
  yearMonth: string;
  daily: DailyPay[];
  weeks: WeeklyHoliday[];
  basePay: number;
  nightPay: number;
  overtimePay: number;
  holidayPay: number;
  weeklyHolidayPay: number;
  gross: number;
  net: number;
  totalMinutes: number;
  minimumWage: number;
  isBelowMinimumWage: boolean;
  minimumWageShortfall: number;
}

// ---------------------------------------------------------------------------
// RouteState — 페이지 간 navigate state 계약 (모든 키 | undefined 포함)
// ---------------------------------------------------------------------------

export interface RouteState {
  '/': { toast: string } | undefined;
  '/onboarding': undefined;
  '/record/new': { workplaceId: string; date: string } | undefined;
  '/record/edit': { recordId: string } | undefined;
  '/records': { workplaceId: string; yearMonth?: string } | undefined;
  '/breakdown': { workplaceId: string; yearMonth?: string } | undefined;
  '/check': { workplaceId: string; yearMonth?: string } | undefined;
  '/check/result': { workplaceId: string; yearMonth: string; actualPaidAmount: number } | undefined;
  '/workplace': { workplaceId?: string; toast?: string } | undefined;
  '/workplace/new': { from: 'onboarding' } | undefined;
  '/workplace/detail': { workplaceId: string } | undefined;
}

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 1;

export const MAX_WORKPLACES = 5;

export const MAX_SERIALIZED_LENGTH = 4500000;

export const MINIMUM_WAGE_BY_YEAR: Record<number, number> = {
  2025: 10030,
  2026: 10320,
};

export const COLOR_TOKENS: readonly string[] = ['blue', 'green', 'purple', 'orange'];

export const STORAGE_KEYS = {
  WORKPLACES: 'apg:workplaces:v1',
  RECORDS: 'apg:records:v1',
  PAYCHECKS: 'apg:paychecks:v1',
  SETTINGS: 'apg:settings:v1',
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  onboardingSeenAt: null,
  disclaimerAckAt: null,
  activeWorkplaceId: null,
  rewardUnlocks: {},
  schemaVersion: 1,
};
