import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, ListRow, Button, Badge } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { MonthNav } from '@/components/MonthNav';
import { SummaryHero } from '@/components/SummaryHero';
import { CountUp } from '@/components/CountUp';
import { Sparkline } from '@/components/Sparkline';
import { MiniBar } from '@/components/MiniBar';
import { Card } from '@/components/Card';
import { EmptyState, LoadingState } from '@/components/StateView';
import { AdSlot } from '@/components/AdSlot';
import { useAppData, useMonthlyPayroll } from '@/hooks/useAppData';
import { useHaptic } from '@/hooks/useHaptic';
import { parseHHmm, calcWorkedMinutes, calcNightMinutes } from '@/lib/payrollDaily';
import { formatNumber } from '@/lib/utils';
import type { RouteState } from '@/lib/types';

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

function formatDateLabel(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}월 ${Number(d)}일`;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0시간';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

export default function Home() {
  const navigate = useNavigate();
  const { haptic } = useHaptic();
  const { loading, workplaces, records, settings, setActiveWorkplace } = useAppData();
  const [monthOffset, setMonthOffset] = useState(0);

  const { yearMonth, year, month } = shiftYearMonth(new Date(), monthOffset);
  const isCurrentMonth = monthOffset === 0;
  const monthTitle = `${year}년 ${month}월`;

  const resolvedActiveId =
    workplaces.find((w) => w.id === settings.activeWorkplaceId)?.id ?? workplaces[0]?.id ?? null;
  const activeWorkplace = workplaces.find((w) => w.id === resolvedActiveId) ?? null;

  const payroll = useMonthlyPayroll(resolvedActiveId, yearMonth);

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
    if (!resolvedActiveId) return;
    haptic('tickWeak');
    navigate('/breakdown', {
      state: { workplaceId: resolvedActiveId, yearMonth } satisfies RouteState['/breakdown'],
    });
  }

  function handleAddRecord() {
    if (!resolvedActiveId) return;
    haptic('success');
    navigate('/record/new', {
      state: { workplaceId: resolvedActiveId, date: todayISODate() } satisfies RouteState['/record/new'],
    });
  }

  if (loading) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>내 급여</Top.TitleParagraph>} />}>
        <Card>
          <StatSkeletonRow />
        </Card>
        <Spacing size={24} />
        <LoadingState rows={3} testId="home-recent-skeleton" />
      </ScreenScaffold>
    );
  }

  if (workplaces.length === 0) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>내 급여</Top.TitleParagraph>} />}>
        <EmptyState
          title="등록된 근무지가 없어요"
          description="근무지를 추가하면 예상 급여를 계산해드려요"
          action={
            <Button variant="fill" display="block" onClick={() => navigate('/workplace')}>
              근무지 추가하기
            </Button>
          }
        />
      </ScreenScaffold>
    );
  }

  const gross = payroll?.gross ?? 0;
  const workedHours = Math.floor((payroll?.totalMinutes ?? 0) / 60);
  const hasMonthlyRecords = (payroll?.daily.length ?? 0) > 0;

  const cumulative: number[] = [];
  let running = 0;
  for (const d of payroll?.daily ?? []) {
    running += d.total;
    cumulative.push(running);
  }

  const baseRatio = gross > 0 ? (payroll?.basePay ?? 0) / gross : 0;
  const weeklyRatio = gross > 0 ? (payroll?.weeklyHolidayPay ?? 0) / gross : 0;
  const extraRatio =
    gross > 0
      ? ((payroll?.nightPay ?? 0) + (payroll?.overtimePay ?? 0) + (payroll?.holidayPay ?? 0)) / gross
      : 0;

  const recentRecords = records
    .filter((r) => r.workplaceId === resolvedActiveId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>내 급여</Top.TitleParagraph>} />}>
      <MonthNav
        label={monthTitle}
        onPrev={handlePrevMonth}
        onNext={handleNextMonth}
        nextDisabled={isCurrentMonth}
        testId="home-month-nav"
      />

      <Spacing size={12} />

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {workplaces.map((w) => {
          const isActive = w.id === resolvedActiveId;
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
                height: 36,
                borderRadius: 999,
                flexShrink: 0,
                border: isActive ? 'none' : '1px solid var(--adaptiveGrey200)',
                backgroundColor: isActive ? 'var(--adaptiveBlue500)' : 'var(--adaptiveLayeredBackground)',
              }}
            >
              <span
                style={{
                  padding: '0 14px',
                  color: isActive ? 'var(--adaptiveGrey50)' : 'var(--adaptiveGrey700)',
                }}
              >
                <Paragraph.Text typography="st5">{w.name}</Paragraph.Text>
              </span>
            </button>
          );
        })}
      </div>

      <Spacing size={16} />

      <div
        data-testid="home-hero"
        role="button"
        tabIndex={0}
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
          label="이번 달 예상 급여"
          value={<CountUp value={gross} unit="원" typography="t1" testId="home-hero-amount" />}
          caption={`${activeWorkplace?.name ?? ''} · ${workedHours}시간 근무`}
        />
      </div>

      <Spacing size={16} />

      {hasMonthlyRecords ? (
        <>
          <Sparkline data={cumulative} testId="pay-trend-sparkline" />
          <Spacing size={12} />
          <Card testId="pay-composition-card">
            <Paragraph.Text typography="t6">기본급</Paragraph.Text>
            <Spacing size={4} />
            <MiniBar ratio={baseRatio} testId="pay-composition-bar-base" />
            <Spacing size={12} />
            <Paragraph.Text typography="t6">주휴수당</Paragraph.Text>
            <Spacing size={4} />
            <MiniBar ratio={weeklyRatio} testId="pay-composition-bar-weekly" />
            <Spacing size={12} />
            <Paragraph.Text typography="t6">가산수당</Paragraph.Text>
            <Spacing size={4} />
            <MiniBar ratio={extraRatio} testId="pay-composition-bar-extra" />
          </Card>
        </>
      ) : (
        <EmptyState
          title="아직 이번 달 기록이 없어요"
          description="출퇴근 시간을 기록하면 예상 급여를 계산해드려요"
        />
      )}

      <Spacing size={24} />

      {recentRecords.length > 0 && (
        <>
          <Paragraph.Text typography="t4">최근 기록</Paragraph.Text>
          <Spacing size={12} />
          <Card testId="recent-records-card">
            {recentRecords.map((r) => {
              const start = parseHHmm(r.startTime);
              const end = parseHHmm(r.endTime);
              const workedMinutes = start && end ? calcWorkedMinutes(start, end, r.breakMinutes) : 0;
              const nightMinutes = start && end ? calcNightMinutes(start, end) : 0;
              const tag = r.isHoliday ? '휴일' : nightMinutes > 0 ? '야간' : '기본';
              return (
                <ListRow
                  key={r.id}
                  contents={
                    <ListRow.Texts
                      type="2RowTypeA"
                      top={formatDateLabel(r.date)}
                      bottom={`${r.startTime}–${r.endTime} · ${formatDuration(workedMinutes)}`}
                    />
                  }
                  right={
                    <Badge
                      size="small"
                      variant="weak"
                      color={tag === '휴일' ? 'red' : tag === '야간' ? 'blue' : 'elephant'}
                    >
                      {tag}
                    </Badge>
                  }
                />
              );
            })}
          </Card>
          <Spacing size={16} />
        </>
      )}

      <Button data-testid="cta-add-record" variant="fill" display="block" onClick={handleAddRecord}>
        기록 추가하기
      </Button>

      <Spacing size={16} />

      <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID ?? ''} />

      <Spacing size={16} />
    </ScreenScaffold>
  );
}

function StatSkeletonRow() {
  return <LoadingState rows={1} testId="home-hero-skeleton" />;
}
