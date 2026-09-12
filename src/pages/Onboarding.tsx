import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SafeIcon } from '@/components/SafeIcon';
import { SubmitFooter } from '@/components/BottomCTA';
import { useAppData } from '@/hooks/useAppData';
import { useHaptic } from '@/hooks/useHaptic';
import type { RouteState } from '@/lib/types';
import { ROUTES } from '@/routes';

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

  function handleStart() {
    haptic('success');
    void patchSettings({ onboardingSeenAt: new Date().toISOString() });
    navigate(ROUTES.workplaceNew, {
      replace: true,
      state: { from: 'onboarding' } satisfies RouteState['/workplace/new'],
    });
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>알바페이가드</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="시작하기" onClick={handleStart} />}
    >
      <div data-testid="onboarding-step">
        {STEPS.map((s, i) => (
          <div key={s.title}>
            {/* 바로 아래 제목이 이미 같은 내용을 전달한다 — 아이콘은 순수 장식이라 alt를 비운다.
                아이콘 로드가 실패해도(불안정한 네트워크) SafeIcon이 조용히 숨겨 겹친 alt 텍스트가 뜨지 않는다. */}
            <SafeIcon name="iconStarRegular" alt="" />
            <Spacing size={12} />
            <Paragraph.Text typography="t3">{s.title}</Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="t6">{s.description}</Paragraph.Text>
            {i < STEPS.length - 1 ? <Spacing size={32} /> : null}
          </div>
        ))}

        <Spacing size={24} />

        {/* 단계 인디케이터 — 표시 전용, 탭 불가 */}
        <div style={{ display: 'flex', gap: 8 }}>
          {STEPS.map((s) => (
            <div
              key={s.title}
              aria-hidden="true"
              style={{
                height: 6,
                flex: 1,
                borderRadius: 999,
                backgroundColor: 'var(--adaptiveBlue500)',
              }}
            />
          ))}
        </div>
      </div>

      <Spacing size={96} />
    </ScreenScaffold>
  );
}
