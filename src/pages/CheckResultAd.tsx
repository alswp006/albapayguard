import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, Button } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Card } from '@/components/Card';
import { TossRewardAd } from '@/components/TossRewardAd';
import { LoadingState } from '@/components/StateView';
import { useAppData, useMonthlyPayroll } from '@/hooks/useAppData';
import { analyzePay, isUnlocked, type PayAnalysisResult } from '@/lib/analysis';
import { CheckResultCore } from '@/pages/CheckResultCore';
import type { MonthlyPayroll, RouteState } from '@/lib/types';

const UNLOCK_DURATION_MS = 24 * 60 * 60 * 1000;

function unlockKey(workplaceId: string, yearMonth: string): string {
  return `${workplaceId}:${yearMonth}`;
}

/**
 * `/check/result` 라우트 엔트리 — 리워드 광고 게이트 + PayCheck upsert를 담당하고,
 * 실제 결과 표시는 CheckResultCore에 위임한다.
 */
export default function CheckResultAd() {
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
    <CheckResultAdContent
      workplaceId={state.workplaceId}
      yearMonth={state.yearMonth}
      actualPaidAmount={state.actualPaidAmount}
    />
  );
}

function CheckResultAdContent({
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

  function handleViewRecords() {
    navigate('/records', { state: { workplaceId, yearMonth } satisfies RouteState['/records'] });
  }

  const body = (
    <UnlockedResult
      workplaceId={workplaceId}
      yearMonth={yearMonth}
      actualPaidAmount={actualPaidAmount}
      payroll={payroll}
      analysis={analysis}
      onViewRecords={handleViewRecords}
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

/** 해제된 결과 노출 시점에 PayCheck를 정확히 1회 upsert하고, 배너 광고 슬롯을 덧붙인다. */
function UnlockedResult({
  workplaceId,
  yearMonth,
  actualPaidAmount,
  payroll,
  analysis,
  onViewRecords,
}: {
  workplaceId: string;
  yearMonth: string;
  actualPaidAmount: number;
  payroll: MonthlyPayroll;
  analysis: PayAnalysisResult;
  onViewRecords: () => void;
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

  return (
    <CheckResultCore
      actualPaidAmount={actualPaidAmount}
      payroll={payroll}
      analysis={analysis}
      onViewRecords={onViewRecords}
    />
  );
}
