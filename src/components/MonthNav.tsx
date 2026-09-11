import type { CSSProperties } from 'react';
import { Button, Paragraph } from '@toss/tds-mobile';

/** 화살표 버튼은 글자폭이 좁아 그대로 두면 탭 영역이 글자만해진다 — 44×44 터치 타깃을 강제 */
const arrowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 44,
  minHeight: 44,
};

export interface MonthNavProps {
  /** 가운데에 표시할 월 라벨 — 예: "2026년 1월" */
  label: string;
  onPrev: () => void;
  onNext: () => void;
  /** 미래 달로는 못 가게 막을 때 — 다음 버튼이 disabled된다 */
  nextDisabled?: boolean;
  prevDisabled?: boolean;
  testId?: string;
}

/**
 * 월 이동 내비게이션 — `‹ 2026년 1월 ›`.
 *
 * 홈·급여 상세처럼 월 단위로 데이터를 보는 화면에서 공통으로 쓴다.
 * 색상은 TDS Button(variant="weak")이 테마에 맞춰 처리하므로 HEX를 직접 쓰지 않는다.
 */
export function MonthNav({
  label,
  onPrev,
  onNext,
  nextDisabled = false,
  prevDisabled = false,
  testId,
}: MonthNavProps) {
  return (
    <div
      data-testid={testId}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Button
        variant="weak"
        size="small"
        aria-label="이전 달"
        disabled={prevDisabled}
        onClick={onPrev}
        style={arrowStyle}
      >
        ‹
      </Button>

      <Paragraph.Text typography="t5">{label}</Paragraph.Text>

      <Button
        variant="weak"
        size="small"
        aria-label="다음 달"
        disabled={nextDisabled}
        onClick={onNext}
        style={arrowStyle}
      >
        ›
      </Button>
    </div>
  );
}

export default MonthNav;
