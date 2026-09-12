import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, TextField, Button, Asset, Toast } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Card } from '@/components/Card';
import { Amount } from '@/components/Amount';
import { EmptyState, LoadingState } from '@/components/StateView';
import { useAppData, useMonthlyPayroll } from '@/hooks/useAppData';
import { useHaptic } from '@/hooks/useHaptic';
import { formatNumber } from '@/lib/utils';
import type { RouteState } from '@/lib/types';

const MAX_AMOUNT = 100_000_000;
const AMOUNT_ERROR = '0원 이상 1억원 이하로 입력해주세요';

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

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const isThisYear = year === new Date().getUTCFullYear();
  return isThisYear ? `${month}월` : `${year}년 ${month}월`;
}

function parseAmount(display: string): number {
  const digits = display.replace(/[^0-9]/g, '');
  return digits === '' ? NaN : Number(digits);
}

/** 근무지/월 선택용 커스텀 칩 — TDS Chip은 컨테이너(ChipItem이 실제 선택 단위)라 단일 선택 버튼엔 과함 */
function ChipButton({
  children,
  selected,
  onClick,
  testId,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
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

export default function Check() {
  const navigate = useNavigate();
  const { haptic } = useHaptic();
  const location = useLocation();
  const state = (location.state as RouteState['/check']) ?? null;
  const { loading, workplaces, settings } = useAppData();

  const fallbackWorkplaceId =
    workplaces.find((w) => w.id === settings.activeWorkplaceId)?.id ?? workplaces[0]?.id ?? null;
  const initialWorkplaceId =
    state?.workplaceId && workplaces.some((w) => w.id === state.workplaceId)
      ? state.workplaceId
      : fallbackWorkplaceId;
  const initialYearMonth = state?.yearMonth ?? currentYearMonth();

  const [workplaceOverride, setWorkplaceOverride] = useState<string | null>(null);
  const [monthOverride, setMonthOverride] = useState<string | null>(null);
  const [amountDisplay, setAmountDisplay] = useState('');
  const [amountError, setAmountError] = useState(false);
  const incomingToast = state?.toast;
  const [savedToastOpen, setSavedToastOpen] = useState(Boolean(incomingToast));

  useEffect(() => {
    if (incomingToast) setSavedToastOpen(true);
  }, [incomingToast]);

  const workplaceId = workplaceOverride ?? initialWorkplaceId;
  const yearMonth = monthOverride ?? initialYearMonth;

  const payroll = useMonthlyPayroll(workplaceId, yearMonth);
  const hasRecords = (payroll?.daily.length ?? 0) > 0;
  const hours = Math.floor((payroll?.totalMinutes ?? 0) / 60);
  const months = recentYearMonths(6);

  function handleSelectWorkplace(id: string) {
    haptic('tickWeak');
    setWorkplaceOverride(id);
  }

  function handleSelectMonth(ym: string) {
    haptic('tickWeak');
    setMonthOverride(ym);
  }

  function handleAmountChange(e: ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^0-9]/g, '');
    setAmountDisplay(digits === '' ? '' : formatNumber(Number(digits)));
    if (amountError) setAmountError(false);
  }

  function handleAddRecord() {
    haptic('tickWeak');
    navigate('/record/new', {
      state: { workplaceId: workplaceId ?? '', date: `${yearMonth}-01` } satisfies RouteState['/record/new'],
    });
  }

  function handleAddWorkplace() {
    haptic('tickWeak');
    navigate('/workplace');
  }

  function handleAnalyze() {
    // 하단 고정 CTA(SubmitFooter)가 자동으로 쏘던 햅틱을 여기서 직접 쏜다 —
    // '/check'는 탭 루트라 고정 CTA를 쓰면 FloatingTabBar와 겹친다(본문 내 전체폭 버튼으로 대체).
    haptic('success');
    const amount = parseAmount(amountDisplay);
    if (Number.isNaN(amount) || amount < 0 || amount > MAX_AMOUNT) {
      setAmountError(true);
      return;
    }
    setAmountError(false);
    if (!workplaceId) return;
    navigate('/check/result', {
      state: { workplaceId, yearMonth, actualPaidAmount: amount } satisfies RouteState['/check/result'],
    });
  }

  if (loading) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>미지급 분석</Top.TitleParagraph>} />}>
        <LoadingState rows={1} testId="check-summary-skeleton" />
        <Spacing size={16} />
        <LoadingState rows={1} testId="check-amount-skeleton" />
      </ScreenScaffold>
    );
  }

  if (workplaces.length === 0) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>미지급 분석</Top.TitleParagraph>} />}>
        <EmptyState
          icon={<Asset.ContentIcon name="iconStarRegular" alt="근무지" />}
          title="등록된 근무지가 없어요"
          description="근무지를 추가하면 미지급 분석을 할 수 있어요"
          action={
            <Button variant="weak" display="block" onClick={handleAddWorkplace}>
              근무지 추가하기
            </Button>
          }
          testId="check-empty-workplace"
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>미지급 분석</Top.TitleParagraph>} />}>
      <Paragraph.Text typography="st6">근무지</Paragraph.Text>
      <Spacing size={8} />
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {workplaces.map((w) => (
          <ChipButton
            key={w.id}
            testId={`check-workplace-chip-${w.id}`}
            selected={w.id === workplaceId}
            onClick={() => handleSelectWorkplace(w.id)}
          >
            {w.name}
          </ChipButton>
        ))}
      </div>

      <Spacing size={12} />

      <Paragraph.Text typography="st6">정산 월</Paragraph.Text>
      <Spacing size={8} />
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {months.map((ym) => (
          <ChipButton
            key={ym}
            testId={`check-month-chip-${ym}`}
            selected={ym === yearMonth}
            onClick={() => handleSelectMonth(ym)}
          >
            {formatMonthLabel(ym)}
          </ChipButton>
        ))}
      </div>

      <Spacing size={16} />

      {payroll && hasRecords ? (
        <Card testId="check-summary-card">
          <Paragraph.Text typography="st6">{`${formatMonthLabel(yearMonth)} 계산 실수령액`}</Paragraph.Text>
          <Spacing size={4} />
          <Amount value={payroll.net} unit="원" typography="t3" testId="check-summary-amount" />
          <Spacing size={4} />
          <Paragraph.Text typography="st12">{`근무 ${hours}시간`}</Paragraph.Text>
        </Card>
      ) : (
        <EmptyState
          icon={<Asset.ContentIcon name="iconStarRegular" alt="기록" />}
          title="이번 달 기록이 없어 분석할 수 없어요"
          description="출퇴근 기록을 추가하면 실지급액과 비교해드려요"
          action={
            <Button variant="weak" display="block" onClick={handleAddRecord}>
              기록 추가하기
            </Button>
          }
          testId="check-empty-records"
        />
      )}

      <Spacing size={16} />

      <TextField
        variant="line"
        label="실제 받은 금액"
        placeholder="예: 2,064,000"
        inputMode="numeric"
        enterKeyHint="done"
        suffix="원"
        value={amountDisplay}
        onChange={handleAmountChange}
        hasError={amountError}
        help={amountError ? AMOUNT_ERROR : undefined}
        data-testid="check-amount-input"
      />

      <Spacing size={8} />

      <Paragraph.Text typography="st11">통장에 입금된 금액을 그대로 적어주세요</Paragraph.Text>

      <Spacing size={24} />

      <Button
        variant="fill"
        display="block"
        onClick={handleAnalyze}
        disabled={!workplaceId || !hasRecords}
      >
        분석하기
      </Button>

      <Spacing size={16} />

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
