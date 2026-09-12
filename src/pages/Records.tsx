import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Top, ListRow, Badge, Paragraph, Spacing, Button, AlertDialog, Toast, Asset } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Card } from '@/components/Card';
import { Amount } from '@/components/Amount';
import { EmptyState, LoadingState } from '@/components/StateView';
import { AdSlot } from '@/components/AdSlot';
import { useAppData, useMonthlyPayroll } from '@/hooks/useAppData';
import { useHaptic } from '@/hooks/useHaptic';
import { calcDaily } from '@/lib/payrollDaily';
import type { RouteState } from '@/lib/types';
import { ROUTES, toRecordEdit } from '@/routes';

const PAGE_SIZE = 20;
const RECENT_MONTHS = 6;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 오늘 기준 최근 count개월(당월 포함, 최신순) 'YYYY-MM' 목록 */
function recentYearMonths(count: number): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function monthChipLabel(yearMonth: string, currentYear: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return y === currentYear ? `${m}월` : `${y}년 ${m}월`;
}

function formatDateWithDow(date: string): string {
  const [, m, d] = date.split('-');
  const dow = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${Number(m)}월 ${Number(d)}일(${dow})`;
}

function formatWorkedDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

/** 근무지/월 선택용 커스텀 칩 — TDS Chip은 컨테이너(ChipItem이 실제 선택 단위)라 단일 선택 버튼엔 과함 */
function ChipButton({
  children,
  selected,
  onClick,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 36,
        padding: '0 14px',
        borderRadius: 999,
        flexShrink: 0,
        border: selected ? 'none' : '1px solid var(--adaptiveGrey200)',
        backgroundColor: selected ? 'var(--adaptiveBlue500)' : 'var(--adaptiveLayeredBackground)',
        color: selected ? 'var(--adaptiveGrey50)' : 'var(--adaptiveGrey700)',
      }}
    >
      <Paragraph.Text typography="st5">{children}</Paragraph.Text>
    </button>
  );
}

export default function Records() {
  const navigate = useNavigate();
  const { haptic } = useHaptic();
  const location = useLocation();
  const state = (location.state as RouteState['/records']) ?? null;

  const { loading, workplaces, records, settings, removeRecord } = useAppData();

  const incomingToast = state?.toast;
  const [savedToastOpen, setSavedToastOpen] = useState(Boolean(incomingToast));
  const [workplaceOverride, setWorkplaceOverride] = useState<string | null>(null);
  const [monthOverride, setMonthOverride] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (incomingToast) setSavedToastOpen(true);
  }, [incomingToast]);

  const fallbackWorkplaceId =
    workplaces.find((w) => w.id === settings.activeWorkplaceId)?.id ?? workplaces[0]?.id ?? null;
  const stateWorkplaceId =
    state?.workplaceId && workplaces.some((w) => w.id === state.workplaceId)
      ? state.workplaceId
      : fallbackWorkplaceId;
  const workplaceId =
    workplaceOverride && workplaces.some((w) => w.id === workplaceOverride)
      ? workplaceOverride
      : stateWorkplaceId;
  const yearMonth = monthOverride ?? state?.yearMonth ?? currentYearMonth();

  const workplace = workplaces.find((w) => w.id === workplaceId) ?? null;
  const payroll = useMonthlyPayroll(workplaceId, yearMonth);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [workplaceId, yearMonth]);

  const scopedRecords = useMemo(() => {
    return records
      .filter((r) => r.workplaceId === workplaceId && r.date.slice(0, 7) === yearMonth)
      .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
  }, [records, workplaceId, yearMonth]);

  function handleSelectWorkplace(id: string) {
    haptic('tickWeak');
    setWorkplaceOverride(id);
  }

  function handleSelectMonth(m: string) {
    haptic('tickWeak');
    setMonthOverride(m);
  }

  function handleRowClick(id: string) {
    navigate(toRecordEdit(id));
  }

  function handleDeleteClick(e: MouseEvent<HTMLButtonElement>, id: string) {
    e.stopPropagation();
    setDeleteTargetId(id);
  }

  async function handleConfirmDelete() {
    if (!deleteTargetId) return;
    await removeRecord(deleteTargetId);
    haptic('success');
    setDeleteTargetId(null);
  }

  function handleAddRecord() {
    if (!workplaceId) return;
    haptic('success');
    navigate(ROUTES.recordNew, {
      state: { workplaceId, date: `${yearMonth}-01` } satisfies RouteState['/record/new'],
    });
  }

  function handleLoadMore() {
    setVisibleCount((c) => c + PAGE_SIZE);
  }

  if (loading) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>기록 목록</Top.TitleParagraph>} />}>
        <LoadingState rows={5} testId="records-loading" />
      </ScreenScaffold>
    );
  }

  if (workplaces.length === 0) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>기록 목록</Top.TitleParagraph>} />}>
        <EmptyState
          icon={<Asset.ContentIcon name="iconStarRegular" alt="근무지" />}
          title="등록된 근무지가 없어요"
          description="근무지를 추가하면 기록을 남길 수 있어요"
          action={
            <Button variant="weak" display="block" onClick={() => navigate(ROUTES.workplace)}>
              근무지 추가하기
            </Button>
          }
        />
      </ScreenScaffold>
    );
  }

  const currentYear = Number(currentYearMonth().slice(0, 4));
  const months = recentYearMonths(RECENT_MONTHS);
  const visibleRecords = scopedRecords.slice(0, visibleCount);
  const hasMore = scopedRecords.length > visibleCount;

  const gross = payroll?.gross ?? 0;
  const dayCount = payroll?.daily.length ?? 0;
  const workedHours = Math.floor((payroll?.totalMinutes ?? 0) / 60);

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>기록 목록</Top.TitleParagraph>} />}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {workplaces.map((w) => (
          <ChipButton key={w.id} selected={w.id === workplaceId} onClick={() => handleSelectWorkplace(w.id)}>
            {w.name}
          </ChipButton>
        ))}
      </div>

      <Spacing size={8} />

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {months.map((m) => (
          <ChipButton key={m} selected={m === yearMonth} onClick={() => handleSelectMonth(m)}>
            {monthChipLabel(m, currentYear)}
          </ChipButton>
        ))}
      </div>

      <Spacing size={16} />

      <Card testId="records-summary-card">
        <Paragraph.Text typography="st6">
          {`근무 ${dayCount}일 · ${workedHours}시간`}
        </Paragraph.Text>
        <Spacing size={4} />
        <Amount value={gross} unit="원" typography="t3" testId="records-summary-total" />
      </Card>

      <Spacing size={16} />

      {scopedRecords.length === 0 ? (
        <EmptyState
          testId="records-empty"
          icon={<Asset.ContentIcon name="iconStarRegular" alt="기록" />}
          title="이 달에는 기록이 없어요"
          action={
            <Button variant="weak" display="block" onClick={handleAddRecord}>
              기록 추가하기
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            {visibleRecords.map((r) => {
              const daily = workplace
                ? calcDaily(
                    { startTime: r.startTime, endTime: r.endTime, breakMinutes: r.breakMinutes },
                    { wage: workplace.hourlyWage, isFiveOrMore: workplace.isFiveOrMore }
                  )
                : null;
              return (
                <ListRow
                  key={r.id}
                  data-testid={`records-row-${r.id}`}
                  onClick={() => handleRowClick(r.id)}
                  contents={
                    <ListRow.Texts
                      type="2RowTypeA"
                      top={formatDateWithDow(r.date)}
                      bottom={`${r.startTime}–${r.endTime} · ${formatWorkedDuration(daily?.workedMinutes ?? 0)}`}
                    />
                  }
                  right={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge size="small" variant="weak" color={r.isHoliday ? 'red' : 'elephant'}>
                        {r.isHoliday ? '휴일' : '평일'}
                      </Badge>
                      <Amount value={daily?.total ?? 0} unit="원" typography="st4" />
                      <Button
                        variant="weak"
                        size="small"
                        color="danger"
                        data-testid={`records-delete-${r.id}`}
                        onClick={(e: MouseEvent<HTMLButtonElement>) => handleDeleteClick(e, r.id)}
                      >
                        삭제
                      </Button>
                    </div>
                  }
                />
              );
            })}
          </Card>

          <Spacing size={12} />

          {hasMore && (
            <Button
              variant="weak"
              size="large"
              display="block"
              data-testid="records-load-more"
              onClick={handleLoadMore}
            >
              더보기
            </Button>
          )}
        </>
      )}

      <Spacing size={16} />

      <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID ?? ''} />

      <Spacing size={16} />

      <AlertDialog
        open={Boolean(deleteTargetId)}
        title="기록을 삭제할까요"
        description="삭제하면 되돌릴 수 없어요"
        alertButton={<AlertDialog.AlertButton onClick={handleConfirmDelete}>삭제하기</AlertDialog.AlertButton>}
        onClose={() => setDeleteTargetId(null)}
      />

      <Toast
        open={savedToastOpen}
        position="bottom"
        text={incomingToast ?? ''}
        duration={3000}
        onClose={() => setSavedToastOpen(false)}
      />
    </ScreenScaffold>
  );
}
