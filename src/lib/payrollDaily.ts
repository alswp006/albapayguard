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

/**
 * HH:mm 형식의 문자열을 파싱
 * @param s 시각 문자열 (형식: "HH:mm")
 * @returns { hours, minutes } 또는 null (파싱 실패)
 */
export function parseHHmm(s: string): TimeComponents | null {
  // TODO: Implement
  return null;
}

/**
 * 근로 시간 계산 (분 단위)
 * endTime <= startTime이면 자정을 넘긴 것으로 간주 (+24h)
 * @param start 시작 시각
 * @param end 종료 시각
 * @param breakMinutes 휴게 시간 (분)
 * @returns 실근로 시간 (분)
 */
export function calcWorkedMinutes(
  start: TimeComponents,
  end: TimeComponents,
  breakMinutes: number
): number {
  // TODO: Implement
  return 0;
}

/**
 * 야간 근무 시간 계산 (22:00 ~ 06:00 교집합)
 * 자정을 넘길 수 있음
 * @param start 시작 시각
 * @param end 종료 시각
 * @returns 야간 근무 시간 (분)
 */
export function calcNightMinutes(
  start: TimeComponents,
  end: TimeComponents
): number {
  // TODO: Implement
  return 0;
}

/**
 * 일급 계산 (통합)
 * @param record 근무 기록
 * @param workplace 직장 정보
 * @returns DailyPay 또는 null (비정상 입력)
 */
export function calcDaily(
  record: WorkRecord,
  workplace: Workplace
): DailyPay | null {
  // TODO: Implement
  return null;
}
