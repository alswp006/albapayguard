/**
 * 급여 계산 엔진 ① 일별 계산 (순수 함수)
 *
 * 비정상 입력 처리:
 * - startTime/endTime 파싱 실패 → null
 * - breakMinutes 범위 밖 (< 0 또는 >= workedMinutes) → null
 * - 실근로 ≤ 0 → null
 * - wage <= 0 → null
 *
 * 금지 사항:
 * - Object.groupBy, Array.prototype.at, structuredClone, Intl.Segmenter 사용 금지
 * - UI 라이브러리 import 금지 (react, react-router-dom, @toss/tds-mobile 등)
 */

export interface TimeComponents {
  hours: number;
  minutes: number;
}

export interface DailyPay {
  workedMinutes: number;
  basePay: number;
  nightMinutes: number;
  nightPay: number;
  overtimeMinutes?: number;
  overtimePay?: number;
  holidayPay?: number;
  total: number;
}

export interface WorkRecord {
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  breakMinutes: number;
}

export interface Workplace {
  wage: number;         // 시급 (원)
  isFiveOrMore: boolean; // 5인 이상 여부
}

import type { Record, PayrollEntry } from "@/lib/contract";

/** 기록 날짜 연도 기준 최저임금 (spec.md 계산 규칙 표) */
const MINIMUM_WAGE_BY_YEAR: globalThis.Record<number, number> = { 2025: 10030, 2026: 10320 };

function minimumWageForDate(date: string): number {
  const year = Number(date.slice(0, 4));
  return MINIMUM_WAGE_BY_YEAR[year] ?? MINIMUM_WAGE_BY_YEAR[2026];
}

/**
 * HH:mm 형식의 문자열을 파싱
 * @param s 시각 문자열 (형식: "HH:mm")
 * @returns { hours, minutes } 또는 null (파싱 실패)
 */
const HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHHmm(s: string): TimeComponents | null {
  const match = HHMM_PATTERN.exec(s);
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

/**
 * 근로 시간 계산 (분 단위)
 * endTime <= startTime이면 자정을 넘긴 것으로 간주 (+24h)
 * @param start 시작 시각
 * @param end 종료 시각
 * @param breakMinutes 휴게 시간 (분)
 * @returns 실근로 시간 (분)
 */
function toSpanMinutes(start: TimeComponents, end: TimeComponents): number {
  const startTotal = start.hours * 60 + start.minutes;
  let endTotal = end.hours * 60 + end.minutes;
  if (endTotal <= startTotal) endTotal += 24 * 60;
  return endTotal - startTotal;
}

export function calcWorkedMinutes(
  start: TimeComponents,
  end: TimeComponents,
  breakMinutes: number
): number {
  return toSpanMinutes(start, end) - breakMinutes;
}

/**
 * 야간 근무 시간 계산 (22:00 ~ 06:00 교집합)
 * 자정을 넘길 수 있음
 * @param start 시작 시각
 * @param end 종료 시각
 * @returns 야간 근무 시간 (분)
 */
function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export function calcNightMinutes(
  start: TimeComponents,
  end: TimeComponents
): number {
  const startTotal = start.hours * 60 + start.minutes;
  let endTotal = end.hours * 60 + end.minutes;
  if (endTotal <= startTotal) endTotal += 24 * 60;

  // 야간(22:00~06:00) 창을 기준일 저녁 창과 전날 밤에서 넘어온 새벽 창 두 개로 표현
  const eveningNight = overlapMinutes(startTotal, endTotal, 22 * 60, 30 * 60);
  const earlyMorningNight = overlapMinutes(startTotal, endTotal, -2 * 60, 6 * 60);
  return eveningNight + earlyMorningNight;
}

/**
 * 일급 계산 (통합)
 * @param record 근무 기록
 * @param workplace 직장 정보
 * @returns DailyPay 또는 null (비정상 입력)
 */
const REGULAR_MINUTES_CAP = 8 * 60;
const NIGHT_PREMIUM = 0.5;
const OVERTIME_PREMIUM = 1.5;

export function calcDaily(
  record: WorkRecord,
  workplace: Workplace
): DailyPay | null {
  const start = parseHHmm(record.startTime);
  const end = parseHHmm(record.endTime);
  if (!start || !end) return null;
  if (!Number.isFinite(record.breakMinutes) || record.breakMinutes < 0) return null;
  if (!Number.isFinite(workplace.wage) || workplace.wage <= 0) return null;

  const workedMinutes = calcWorkedMinutes(start, end, record.breakMinutes);
  if (workedMinutes <= 0) return null;

  const nightMinutesRaw = calcNightMinutes(start, end);
  const wage = workplace.wage;

  if (!workplace.isFiveOrMore) {
    const basePay = Math.floor((workedMinutes * wage) / 60);
    return {
      workedMinutes,
      basePay,
      nightMinutes: nightMinutesRaw,
      nightPay: 0,
      overtimeMinutes: 0,
      overtimePay: 0,
      holidayPay: 0,
      total: basePay,
    };
  }

  const regularMinutes = Math.min(workedMinutes, REGULAR_MINUTES_CAP);
  const overtimeMinutes = Math.max(workedMinutes - REGULAR_MINUTES_CAP, 0);

  const basePay = Math.floor((regularMinutes * wage) / 60);
  const overtimePay = Math.floor((overtimeMinutes * wage * OVERTIME_PREMIUM) / 60);
  const nightPay = Math.floor((nightMinutesRaw * wage * NIGHT_PREMIUM) / 60);
  const holidayPay = 0;

  return {
    workedMinutes,
    basePay,
    nightMinutes: nightMinutesRaw,
    nightPay,
    overtimeMinutes,
    overtimePay,
    holidayPay,
    total: basePay + nightPay + overtimePay + holidayPay,
  };
}

/**
 * 일별 급여 계산 — 패킷 간 계약(contract.ts) 진입점.
 * 0006(월 통계)·0007(미지급 분석)·0011(화면) 이 이 시그니처로 호출한다.
 *
 * record.hoursWorked/hourlyRate 기준의 기본급에, opts로 전달된 그 날의 성격
 * (일요일/휴일 근무, 주휴수당 지급 대상일)에 따라 spec.md 계산 규칙표의
 * 가산을 adjustments로 얹는다. dailyWages는 기본급만 담고, 가산은
 * adjustments에 분리해 상위 집계 함수가 항목별로 재구성할 수 있게 한다.
 */
const HOLIDAY_REGULAR_CAP_HOURS = 8;
const HOLIDAY_PREMIUM_WITHIN_CAP = 0.5;
const HOLIDAY_PREMIUM_OVER_CAP = 1.0;
const WEEKLY_REST_CAP_HOURS = 40;
const WEEKLY_REST_DIVISOR = 5;

export function calculateDailyPayroll(
  record: Record,
  opts?: { weeklyRestDay?: boolean; isSunday?: boolean }
): PayrollEntry {
  const hours = Number.isFinite(record.hoursWorked) && record.hoursWorked > 0 ? record.hoursWorked : 0;
  const rate = Number.isFinite(record.hourlyRate) && record.hourlyRate > 0 ? record.hourlyRate : 0;
  const dailyWages = Math.floor(hours * rate);

  const adjustments: NonNullable<PayrollEntry["adjustments"]> = {};

  if (opts?.isSunday && hours > 0 && rate > 0) {
    const withinCap = Math.min(hours, HOLIDAY_REGULAR_CAP_HOURS);
    const overCap = Math.max(hours - HOLIDAY_REGULAR_CAP_HOURS, 0);
    adjustments.sundayPay =
      Math.floor(withinCap * rate * HOLIDAY_PREMIUM_WITHIN_CAP) +
      Math.floor(overCap * rate * HOLIDAY_PREMIUM_OVER_CAP);
  }

  if (opts?.weeklyRestDay && hours > 0 && rate > 0) {
    adjustments.weeklyRest = Math.floor(
      (Math.min(hours, WEEKLY_REST_CAP_HOURS) / WEEKLY_REST_DIVISOR) * rate
    );
  }

  if (rate > 0) {
    const minimumWage = minimumWageForDate(record.date);
    if (rate < minimumWage) {
      adjustments.minWageGap = Math.floor((minimumWage - rate) * hours);
    }
  }

  return {
    date: record.date,
    hoursWorked: hours,
    rate,
    dailyWages,
    adjustments: Object.keys(adjustments).length > 0 ? adjustments : undefined,
  };
}
