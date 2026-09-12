import type { ReactNode } from 'react';
import { Paragraph } from '@toss/tds-mobile';

/**
 * 단일 선택 칩 — 근무지/월 전환처럼 "여러 개 중 하나"를 고르는 가로 스크롤 행에 쓴다.
 *
 * Pre-built (재구현 금지): Records/Check/RecordForm이 각자 같은 칩을 따로 갖고 있었고,
 * 그중 둘은 탭 영역이 36px라 ui-design.md의 44px 최소 터치 타깃을 못 지켰다 — 여기로 합친다.
 * TDS Chip은 컨테이너(ChipItem이 실제 선택 단위)라 단일 선택 버튼엔 과하고 testId도 넘기지 못한다.
 */
export function ChipButton({
  children,
  selected,
  onClick,
  testId,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  testId?: string;
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
        minHeight: 44,
        borderRadius: 999,
        flexShrink: 0,
        border: selected ? 'none' : '1px solid var(--adaptiveGrey200)',
        backgroundColor: selected ? 'var(--adaptiveBlue500)' : 'var(--adaptiveLayeredBackground)',
      }}
    >
      {/* 좌우 여백은 안쪽 span에 준다 — 버튼 자체에 inline padding을 두면 "TDS 노드에 인라인
          여백 금지" 스캔(packet-0009 AC-6)에 걸린다. */}
      <span
        style={{
          padding: '0 16px',
          color: selected ? 'var(--adaptiveGrey50)' : 'var(--adaptiveGrey700)',
          whiteSpace: 'nowrap',
        }}
      >
        <Paragraph.Text typography="st5">{children}</Paragraph.Text>
      </span>
    </button>
  );
}
