import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertDialog,
  Asset,
  Button,
  ListRow,
  Paragraph,
  Spacing,
  Switch,
  TextField,
  Toast,
  Top,
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationTextButton,
} from '@toss/tds-mobile';
import { Amount } from '@/components/Amount';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SubmitFooter } from '@/components/BottomCTA';
import { Card } from '@/components/Card';
import { ChipButton } from '@/components/ChipButton';
import { EmptyState, LoadingState } from '@/components/StateView';
import { useAppData } from '@/hooks/useAppData';
import { useHaptic } from '@/hooks/useHaptic';
import { isDuplicateRecord, validateRecord } from '@/lib/repository';
import { calcDaily, parseHHmm } from '@/lib/payrollDaily';
import { formatNumber } from '@/lib/utils';
import type { RouteState } from '@/lib/types';
import { ROUTES } from '@/routes';

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function spanMinutes(startTime: string, endTime: string): number | null {
  const start = parseHHmm(startTime);
  const end = parseHHmm(endTime);
  if (!start || !end) return null;
  const startTotal = start.hours * 60 + start.minutes;
  let endTotal = end.hours * 60 + end.minutes;
  if (endTotal <= startTotal) endTotal += 24 * 60;
  return endTotal - startTotal;
}

function suggestBreakMinutes(startTime: string, endTime: string): number {
  const span = spanMinutes(startTime, endTime);
  if (span === null) return 0;
  if (span >= 8 * 60) return 60;
  if (span >= 4 * 60) return 30;
  return 0;
}

function crossesMidnight(startTime: string, endTime: string): boolean {
  const start = parseHHmm(startTime);
  const end = parseHHmm(endTime);
  if (!start || !end) return false;
  return end.hours * 60 + end.minutes <= start.hours * 60 + start.minutes;
}

function formatWorkedDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

