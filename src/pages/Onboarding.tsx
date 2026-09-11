import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, Asset } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SubmitFooter } from '@/components/BottomCTA';
import { useAppData } from '@/hooks/useAppData';
import { useHaptic } from '@/hooks/useHaptic';
import type { RouteState } from '@/lib/types';

interface Step {
  title: string;
  description: string;
}

// SPEC F8 AC-1: 3단계 안내 문구 그대로
const STEPS: Step[] = [
  { title: '출퇴근만 기록하세요', description: '출근·퇴근 시각만 입력하면 나머지는 앱이 계산해요' },
  { title: '주휴수당까지 자동 계산', description: '야간·연장·휴일 가산수당과 주휴수당까지 근로기준법 기준으로 계산해요' },
  { title: '미지급 여부까지 확인', description: '실제 받은 금액과 비교해 미지급 의심 항목을 알려드려요' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { haptic } = useHaptic();
  const { patchSettings } = useAppData();
  const [step, setStep] = useState(0);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  function handlePrimary() {
    if (!isLast) {
      haptic('tickWeak');
      setStep((s) => s + 1);
      return;
    }

    haptic('success');
    void patchSettings({ onboardingSeenAt: new Date().toISOString() });
    navigate('/workplace/new', {
      replace: true,
      state: { from: 'onboarding' } satisfies RouteState['/workplace/new'],
    });
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>{current.title}</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label={isLast ? '시작하기' : '다음'} onClick={handlePrimary} />}
    >
      <div data-testid="onboarding-step">
        <Asset.ContentIcon name="iconStarRegular" alt={current.title} />
        <Spacing size={16} />
        <Paragraph.Text typography="t3">{current.title}</Paragraph.Text>
        <Spacing size={8} />
        <Paragraph.Text typography="t6">{current.description}</Paragraph.Text>
      </div>

      <Spacing size={24} />

      {/* 단계 인디케이터 — 표시 전용, 탭 불가 */}
      <div style={{ display: 'flex', gap: 8 }}>
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            aria-hidden="true"
            style={{
              height: 6,
              flex: 1,
              borderRadius: 999,
              backgroundColor: i <= step ? 'var(--adaptiveBlue500)' : 'var(--adaptiveGrey200)',
            }}
          />
        ))}
      </div>

      <Spacing size={96} />
    </ScreenScaffold>
  );
}
