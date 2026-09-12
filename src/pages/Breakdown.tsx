import { useLocation, useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, ListRow, Button, Badge, Asset } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Card } from '@/components/Card';
import { DisclaimerGate } from '@/components/DisclaimerGate';
import { LegalNotice } from '@/components/LegalNotice';
import { Amount } from '@/components/Amount';
import { MiniBar } from '@/components/MiniBar';
import { EmptyState, LoadingState } from '@/components/StateView';
import { AdSlot } from '@/components/AdSlot';
import { useAppData, useMonthlyPayroll } from '@/hooks/useAppData';
import { useHaptic } from '@/hooks/useHaptic';
import { formatNumber, nowKst } from '@/lib/utils';
import type { RouteState } from '@/lib/types';
import { ROUTES } from '@/routes';

/** payrollMonthly.ts의 주휴수당 지급 기준(15h)과 동일 — 미충족 주의 "N시간 더 일하면" 안내에 사용 */
const WEEKLY_HOLIDAY_ELIGIBLE_MINUTES = 15 * 60;

function currentYearMonth(): string {
  const now = nowKst();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 주 시작일(월요일)을 "N월 M주차 (N/D~N/D)"로 표시 — 주차는 월 내 날짜 기준 ceil(day/7). */
function formatWeekLabel(weekStart: string): string {
  const [, monthStr, dayStr] = weekStart.split('-');
  const month = Number(monthStr);
  const day = Number(dayStr);
  const weekIndex = Math.ceil(day / 7);
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const endLabel = `${end.getUTCMonth() + 1}/${end.getUTCDate()}`;
  return `${month}월 ${weekIndex}주차 (${month}/${day}~${endLabel})`;
}

function FiveNote({ testId }: { testId: string }) {
  return (
    <div data-testid={testId}>
      <Paragraph.Text typography="st12">5인 미만 사업장은 가산수당 의무가 없어요</Paragraph.Text>
    </div>
  );
}

export default function Breakdown() {
  const navigate = useNavigate();
  const { haptic } = useHaptic();
  const location = useLocation();
  const state = (location.state as RouteState['/breakdown']) ?? null;
  const { loading, workplaces, settings } = useAppData();

  const fallbackWorkplaceId =
    workplaces.find((w) => w.id === settings.activeWorkplaceId)?.id ?? workplaces[0]?.id ?? null;
  const workplaceId =
    state?.workplaceId && workplaces.some((w) => w.id === state.workplaceId)
      ? state.workplaceId
      : fallbackWorkplaceId;
  const yearMonth = state?.yearMonth ?? currentYearMonth();
  const [year, month] = yearMonth.split('-').map(Number);

  const workplace = workplaces.find((w) => w.id === workplaceId) ?? null;
  const payroll = useMonthlyPayroll(workplaceId, yearMonth);

  function handleAddRecord() {
    haptic('success');
    navigate(ROUTES.recordNew, {
      state: { workplaceId: workplaceId ?? '', date: `${yearMonth}-01` } satisfies RouteState['/record/new'],
    });
  }

  function handleAddWorkplace() {
    haptic('tickWeak');
    navigate(ROUTES.workplace);
  }

  function handleAnalyze() {
    if (!workplaceId) return;
    haptic('success');
    navigate(ROUTES.check, { state: { workplaceId, yearMonth } satisfies RouteState['/check'] });
  }

  if (loading) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>급여 상세</Top.TitleParagraph>} />}>
        <LoadingState rows={3} testId="breakdown-loading" />
      </ScreenScaffold>
    );
  }

  if (workplaces.length === 0) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>급여 상세</Top.TitleParagraph>} />}>
        <EmptyState
          icon={<Asset.ContentIcon name="iconStarRegular" alt="근무지" />}
          title="등록된 근무지가 없어요"
          description="근무지를 추가하면 급여를 계산해드려요"
          action={
            <Button variant="weak" display="block" onClick={handleAddWorkplace}>
              근무지 추가하기
            </Button>
          }
          testId="breakdown-empty-workplace"
        />
      </ScreenScaffold>
    );
  }

  if (!payroll || payroll.daily.length === 0) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>급여 상세</Top.TitleParagraph>} />}>
        <EmptyState
          icon={<Asset.ContentIcon name="iconStarRegular" alt="기록" />}
          title="이번 달 기록이 없어요"
          description="출퇴근 시간을 기록하면 급여를 계산해드려요"
          action={
            <Button variant="weak" display="block" onClick={handleAddRecord}>
              기록 추가하기
            </Button>
          }
          testId="breakdown-empty-records"
        />
      </ScreenScaffold>
    );
  }

  const surchargeTotal = payroll.nightPay + payroll.overtimePay + payroll.holidayPay;
  const gross = payroll.gross;
  const baseRatio = gross > 0 ? payroll.basePay / gross : 0;
  const weeklyRatio = gross > 0 ? payroll.weeklyHolidayPay / gross : 0;
  const surchargeRatio = gross > 0 ? surchargeTotal / gross : 0;
  const tax = payroll.gross - payroll.net;
  const showFiveNotice = !workplace?.isFiveOrMore;
  const isFreelanceTax = workplace?.taxType === 'freelance3_3';
  const wageGap = workplace ? payroll.minimumWage - workplace.hourlyWage : 0;

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>급여 상세</Top.TitleParagraph>} />}>
      <DisclaimerGate />
      <Card testId="breakdown-total-card">
        <Paragraph.Text typography="st6">{`${year}년 ${month}월 실수령액`}</Paragraph.Text>
        <Spacing size={4} />
        <Amount value={payroll.net} unit="원" typography="t2" testId="breakdown-total-amount" />
      </Card>

      <Spacing size={16} />

      <Card testId="breakdown-composition-card">
        <Paragraph.Text typography="t6">기본급</Paragraph.Text>
        <Spacing size={4} />
        <MiniBar ratio={baseRatio} testId="breakdown-bar-base" />
        <Spacing size={12} />
        <Paragraph.Text typography="t6">주휴수당</Paragraph.Text>
        <Spacing size={4} />
        <MiniBar ratio={weeklyRatio} testId="breakdown-bar-weekly" />
        <Spacing size={12} />
        <Paragraph.Text typography="t6">가산수당</Paragraph.Text>
        <Spacing size={4} />
        <MiniBar ratio={surchargeRatio} testId="breakdown-bar-surcharge" />
      </Card>

      <Spacing size={16} />

      <Card testId="breakdown-card">
        <div data-testid="breakdown-item-base">
          <ListRow
            contents={<ListRow.Texts type="1RowTypeA" top="기본급" />}
            right={<Amount value={payroll.basePay} unit="원" testId="breakdown-amount-base" />}
          />
        </div>
        <div data-testid="breakdown-item-night">
          <ListRow
            contents={<ListRow.Texts type="1RowTypeA" top="야간가산" />}
            right={<Amount value={payroll.nightPay} unit="원" testId="breakdown-amount-night" />}
          />
        </div>
        {showFiveNotice && <FiveNote testId="breakdown-five-note-night" />}
        <div data-testid="breakdown-item-overtime">
          <ListRow
            contents={<ListRow.Texts type="1RowTypeA" top="연장가산" />}
            right={<Amount value={payroll.overtimePay} unit="원" testId="breakdown-amount-overtime" />}
          />
        </div>
        {showFiveNotice && <FiveNote testId="breakdown-five-note-overtime" />}
        <div data-testid="breakdown-item-holiday">
          <ListRow
            contents={<ListRow.Texts type="1RowTypeA" top="휴일가산" />}
            right={<Amount value={payroll.holidayPay} unit="원" testId="breakdown-amount-holiday" />}
          />
        </div>
        {showFiveNotice && <FiveNote testId="breakdown-five-note-holiday" />}
        <div data-testid="breakdown-item-weeklyHoliday">
          <ListRow
            contents={<ListRow.Texts type="1RowTypeA" top="주휴수당" />}
            right={<Amount value={payroll.weeklyHolidayPay} unit="원" testId="breakdown-amount-weekly" />}
          />
        </div>
        <div data-testid="breakdown-item-tax">
          <ListRow
            contents={<ListRow.Texts type="1RowTypeA" top="세금공제" />}
            right={<Amount value={tax} unit="원" testId="breakdown-amount-tax" />}
          />
        </div>
        <div data-testid="net-pay-row">
          <div data-testid="breakdown-item-net">
            <ListRow
              contents={
                isFreelanceTax ? (
                  <ListRow.Texts type="2RowTypeA" top="세후 예상" bottom="사업소득세 3.3% 공제 기준" />
                ) : (
                  <ListRow.Texts type="1RowTypeA" top="실수령액" />
                )
              }
              right={<Amount value={payroll.net} unit="원" testId="breakdown-amount-net" />}
            />
          </div>
        </div>
      </Card>

      <Spacing size={16} />

      {payroll.weeks.length > 0 && (
        <>
          <Card testId="weekly-holiday-card">
            {payroll.weeks.map((week) => {
              const remainingHours = Math.ceil((WEEKLY_HOLIDAY_ELIGIBLE_MINUTES - week.weeklyMinutes) / 60);
              // 주 근로시간을 먼저 보여준다 — 주휴 판정의 근거가 되는 숫자라 판정만 보면 이유를 알 수 없다.
              const weeklyHours = Math.round(week.weeklyMinutes / 6) / 10;
              const bottom = week.eligible
                ? `주 ${weeklyHours}시간 · ${formatNumber(week.amount)}원`
                : `주 ${weeklyHours}시간 · ${remainingHours}시간 더 일하면 주휴수당 받아요`;
              return (
                <div key={week.weekStart} data-testid={`breakdown-week-${week.weekStart}`}>
                  <ListRow
                    contents={
                      <ListRow.Texts
                        type="2RowTypeA"
                        top={formatWeekLabel(week.weekStart)}
                        bottom={bottom}
                      />
                    }
                    right={
                      <Badge size="small" variant="weak" color={week.eligible ? 'blue' : 'elephant'}>
                        {week.eligible ? '주휴 지급' : '주휴 미지급'}
                      </Badge>
                    }
                  />
                </div>
              );
            })}
          </Card>
          <Spacing size={8} />
          <div data-testid="breakdown-attendance-note">
            <Paragraph.Text typography="st12">
              개근 여부는 기록된 근무시간(주 15시간)만으로 판정해요
            </Paragraph.Text>
          </div>
          <Spacing size={16} />
        </>
      )}

      {payroll.isBelowMinimumWage && (
        <div data-testid="minimum-wage-warning">
          <Card testId="breakdown-minwage-warning">
            <Paragraph.Text typography="st6">시급이 최저임금보다 낮아요</Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="st12">
              {`${year}년 최저임금 ${formatNumber(payroll.minimumWage)}원보다 ${formatNumber(wageGap)}원 낮아요`}
            </Paragraph.Text>
            <Spacing size={8} />
            <Paragraph.Text typography="st12">
              {`부족액 ${formatNumber(payroll.minimumWageShortfall)}원`}
            </Paragraph.Text>
          </Card>
          <Spacing size={16} />
        </div>
      )}

      <Button variant="fill" display="block" onClick={handleAnalyze}>
        미지급 분석하기
      </Button>

      <Spacing size={16} />

      <LegalNotice testId="breakdown-disclaimer" />

      <Spacing size={16} />

      <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID ?? ''} />

      <Spacing size={16} />
    </ScreenScaffold>
  );
}
