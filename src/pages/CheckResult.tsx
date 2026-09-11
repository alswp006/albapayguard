import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import { Top, Paragraph, Spacing, ListRow, Button } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Card } from '@/components/Card';
import { LegalNotice } from '@/components/LegalNotice';
import { Amount } from '@/components/Amount';
import { SummaryHero } from '@/components/SummaryHero';
import { TossRewardAd } from '@/components/TossRewardAd';
import { AdSlot } from '@/components/AdSlot';
import { LoadingState } from '@/components/StateView';
import { useAppData, useMonthlyPayroll } from '@/hooks/useAppData';
import { analyzePay, isUnlocked, type PayAnalysisResult } from '@/lib/analysis';
import { formatNumber } from '@/lib/utils';
import type { MonthlyPayroll, RouteState } from '@/lib/types';

const UNLOCK_DURATION_MS = 24 * 60 * 60 * 1000;

function unlockKey(workplaceId: string, yearMonth: string): string {
  return `${workplaceId}:${yearMonth}`;
}

export default function CheckResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as RouteState['/check/result']) ?? null;

  useEffect(() => {
    if (!state) {
      navigate('/check', { replace: true });
    }
  }, [state, navigate]);

  if (!state) return null;

  return (
    <CheckResultContent
      workplaceId={state.workplaceId}
      yearMonth={state.yearMonth}
      actualPaidAmount={state.actualPaidAmount}
    />
  );
}

function CheckResultContent({
  workplaceId,
  yearMonth,
  actualPaidAmount,
}: {
  workplaceId: string;
  yearMonth: string;
  actualPaidAmount: number;
}) {
  const navigate = useNavigate();
  const { loading, workplaces, settings, patchSettings } = useAppData();
  const payroll = useMonthlyPayroll(workplaceId, yearMonth);
  const workplace = workplaces.find((w) => w.id === workplaceId) ?? null;

  const top = <Top title={<Top.TitleParagraph>분석 결과</Top.TitleParagraph>} />;

  if (loading) {
    return (
      <ScreenScaffold top={top}>
        <LoadingState rows={1} testId="check-result-hero-skeleton" />
        <Spacing size={16} />
        <LoadingState rows={2} testId="check-result-list-skeleton" />
      </ScreenScaffold>
    );
  }

  if (!workplace || !payroll) {
    return (
      <ScreenScaffold top={top}>
        <Card testId="check-result-error-card">
          <Paragraph.Text typography="st6">분석 결과를 불러오지 못했어요</Paragraph.Text>
          <Spacing size={12} />
          <Button variant="weak" display="block" onClick={() => navigate('/check')}>
            다시 시도
          </Button>
        </Card>
      </ScreenScaffold>
    );
  }

  const analysis = analyzePay(
    {
      calculatedNet: payroll.net,
      weeklyHoliday: payroll.weeklyHolidayPay,
      night: payroll.nightPay,
      overtime: payroll.overtimePay,
      holiday: payroll.holidayPay,
      minimumWage: payroll.minimumWageShortfall,
    },
    actualPaidAmount
  );

  const unlocked = isUnlocked(settings, workplaceId, yearMonth);

  function handleRewarded() {
    const expireISO = new Date(Date.now() + UNLOCK_DURATION_MS).toISOString();
    patchSettings({
      rewardUnlocks: { ...settings.rewardUnlocks, [unlockKey(workplaceId, yearMonth)]: expireISO },
    });
  }

  const body = (
    <ResultBody
      workplaceId={workplaceId}
      yearMonth={yearMonth}
      actualPaidAmount={actualPaidAmount}
      payroll={payroll}
      analysis={analysis}
      navigate={navigate}
    />
  );

  return (
    <ScreenScaffold top={top}>
      {unlocked ? (
        body
      ) : (
        <TossRewardAd
          slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID ?? ''}
          description="짧은 광고를 보면 분석 결과를 볼 수 있어요"
          buttonText="결과 보기"
          onRewarded={handleRewarded}
        >
          {body}
        </TossRewardAd>
      )}
    </ScreenScaffold>
  );
}

function ResultBody({
  workplaceId,
  yearMonth,
  actualPaidAmount,
  payroll,
  analysis,
  navigate,
}: {
  workplaceId: string;
  yearMonth: string;
  actualPaidAmount: number;
  payroll: MonthlyPayroll;
  analysis: PayAnalysisResult;
  navigate: NavigateFunction;
}) {
  const { savePayCheck } = useAppData();
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    savePayCheck(workplaceId, yearMonth, {
      actualPaidAmount,
      calculatedGross: payroll.gross,
      calculatedNet: payroll.net,
      diff: analysis.diff,
      suspects: analysis.suspects,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleViewRecords() {
    navigate('/records', { state: { workplaceId, yearMonth } satisfies RouteState['/records'] });
  }

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

      <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID ?? ''} />

      <Spacing size={16} />

      <Button variant="weak" display="block" onClick={handleViewRecords}>
        기록 보기
      </Button>

      <Spacing size={16} />
    </>
  );
}
