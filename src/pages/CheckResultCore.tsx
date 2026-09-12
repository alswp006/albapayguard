import { Paragraph, Spacing, ListRow, Button, Badge } from '@toss/tds-mobile';
import { Card } from '@/components/Card';
import { Amount } from '@/components/Amount';
import { MiniBar } from '@/components/MiniBar';
import { SummaryHero } from '@/components/SummaryHero';
import { DisclaimerGate } from '@/components/DisclaimerGate';
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
  const compareRatio = payroll.net > 0 ? actualPaidAmount / payroll.net : 0;

  return (
    <>
      <DisclaimerGate />
      <Card testId="compare-card">
        <ListRow
          contents={<ListRow.Texts type="1RowTypeA" top="계산 예상액" />}
          right={<Amount value={payroll.net} unit="원" />}
        />
        <ListRow
          contents={<ListRow.Texts type="1RowTypeA" top="실지급액" />}
          right={<Amount value={actualPaidAmount} unit="원" />}
        />
        <Spacing size={8} />
        <MiniBar ratio={compareRatio} testId="compare-ratio-bar" />
      </Card>

      <Spacing size={16} />

      <SummaryHero
        testId="diff-hero"
        label={analysis.isUnderpaid ? '덜 받았을 수 있어요' : '정상 지급으로 보여요'}
        value={<Amount value={Math.abs(analysis.diff)} unit="원" typography="t2" />}
        caption={`계산 ${formatNumber(payroll.net)}원 · 실지급 ${formatNumber(actualPaidAmount)}원`}
      />
      <Spacing size={8} />
      <Badge size="small" variant="weak" color={analysis.isUnderpaid ? 'red' : 'blue'}>
        {analysis.isUnderpaid ? '미지급 의심' : '정상 지급'}
      </Badge>

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
