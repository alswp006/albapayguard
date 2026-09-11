import { Paragraph, Spacing, ListRow, Button } from '@toss/tds-mobile';
import { Card } from '@/components/Card';
import { Amount } from '@/components/Amount';
import { SummaryHero } from '@/components/SummaryHero';
import { LegalNotice } from '@/components/LegalNotice';
import { formatNumber } from '@/lib/utils';
import type { PayAnalysisResult } from '@/lib/analysis';
import type { MonthlyPayroll } from '@/lib/types';

export interface CheckResultCoreProps {
  actualPaidAmount: number;
  payroll: MonthlyPayroll;
  analysis: PayAnalysisResult;
  onViewRecords: () => void;
}

/**
 * 미지급 분석 결과 — 순수 표시 컴포넌트.
 * 광고 게이트(TossRewardAd)와 PayCheck 저장은 이 컴포넌트를 감싸는 상위(CheckResultAd)의 몫이다.
 */
export function CheckResultCore({ actualPaidAmount, payroll, analysis, onViewRecords }: CheckResultCoreProps) {
  return (
    <>
      <SummaryHero
        testId="diff-hero"
        label={analysis.isUnderpaid ? '덜 받았을 수 있어요' : '정상 지급으로 보여요'}
        value={<Amount value={Math.abs(analysis.diff)} unit="원" typography="t1" />}
        caption={`계산 ${formatNumber(payroll.net)}원 · 실지급 ${formatNumber(actualPaidAmount)}원`}
      />

      <Spacing size={16} />

      {analysis.isUnderpaid ? (
        analysis.suspects.map((suspect) => (
          <div key={suspect.kind}>
            <Card testId="suspect-card">
              <ListRow
                contents={<ListRow.Texts type="2RowTypeA" top={suspect.label} bottom={suspect.description} />}
                right={<Amount value={suspect.amount} unit="원" />}
              />
            </Card>
            <Spacing size={8} />
          </div>
        ))
      ) : (
        <Card testId="check-result-normal-card">
          <Paragraph.Text typography="st6">실지급액이 계산 결과와 같거나 많아요</Paragraph.Text>
        </Card>
      )}

      <Spacing size={16} />

      <LegalNotice testId="check-result-disclaimer" />
      <Spacing size={8} />
      <Paragraph.Text typography="st11">
        임금체불이 의심되면 사업장 관할 고용노동부 고객센터(국번없이 1350)에서 상담받을 수 있어요
      </Paragraph.Text>

      <Spacing size={16} />

      <Button variant="weak" display="block" onClick={onViewRecords}>
        기록 보기
      </Button>
    </>
  );
}

export default CheckResultCore;
