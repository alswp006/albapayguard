import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, Button, Asset } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { MonthNav } from '@/components/MonthNav';
import { SummaryHero } from '@/components/SummaryHero';
import { CountUp } from '@/components/CountUp';
import { Sparkline } from '@/components/Sparkline';
import { MiniBar } from '@/components/MiniBar';
import { Card } from '@/components/Card';
import { EmptyState, LoadingState } from '@/components/StateView';
import { RecentRecordsCard } from '@/components/RecentRecordsCard';
import { AddRecordCTA } from '@/components/AddRecordCTA';
import { AdSlotBanner } from '@/components/AdSlotBanner';
import { useAppData, useMonthlyPayroll } from '@/hooks/useAppData';
import { useHaptic } from '@/hooks/useHaptic';
import type { MonthlyPayroll, RouteState } from '@/lib/types';

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** offset개월 뒤(음수면 이전)의 연/월을 UTC 기준으로 계산 — 로컬 타임존 밀림 방지 */
function shiftYearMonth(base: Date, offset: number) {
  const shifted = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1));
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  return { year, month, yearMonth: `${year}-${String(month).padStart(2, '0')}` };
}

/** 기본급·주휴수당·가산수당(야간+연장+휴일)이 총액에서 차지하는 비중 */
function composition(payroll: MonthlyPayroll | null) {
  const gross = payroll?.gross ?? 0;
  const ratio = (amount: number) => (gross > 0 ? amount / gross : 0);
  return {
    base: ratio(payroll?.basePay ?? 0),
    weeklyHoliday: ratio(payroll?.weeklyHolidayPay ?? 0),
    extra: ratio(
      (payroll?.nightPay ?? 0) + (payroll?.overtimePay ?? 0) + (payroll?.holidayPay ?? 0)
    ),
  };
}

/** 일별 급여의 누적 합 — 스파크라인은 우상향 곡선이 되어 '이번 달이 쌓이는' 흐름을 보여준다 */
function cumulativeDaily(payroll: MonthlyPayroll | null): number[] {
  const out: number[] = [];
  let running = 0;
  for (const d of payroll?.daily ?? []) {
    running += d.total;
    out.push(running);
  }
  return out;
}

