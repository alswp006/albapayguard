export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

export function formatCurrency(n: number, currency = 'KRW'): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(n);
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 실행 환경(기기) 타임존과 무관하게 KST(UTC+9) 벽시계 시각을 나타내는 Date를 반환한다.
 * getUTC* 접근자로 읽으면 KST 기준 연/월/일/시가 나온다. 이 앱의 사용자는 전부 한국이므로
 * "오늘"/"이번 달"은 기기 타임존이 아니라 KST로 고정해야 새벽 시간대 날짜 밀림이 없다.
 */
export function nowKst(): Date {
  return new Date(Date.now() + KST_OFFSET_MS);
}

/** KST 기준 오늘 날짜 "YYYY-MM-DD" */
export function todayKst(): string {
  return nowKst().toISOString().slice(0, 10);
}

/** KST 기준 이번 달 "YYYY-MM" */
export function currentYearMonthKst(): string {
  return nowKst().toISOString().slice(0, 7);
}
