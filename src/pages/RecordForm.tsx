import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertDialog, Button, ListRow, Paragraph, Spacing, Switch, TextField, Toast, Top } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SubmitFooter } from '@/components/BottomCTA';
import { Card } from '@/components/Card';
import { EmptyState, LoadingState } from '@/components/StateView';
import { useAppData } from '@/hooks/useAppData';
import { isDuplicateRecord, validateRecord } from '@/lib/repository';
import { calcDaily, parseHHmm } from '@/lib/payrollDaily';
import { formatNumber } from '@/lib/utils';
import type { RouteState } from '@/lib/types';

function fireHaptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

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
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isEdit = Boolean(id);

  const { loading, workplaces, records, addRecord, editRecord, removeRecord } = useAppData();
  const existing = isEdit ? records.find((r) => r.id === id) : undefined;
  const newState = location.state as RouteState['/record/new'];

  const [date, setDate] = useState(() => existing?.date ?? newState?.date ?? todayISODate());
  const [startTime, setStartTime] = useState(() => existing?.startTime ?? '');
  const [endTime, setEndTime] = useState(() => existing?.endTime ?? '');
  const [breakMinutes, setBreakMinutes] = useState(() => (existing ? String(existing.breakMinutes) : ''));
  const [breakTouched, setBreakTouched] = useState(() => Boolean(existing));
  const [isHoliday, setIsHoliday] = useState(() => existing?.isHoliday ?? false);
  const [memo, setMemo] = useState(() => existing?.memo ?? '');
  const [hydrated, setHydrated] = useState(() => Boolean(existing) || !isEdit);

  const [error, setError] = useState<string | null>(null);
  const [duplicateToastOpen, setDuplicateToastOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  // 수정 모드에서 최초 마운트 시 AppDataProvider가 아직 로딩 중이었다면(records=[])
  // 데이터 도착 후 한 번만 폼 필드를 채운다 — 그 뒤 사용자 입력을 덮어쓰지 않는다.
  useEffect(() => {
    if (hydrated || !existing) return;
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
          title="기록을 찾을 수 없어요"
          action={
            <Button variant="weak" onClick={() => navigate(-1)}>
              돌아가기
            </Button>
          }
        />
      </ScreenScaffold>
    );
  }

  const workplaceId = existing?.workplaceId ?? newState?.workplaceId ?? workplaces[0]?.id ?? '';
  const workplace = workplaces.find((w) => w.id === workplaceId);
  const breakMinutesNumber = Number(breakMinutes) || 0;
  const daily = workplace
    ? calcDaily(
        { startTime, endTime, breakMinutes: breakMinutesNumber },
        { wage: workplace.hourlyWage, isFiveOrMore: workplace.isFiveOrMore }
      )
    : null;
  const overnight = crossesMidnight(startTime, endTime);

  async function handleSave() {
    setError(null);
    const input = {
      workplaceId,
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

    const duplicate = await isDuplicateRecord({
      id: isEdit ? id : undefined,
      workplaceId,
      date,
      startTime,
    });
    if (duplicate) {
      setDuplicateToastOpen(true);
      return;
    }

    if (isEdit && id) {
      await editRecord(id, input);
    } else {
      await addRecord(input);
    }
    navigate(-1);
  }

  function handleToggleHoliday() {
    fireHaptic('tickWeak');
    setIsHoliday((prev) => !prev);
  }

  async function handleConfirmDelete() {
    if (!id) return;
    await removeRecord(id);
    setDeleteDialogOpen(false);
    navigate(-1);
  }

  return (
    <ScreenScaffold
      top={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <Top title={<Top.TitleParagraph>{isEdit ? '기록 수정' : '근무 기록'}</Top.TitleParagraph>} />
          </div>
          {isEdit && (
            <Button variant="weak" size="small" color="danger" onClick={() => setDeleteDialogOpen(true)}>
              삭제
            </Button>
          )}
        </div>
      }
      bottom={<SubmitFooter label="저장하기" onClick={handleSave} />}
    >
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
      <TextField
        ref={startRef}
        variant="line"
        label="출근 시각"
        placeholder="09:00"
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
        placeholder="18:00"
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
        placeholder="30"
        inputMode="numeric"
        enterKeyHint="next"
        value={breakMinutes}
        onChange={(e) => {
          setBreakTouched(true);
          setBreakMinutes(e.target.value);
        }}
        data-testid="record-break-input"
      />
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
      <Spacing size={16} />
      <Card testId="record-preview">
        {daily ? (
          <>
            <Paragraph.Text typography="t5" data-testid="record-preview-worked">
              실근로 {formatWorkedDuration(daily.workedMinutes)}
            </Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="t3" data-testid="record-preview-pay">
              {formatNumber(daily.total)}원
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
    </ScreenScaffold>
  );
}