export default function Home() {
  const navigate = useNavigate();
  const { haptic } = useHaptic();
  const { loading, workplaces, records, settings, setActiveWorkplace } = useAppData();
  const [monthOffset, setMonthOffset] = useState(0);

  const { yearMonth, year, month } = shiftYearMonth(new Date(), monthOffset);
  const isCurrentMonth = monthOffset === 0;
  const monthLabel = `${year}년 ${month}월`;

  // 저장된 activeWorkplaceId가 삭제된 근무지를 가리킬 수 있다(손상) → 첫 근무지로 대체.
  const activeWorkplace =
    workplaces.find((w) => w.id === settings?.activeWorkplaceId) ?? workplaces[0] ?? null;
  const activeWorkplaceId = activeWorkplace?.id ?? null;

  const payroll = useMonthlyPayroll(activeWorkplaceId, yearMonth);

  function handlePrevMonth() {
    haptic('tickWeak');
    setMonthOffset((o) => o - 1);
  }

  function handleNextMonth() {
    if (isCurrentMonth) return;
    haptic('tickWeak');
    setMonthOffset((o) => Math.min(0, o + 1));
  }

  function handleSelectWorkplace(id: string) {
    haptic('tickWeak');
    void setActiveWorkplace(id);
  }

  function handleHeroClick() {
    if (!activeWorkplaceId) return;
    haptic('tickWeak');
    navigate('/breakdown', {
      state: { workplaceId: activeWorkplaceId, yearMonth } satisfies RouteState['/breakdown'],
    });
  }

  function handleAddRecord() {
    if (!activeWorkplaceId) return;
    haptic('success');
    navigate('/record/new', {
      state: {
        workplaceId: activeWorkplaceId,
        date: todayISODate(),
      } satisfies RouteState['/record/new'],
    });
  }

  function handleEditRecord(recordId: string) {
    haptic('tickWeak');
    navigate(`/record/${recordId}/edit`);
  }

  const homeTop = <Top title={<Top.TitleParagraph>내 급여</Top.TitleParagraph>} />;

  // ── 로딩: 히어로 자리 1줄 + 목록 자리 3줄 골격. 금액(0원)을 미리 보여주지 않는다 ──
  if (loading) {
    return (
      <ScreenScaffold top={homeTop}>
        <Card>
          <LoadingState rows={1} testId="home-hero-skeleton" />
        </Card>
        <Spacing size={24} />
        <LoadingState rows={3} testId="home-recent-skeleton" />
      </ScreenScaffold>
    );
  }

  // ── 근무지 0건: 계산할 기준이 없으므로 근무지 등록 한 가지만 안내 ──
  if (workplaces.length === 0) {
    return (
      <ScreenScaffold top={homeTop}>
        <EmptyState
          icon={<Asset.ContentIcon name="iconStarRegular" alt="근무지" />}
          title="등록된 근무지가 없어요"
          description="근무지를 등록하면 시급과 근무시간으로 급여를 계산해요"
          action={
            <Button variant="fill" display="block" onClick={() => navigate('/workplace')}>
              근무지 추가하기
            </Button>
          }
          testId="home-empty-workplace"
        />
      </ScreenScaffold>
    );
  }

  const gross = payroll?.gross ?? 0;
  const workedHours = Math.floor((payroll?.totalMinutes ?? 0) / 60);
  const hasMonthlyRecords = (payroll?.daily.length ?? 0) > 0;
  const cumulative = cumulativeDaily(payroll);
  const ratios = composition(payroll);

  return (
    <ScreenScaffold top={homeTop}>
      <MonthNav
        label={monthLabel}
        onPrev={handlePrevMonth}
        onNext={handleNextMonth}
        nextDisabled={isCurrentMonth}
        testId="home-month-nav"
      />

      <Spacing size={12} />

      {/* 근무지 전환 — TDS Chip은 testId를 넘기지 못해 adaptive 토큰 기반 커스텀 칩으로 둔다 */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {workplaces.map((w) => {
          const isActive = w.id === activeWorkplaceId;
          return (
            <button
              key={w.id}
              type="button"
              data-testid={`workplace-chip-${w.id}`}
              aria-pressed={isActive}
              onClick={() => handleSelectWorkplace(w.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 44,
                borderRadius: 999,
                flexShrink: 0,
                border: isActive ? 'none' : '1px solid var(--adaptiveGrey200)',
                backgroundColor: isActive
                  ? 'var(--adaptiveBlue500)'
                  : 'var(--adaptiveLayeredBackground)',
              }}
            >
              <span
                style={{
                  padding: '0 16px',
                  color: isActive ? 'var(--adaptiveGrey50)' : 'var(--adaptiveGrey700)',
                  whiteSpace: 'nowrap',
                }}
              >
                <Paragraph.Text typography="st7">{w.name}</Paragraph.Text>
              </span>
            </button>
          );
        })}
      </div>

      <Spacing size={16} />

      {/* 히어로 탭 → 급여 상세. Card 전체가 탭 영역이라 44px는 충분히 넘는다 */}
      <div
        data-testid="home-hero"
        role="button"
        tabIndex={0}
        aria-label={`${monthLabel} 예상 급여 상세 보기`}
        onClick={handleHeroClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleHeroClick();
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        <SummaryHero
          testId="pay-hero"
          label="이번 달 예상 급여"
          value={<CountUp value={gross} unit="원" typography="t1" testId="home-hero-amount" />}
          caption={`${activeWorkplace?.name ?? ''} · ${workedHours}시간 근무`}
        />
      </div>

      <Spacing size={16} />

      {hasMonthlyRecords ? (
        <>
          <Card testId="pay-trend-card">
            <Paragraph.Text typography="t6">일별 누적</Paragraph.Text>
            <Spacing size={8} />
            <Sparkline data={cumulative} testId="pay-trend-sparkline" />
          </Card>
          <Spacing size={12} />
          <Card testId="pay-composition-card">
            <Paragraph.Text typography="t6">기본급</Paragraph.Text>
            <Spacing size={4} />
            <MiniBar ratio={ratios.base} testId="pay-composition-bar-base" />
            <Spacing size={12} />
            <Paragraph.Text typography="t6">주휴수당</Paragraph.Text>
            <Spacing size={4} />
            <MiniBar ratio={ratios.weeklyHoliday} testId="pay-composition-bar-weekly" />
            <Spacing size={12} />
            <Paragraph.Text typography="t6">가산수당</Paragraph.Text>
            <Spacing size={4} />
            <MiniBar ratio={ratios.extra} testId="pay-composition-bar-extra" />
          </Card>
        </>
      ) : (
        <EmptyState
          icon={<Asset.ContentIcon name="iconStarRegular" alt="기록" />}
          title="아직 이번 달 기록이 없어요"
          description="출퇴근 시간을 기록하면 주휴수당까지 계산해요"
          testId="home-empty-records"
        />
      )}

      <Spacing size={24} />

      <RecentRecordsCard
        records={records}
        workplace={activeWorkplace}
        onSelect={handleEditRecord}
      />

      <Spacing size={16} />

      <AddRecordCTA onClick={handleAddRecord} />

      <Spacing size={16} />

      <AdSlotBanner />

      <Spacing size={16} />
    </ScreenScaffold>
  );
}