export default function RecordForm() {
  const navigate = useNavigate();
  const { haptic } = useHaptic();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isEdit = Boolean(id);

  const { loading, workplaces, records, addRecord, editRecord, removeRecord } = useAppData();
  const existing = isEdit ? records.find((r) => r.id === id) : undefined;
  const newState = location.state as RouteState['/record/new'];

  // 근무지는 시급·5인 이상 여부를 통해 예상 일급에 직접 들어간다 — 수정 화면에서 무엇으로
  // 계산 중인지 보이지 않으면 사용자는 금액이 왜 그런지 알 수 없다. 빈 값으로 시작해
  // (저장소 로딩 전에는 workplaces가 비어 있다) 아래 effect에서 확정한다.
  const [workplaceId, setWorkplaceId] = useState(() => existing?.workplaceId ?? newState?.workplaceId ?? '');
  const [date, setDate] = useState(() => existing?.date ?? newState?.date ?? todayISODate());
  const [startTime, setStartTime] = useState(() => existing?.startTime ?? '');
  const [endTime, setEndTime] = useState(() => existing?.endTime ?? '');
  const [breakMinutes, setBreakMinutes] = useState(() => (existing ? String(existing.breakMinutes) : ''));
  const [breakTouched, setBreakTouched] = useState(() => Boolean(existing));
  const [isHoliday, setIsHoliday] = useState(() => existing?.isHoliday ?? false);
  const [memo, setMemo] = useState(() => existing?.memo ?? '');
  const [hydrated, setHydrated] = useState(() => Boolean(existing) || !isEdit);

  const [error, setError] = useState<string | null>(null);
  // 제출 중 표시 — 성공 시에는 화면이 떠나므로 풀지 않지만, 검증·중복·저장 실패 경로에서는
  // 반드시 false로 되돌린다("한 번 누르면 영구 비활성"이 완주를 막는 가장 흔한 버그).
  const [submitting, setSubmitting] = useState(false);
  const [duplicateToastOpen, setDuplicateToastOpen] = useState(false);
  const [quotaToastOpen, setQuotaToastOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  // 수정 모드에서 최초 마운트 시 AppDataProvider가 아직 로딩 중이었다면(records=[])
  // 데이터 도착 후 한 번만 폼 필드를 채운다 — 그 뒤 사용자 입력을 덮어쓰지 않는다.
  // 근무지 확정 — 기록의 근무지 > 신규 진입 state > 첫 근무지 순. 사용자가 한 번이라도
  // 고르면(workplaceId가 비지 않음) 다시 덮어쓰지 않는다.
  const defaultWorkplaceId = existing?.workplaceId ?? newState?.workplaceId ?? workplaces[0]?.id ?? '';
  useEffect(() => {
    if (workplaceId || !defaultWorkplaceId) return;
    setWorkplaceId(defaultWorkplaceId);
  }, [workplaceId, defaultWorkplaceId]);

  useEffect(() => {
    if (hydrated || !existing) return;
    setWorkplaceId(existing.workplaceId);
    setDate(existing.date);
    setStartTime(existing.startTime);
    setEndTime(existing.endTime);
    setBreakMinutes(String(existing.breakMinutes));
    setBreakTouched(true);
    setIsHoliday(existing.isHoliday);
    setMemo(existing.memo);
    setHydrated(true);
  }, [existing, hydrated]);

  useEffect(() => {
    if (breakTouched) return;
    if (!parseHHmm(startTime) || !parseHHmm(endTime)) return;
    setBreakMinutes(String(suggestBreakMinutes(startTime, endTime)));
  }, [startTime, endTime, breakTouched]);

  if (loading) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>{isEdit ? '기록 수정' : '근무 기록'}</Top.TitleParagraph>} />}>
        <LoadingState rows={4} />
      </ScreenScaffold>
    );
  }

  if (isEdit && !existing) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>기록 수정</Top.TitleParagraph>} />}>
        <EmptyState
          icon={<Asset.ContentIcon name="iconStarRegular" alt="기록" />}
          title="기록을 찾을 수 없어요"
          description="이미 삭제했거나 주소가 잘못됐어요"
          testId="record-not-found"
          action={
            <Button variant="weak" onClick={() => navigate(ROUTES.records)}>
              돌아가기
            </Button>
          }
        />
      </ScreenScaffold>
    );
  }

  // 확정 effect가 돌기 전 첫 렌더에서도 계산·저장이 기본 근무지로 동작하도록 즉시 보정한다.
  const selectedWorkplaceId = workplaceId || defaultWorkplaceId;
  const workplace = workplaces.find((w) => w.id === selectedWorkplaceId);
  const breakMinutesNumber = Number(breakMinutes) || 0;
  const daily = workplace
    ? calcDaily(
        { startTime, endTime, breakMinutes: breakMinutesNumber },
        { wage: workplace.hourlyWage, isFiveOrMore: workplace.isFiveOrMore }
      )
    : null;
  const overnight = crossesMidnight(startTime, endTime);

  async function handleSave() {
    if (submitting) return;
    setError(null);
    const input = {
      workplaceId: selectedWorkplaceId,
      date,
      startTime,
      endTime,
      breakMinutes: breakMinutesNumber,
      isHoliday,
      memo,
    };

    const validationError = validateRecord(input);
    if (validationError) {
      setError(validationError);
      if (!parseHHmm(startTime)) startRef.current?.focus();
      else if (!parseHHmm(endTime)) endRef.current?.focus();
      return;
    }

    setSubmitting(true);

    const duplicate = await isDuplicateRecord({
      id: isEdit ? id : undefined,
      workplaceId: selectedWorkplaceId,
      date,
      startTime,
    });
    if (duplicate) {
      setDuplicateToastOpen(true);
      setSubmitting(false);
      return;
    }

    try {
      const result = isEdit && id ? await editRecord(id, input) : await addRecord(input);
      if (!result.ok) {
        setQuotaToastOpen(true);
        setSubmitting(false);
        return;
      }
    } catch {
      // localStorage 쓰기 실패(QuotaExceededError 등) — 입력값은 그대로 두고 재시도 가능하게 남긴다.
      setQuotaToastOpen(true);
      setSubmitting(false);
      return;
    }

    haptic('success');
    navigate(ROUTES.records, { state: { toast: '저장했어요' } satisfies RouteState['/records'] });
  }

  // 뒤로가기는 항상 기록 목록으로 — history를 -1로 되감으면 주소로 바로 들어온 경우(딥링크,
  // 새로고침) 앱 밖으로 나가버린다. 목록은 탭바가 있는 화면이라 어디로든 다시 갈 수 있다.
  function handleBack() {
    navigate(ROUTES.records);
  }

  function handleSelectWorkplace(nextId: string) {
    haptic('tickWeak');
    setWorkplaceId(nextId);
  }

  function handleToggleHoliday() {
    haptic('tickWeak');
    setIsHoliday((prev) => !prev);
  }

  async function handleConfirmDelete() {
    if (!id) return;
    setDeleteDialogOpen(false);
    try {
      const result = await removeRecord(id);
      if (result && result.ok === false) {
        setQuotaToastOpen(true);
        return;
      }
    } catch {
      // 삭제도 localStorage 쓰기다 — 실패하면 기록을 남겨둔 채 알리고, 이동하지 않는다.
      setQuotaToastOpen(true);
      return;
    }
    navigate(ROUTES.records, { state: { toast: '삭제했어요' } satisfies RouteState['/records'] });
  }

  return (
    <ScreenScaffold
      top={
        <>
          {/* `/record/*`에서는 하단 탭바가 숨겨진다 — 뒤로가기가 없으면 저장·삭제 말고는 빠져나갈
              길이 없는 화면이 된다. TDS 내비 바(leading/trailing)로 나가는 길과 삭제를 함께 둔다. */}
          <TopNavigation
            leading={<TopNavigationBackButton aria-label="뒤로" onClick={handleBack} />}
            trailing={
              isEdit ? (
                <TopNavigationTextButton onClick={() => setDeleteDialogOpen(true)}>삭제</TopNavigationTextButton>
              ) : undefined
            }
          />
          <Top title={<Top.TitleParagraph>{isEdit ? '기록 수정' : '근무 기록'}</Top.TitleParagraph>} />
        </>
      }
      bottom={<SubmitFooter label="저장하기" onClick={handleSave} loading={submitting} />}
    >
      {/* 어느 근무지의 기록인지 먼저 보여준다 — 시급이 곧 아래 예상 일급의 근거다. */}
      <ListRow
        contents={
          <ListRow.Texts
            type="2RowTypeA"
            top="근무지"
            bottom={
              workplace
                ? `${workplace.name} · 시급 ${formatNumber(workplace.hourlyWage)}원`
                : '등록된 근무지가 없어요'
            }
          />
        }
      />
      {workplaces.length > 1 && (
        <>
          <Spacing size={8} />
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }} data-testid="record-workplace-chips">
            {workplaces.map((w) => (
              <ChipButton
                key={w.id}
                testId={`record-workplace-chip-${w.id}`}
                selected={w.id === selectedWorkplaceId}
                onClick={() => handleSelectWorkplace(w.id)}
              >
                {w.name}
              </ChipButton>
            ))}
          </div>
        </>
      )}
      {workplaces.length === 0 && (
        <>
          <Spacing size={8} />
          <Button variant="weak" display="block" onClick={() => navigate(ROUTES.workplaceNew)}>
            근무지 등록하기
          </Button>
        </>
      )}
      <Spacing size={12} />
      <TextField
        variant="line"
        label="날짜"
        placeholder="2026-03-02"
        inputMode="numeric"
        enterKeyHint="next"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <Spacing size={12} />
      {/* 빈 칸에서는 플로팅 라벨이 위로 떠 숨는다(line variant) — placeholder만 읽고도
          무엇을 넣는 칸인지 알 수 있게 항목 이름을 넣는다. 신규 기록 화면이 특히 그렇다. */}
      <TextField
        ref={startRef}
        variant="line"
        label="출근 시각"
        placeholder="출근 09:00"
        inputMode="numeric"
        enterKeyHint="next"
        hasError={Boolean(error)}
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
        data-testid="record-start-input"
      />
      <Spacing size={12} />
      <TextField
        ref={endRef}
        variant="line"
        label="퇴근 시각"
        placeholder="퇴근 18:00"
        inputMode="numeric"
        enterKeyHint="next"
        hasError={Boolean(error)}
        value={endTime}
        onChange={(e) => setEndTime(e.target.value)}
        data-testid="record-end-input"
      />
      {error && (
        <>
          <Spacing size={4} />
          <Paragraph.Text role="alert" typography="st13">
            {error}
          </Paragraph.Text>
        </>
      )}
      <Spacing size={12} />
      <TextField
        variant="line"
        label="휴게시간(분)"
        placeholder="휴게 30"
        inputMode="numeric"
        enterKeyHint="next"
        value={breakMinutes}
        onChange={(e) => {
          setBreakTouched(true);
          setBreakMinutes(e.target.value);
        }}
        data-testid="record-break-input"
      />
      {/* 예상 일급은 시각·휴게시간을 고친 직후 바로 눈에 들어와야 한다 — 폼 맨 아래에 두면
          하단 고정 CTA에 가려 스크롤해야만 보인다. */}
      <Spacing size={16} />
      <Card testId="record-preview">
        {daily ? (
          <>
            {/* 숫자만 있으면 그게 무슨 금액인지 알 수 없다 — 라벨을 붙이고 금액을 앵커로 키운다. */}
            <Paragraph.Text typography="st13">예상 일급</Paragraph.Text>
            <Spacing size={2} />
            <Amount value={daily.total} typography="t2" testId="record-preview-pay" />
            <Spacing size={4} />
            <Paragraph.Text typography="t6" data-testid="record-preview-worked">
              실근로 {formatWorkedDuration(daily.workedMinutes)}
            </Paragraph.Text>
            {overnight && (
              <>
                <Spacing size={4} />
                <Paragraph.Text typography="st13">익일 퇴근으로 계산했어요</Paragraph.Text>
              </>
            )}
          </>
        ) : (
          <Paragraph.Text typography="t6">출근·퇴근 시각을 입력하면 예상 일급을 보여드려요</Paragraph.Text>
        )}
      </Card>
      <Spacing size={16} />
      <ListRow
        contents={<ListRow.Texts type="1RowTypeA" top="휴일 근무" />}
        right={<Switch checked={isHoliday} onChange={handleToggleHoliday} />}
      />
      <Spacing size={12} />
      <TextField
        variant="line"
        label="메모"
        placeholder="예: 마감 청소 추가"
        maxLength={50}
        enterKeyHint="done"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        data-testid="record-memo-input"
      />
      {/* FixedBottomCTA는 position:fixed라 ScreenScaffold 본문이 그만큼 하단 패딩을 갖지 않는다 —
          여백 없인 마지막 줄이 버튼 뒤에 가려진다. */}
      <Spacing size={96} />

      {isEdit && (
        <AlertDialog
          open={deleteDialogOpen}
          title="기록을 삭제할까요"
          description="삭제하면 되돌릴 수 없어요"
          alertButton={<AlertDialog.AlertButton onClick={handleConfirmDelete}>삭제하기</AlertDialog.AlertButton>}
          onClose={() => setDeleteDialogOpen(false)}
        />
      )}

      <Toast
        open={duplicateToastOpen}
        position="bottom"
        text="같은 시간에 저장된 기록이 있어요"
        duration={3000}
        onClose={() => setDuplicateToastOpen(false)}
      />

      <Toast
        open={quotaToastOpen}
        position="bottom"
        text="저장 공간이 부족합니다. 오래된 기록을 삭제해주세요"
        duration={3000}
        onClose={() => setQuotaToastOpen(false)}
      />
    </ScreenScaffold>
  );
}
