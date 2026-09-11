import { Paragraph } from '@toss/tds-mobile';

/** 결과 화면마다 같은 문구를 써야 해서 상수로 고정 — 문구가 갈리면 고지 효력이 흐려진다 */
export const LEGAL_NOTICE_TEXT = '법정 기준 자동 계산 결과이며 법적 효력이 없습니다';

export interface LegalNoticeProps {
  testId?: string;
}

/**
 * 계산 결과 화면 하단 고지.
 *
 * 급여 상세·미지급 분석처럼 금액을 단정적으로 보여주는 화면에 항상 붙인다.
 */
export function LegalNotice({ testId }: LegalNoticeProps) {
  return (
    <div data-testid={testId}>
      <Paragraph.Text typography="st11" color="var(--adaptiveGrey600)">
        {LEGAL_NOTICE_TEXT}
      </Paragraph.Text>
    </div>
  );
}

export default LegalNotice;
