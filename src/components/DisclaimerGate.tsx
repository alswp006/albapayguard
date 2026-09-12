import { AlertDialog } from '@toss/tds-mobile';
import { useAppData } from '@/hooks/useAppData';

const DISCLAIMER_TEXT = '본 계산 결과는 근로기준법 기준 참고용이며 법적 효력이 없습니다';

/**
 * F8 AC-3: 사용자가 처음으로 급여 계산 결과(`/breakdown`, `/check/result`)를 여는
 * 순간에만 법적 고지를 1회 표시한다. `disclaimerAckAt`이 저장된 뒤로는 다시 뜨지 않는다.
 */
export function DisclaimerGate() {
  const { settings, patchSettings } = useAppData();
  const open = !settings.disclaimerAckAt;

  function acknowledge() {
    void patchSettings({ disclaimerAckAt: new Date().toISOString() });
  }

  return (
    <AlertDialog
      open={open}
      title="계산 결과 안내"
      description={DISCLAIMER_TEXT}
      alertButton={<AlertDialog.AlertButton onClick={acknowledge}>확인</AlertDialog.AlertButton>}
      onClose={acknowledge}
    />
  );
}

export default DisclaimerGate;
