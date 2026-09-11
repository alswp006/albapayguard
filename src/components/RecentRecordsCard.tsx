import { Paragraph, Spacing, ListRow, Badge } from '@toss/tds-mobile';
import { Card } from './Card';
import { Amount } from './Amount';
import { calcDaily } from '@/lib/payrollDaily';
import type { WorkRecord, Workplace } from '@/lib/types';

export const RECENT_RECORDS_LIMIT = 5;

/**
 * 활성 근무지의 최근 기록 N건을 최신순으로 뽑는다.
 *
 * 저장소에서 온 배열은 순서를 보장하지 않으므로 날짜 → 생성시각 순으로 정렬한다.
 * 손상 데이터(날짜/생성시각 누락)에도 throw하지 않도록 빈 문자열로 정규화한다.
 */
export function pickRecentRecords(
  records: WorkRecord[],
  workplaceId: string | null,
  limit: number = RECENT_RECORDS_LIMIT
): WorkRecord[] {
  if (!Array.isArray(records) || !workplaceId) return [];
  return records
    .filter((r) => r?.workplaceId === workplaceId)
    .slice()
    .sort(
      (a, b) =>
        (b.date ?? '').localeCompare(a.date ?? '') ||
        (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    )
    .slice(0, limit);
}

/** "2026-01-05" → "1월 5일" */
function formatDateLabel(date: string): string {
  const [, m, d] = (date ?? '').split('-');
  if (!m || !d) return date ?? '';
  return `${Number(m)}월 ${Number(d)}일`;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0시간';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

export interface RecentRecordsCardProps {
  /** 전체 기록 — 활성 근무지 필터·정렬은 내부에서 처리 */
  records: WorkRecord[];
  /** 일급 계산용 활성 근무지. null이면 금액 없이 시간만 표시 */
  workplace: Workplace | null;
  limit?: number;
  /** 행 탭 → 기록 수정 화면 */
  onSelect: (recordId: string) => void;
  testId?: string;
}

/**
 * 홈 하단 '최근 기록' 카드 — 활성 근무지의 최근 N건(기본 5건).
 *
 * 기록이 없으면 아무것도 그리지 않는다(빈 상태 문구는 화면이 한 번만 노출).
 */
export function RecentRecordsCard({
  records,
  workplace,
  limit = RECENT_RECORDS_LIMIT,
  onSelect,
  testId = 'recent-records-card',
}: RecentRecordsCardProps) {
  const recent = pickRecentRecords(records, workplace?.id ?? null, limit);
  if (recent.length === 0) return null;

  return (
    <>
      <Paragraph.Text typography="t4">최근 기록</Paragraph.Text>
      <Spacing size={12} />
      <Card testId={testId}>
        {recent.map((r) => {
          const daily = workplace
            ? calcDaily(
                { startTime: r.startTime, endTime: r.endTime, breakMinutes: r.breakMinutes },
                { wage: workplace.hourlyWage, isFiveOrMore: workplace.isFiveOrMore }
              )
            : null;
          const tag = r.isHoliday ? '휴일' : (daily?.nightMinutes ?? 0) > 0 ? '야간' : '평일';
          return (
            <ListRow
              key={r.id}
              data-testid={`recent-record-${r.id}`}
              onClick={() => onSelect(r.id)}
              contents={
                <ListRow.Texts
                  type="2RowTypeA"
                  top={formatDateLabel(r.date)}
                  bottom={`${r.startTime}–${r.endTime} · ${formatDuration(daily?.workedMinutes ?? 0)}`}
                />
              }
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {/* 평일은 굳이 배지로 말하지 않는다 — 휴일·야간처럼 수당이 달라지는 날만 표시 */}
                  {tag === '평일' ? null : (
                    <Badge size="small" variant="weak" color={tag === '휴일' ? 'red' : 'blue'}>
                      {tag}
                    </Badge>
                  )}
                  <Amount value={daily?.total ?? 0} unit="원" typography="st5" />
                </div>
              }
            />
          );
        })}
      </Card>
    </>
  );
}

export default RecentRecordsCard;
