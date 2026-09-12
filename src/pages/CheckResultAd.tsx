import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, Button, Toast } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Card } from '@/components/Card';
import { SubmitFooter } from '@/components/BottomCTA';
import { TossRewardAd } from '@/components/TossRewardAd';
import { LoadingState } from '@/components/StateView';
import { useAppData, useMonthlyPayroll } from '@/hooks/useAppData';
import { useHaptic } from '@/hooks/useHaptic';
import { analyzePay, isUnlocked } from '@/lib/analysis';
import { CheckResultCore } from '@/pages/CheckResultCore';
import type { RouteState } from '@/lib/types';
import { ROUTES } from '@/routes';

const UNLOCK_DURATION_MS = 24 * 60 * 60 * 1000;

function unlockKey(workplaceId: string, yearMonth: string): string {
  return `${workplaceId}:${yearMonth}`;
}

/**
 * `/check/result` 라우트 엔트리 — 리워드 광고 게이트 + PayCheck 저장(F6 AC-6: 사용자가
 * SubmitFooter "분석 결과 저장"을 탭할 때만 저장)을 담당하고, 실제 결과 표시는
 * CheckResultCore에 위임한다.
 */
export default function CheckResultAd() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as RouteState['/check/result']) ?? null;

  useEffect(() => {
    if (!state) {
      navigate(ROUTES.check, { replace: true });
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
  const { haptic } = useHaptic();
  const { loading, workplaces, settings, patchSettings, savePayCheck } = useAppData();
  const payroll = useMonthlyPayroll(workplaceId, yearMonth);
  const workplace = workplaces.find((w) => w.id === workplaceId) ?? null;

  const [saving, setSaving] = useState(false);
  const [saveErrorToastOpen, setSaveErrorToastOpen] = useState(false);

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
          <Button variant="weak" display="block" onClick={() => navigate(ROUTES.check)}>
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
    navigate(ROUTES.records, { state: { workplaceId, yearMonth } satisfies RouteState['/records'] });
  }

  // F6 AC-6: "분석 결과 저장" 탭 시에만 PayCheck를 upsert하고, 성공하면 Toast와 함께
  // /check로 복귀한다. 자동 저장하지 않는다 — 사용자가 결과를 보고도 저장을 원치 않을 수 있다.
  async function handleSaveResult() {
    setSaving(true);
    const result = await savePayCheck(workplaceId, yearMonth, {
      actualPaidAmount,
      calculatedGross: payroll!.gross,
      calculatedNet: payroll!.net,
      diff: analysis.diff,
      suspects: analysis.suspects,
    });
    setSaving(false);
    if (!result.ok) {
      setSaveErrorToastOpen(true);
      return;
    }
    haptic('success');
    navigate(ROUTES.check, {
      replace: true,
      state: { workplaceId, yearMonth, toast: '분석 결과를 저장했어요' } satisfies RouteState['/check'],
    });
  }

  const body = (
    <CheckResultCore
      actualPaidAmount={actualPaidAmount}
      payroll={payroll}
      analysis={analysis}
      onViewRecords={handleViewRecords}
    />
  );

  return (
    <ScreenScaffold
      top={top}
      bottom={
        unlocked ? (
          <SubmitFooter label="분석 결과 저장" onClick={handleSaveResult} loading={saving} />
        ) : undefined
      }
    >
      {unlocked ? (
        <>
          {body}
          {/* FixedBottomCTA는 position:fixed라 마지막 줄이 버튼 뒤에 가려지지 않게 여백을 둔다 */}
          <Spacing size={96} />
        </>
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

      <Toast
        open={saveErrorToastOpen}
        position="bottom"
        text="저장 공간이 부족합니다. 오래된 기록을 삭제해주세요"
        duration={3000}
        onClose={() => setSaveErrorToastOpen(false)}
      />
    </ScreenScaffold>
  );
}
