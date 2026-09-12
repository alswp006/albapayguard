import { COLOR_TOKENS } from '@/lib/types';

/**
 * 근무지 색상 토큰 → 표시용 라벨 / TDS adaptive CSS 변수.
 * HEX 하드코딩 금지 규칙 때문에 색은 항상 var(--adaptive*)로만 표현한다.
 * 목록(색 점)과 폼(색 선택 버튼)이 같은 값을 써야 하므로 여기 한 곳에 둔다.
 */
export const WORKPLACE_COLOR_LABELS: Record<string, string> = {
  blue: '블루',
  green: '그린',
  purple: '퍼플',
  orange: '오렌지',
};

export const WORKPLACE_COLOR_VARS: Record<string, string> = {
  blue: 'var(--adaptiveBlue500)',
  green: 'var(--adaptiveGreen500)',
  purple: 'var(--adaptivePurple500)',
  orange: 'var(--adaptiveOrange500)',
};

export function colorVar(token: string): string {
  return WORKPLACE_COLOR_VARS[token] ?? WORKPLACE_COLOR_VARS[COLOR_TOKENS[0]];
}

export function colorLabel(token: string): string {
  return WORKPLACE_COLOR_LABELS[token] ?? token;
}
