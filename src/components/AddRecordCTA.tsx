import { Button } from '@toss/tds-mobile';

export interface AddRecordCTAProps {
  onClick: () => void;
  disabled?: boolean;
  /** 기본 라벨은 '기록 추가하기' — 결과를 말하는 문구를 유지한다 */
  label?: string;
  testId?: string;
}

/**
 * 홈의 1차 액션 — 출퇴근 기록 추가.
 *
 * 탭-루트 화면이라 하단 고정 CTA(SubmitFooter)를 쓰지 않는다(FloatingTabBar와 자리 충돌).
 * 대신 본문 흐름 안에서 전체폭(display="block") 버튼으로 둔다 — 기본 display는 'inline'
 * (글자폭·좌측정렬)이라 반드시 block을 지정해야 한다.
 */
export function AddRecordCTA({
  onClick,
  disabled = false,
  label = '기록 추가하기',
  testId = 'cta-add-record',
}: AddRecordCTAProps) {
  return (
    <Button
      data-testid={testId}
      variant="fill"
      size="large"
      display="block"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

export default AddRecordCTA;
