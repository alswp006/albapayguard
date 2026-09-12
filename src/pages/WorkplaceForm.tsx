import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ListRow, Paragraph, Spacing, Switch, TextField, Top } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SubmitFooter } from '@/components/BottomCTA';
import { LoadingState } from '@/components/StateView';
import { useAppData } from '@/hooks/useAppData';
import { useHaptic } from '@/hooks/useHaptic';
import { COLOR_TOKENS, type RouteState } from '@/lib/types';
import { ROUTES } from '@/routes';

const COLOR_LABELS: Record<string, string> = {
  blue: '블루',
  green: '그린',
  purple: '퍼플',
  orange: '오렌지',
};

const COLOR_HEX: Record<string, string> = {
  blue: 'var(--adaptiveBlue500)',
  green: 'var(--adaptiveGreen500)',
  purple: 'var(--adaptivePurple500)',
  orange: 'var(--adaptiveOrange500)',
};

function parseNumber(display: string): number {
  const digits = display.replace(/[^0-9]/g, '');
  return digits === '' ? 0 : Number(digits);
}

export default function WorkplaceForm() {
  const navigate = useNavigate();
  const { haptic } = useHaptic();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isEdit = Boolean(id);

  const { loading, workplaces, addWorkplace, editWorkplace } = useAppData();
  const existing = isEdit ? workplaces.find((w) => w.id === id) : undefined;
  const newState = location.state as RouteState['/workplace/new'];
  const fromOnboarding = newState?.from === 'onboarding';

  const [name, setName] = useState(() => existing?.name ?? '');
  const [hourlyWage, setHourlyWage] = useState(() => (existing ? String(existing.hourlyWage) : ''));
  const [isFiveOrMore, setIsFiveOrMore] = useState(() => existing?.isFiveOrMore ?? false);
  const [payday, setPayday] = useState(() => (existing ? String(existing.payday) : '25'));
  const [taxType, setTaxType] = useState<'none' | 'freelance3_3'>(() => existing?.taxType ?? 'none');
  const [colorToken, setColorToken] = useState(() => existing?.colorToken ?? COLOR_TOKENS[0]);

  const [nameError, setNameError] = useState<string | null>(null);
  const [wageError, setWageError] = useState<string | null>(null);

  if (loading) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>근무지</Top.TitleParagraph>} />}>
        <LoadingState rows={5} />
      </ScreenScaffold>
    );
  }

  async function handleSave() {
    const trimmedName = name.trim();
    const wageNumber = parseNumber(hourlyWage);

    const nextNameError = trimmedName === '' ? '근무지 이름을 입력해주세요' : null;
    const nextWageError = wageNumber <= 0 ? '시급을 1원 이상 입력해주세요' : null;
    setNameError(nextNameError);
    setWageError(nextWageError);
    if (nextNameError || nextWageError) return;

    haptic('success');
    const paydayNumber = Math.min(31, Math.max(1, parseNumber(payday) || 25));
    const input = {
      name: trimmedName,
      hourlyWage: wageNumber,
      isFiveOrMore,
      payday: paydayNumber,
      taxType,
      colorToken,
    };

    const result = isEdit && id ? await editWorkplace(id, input) : await addWorkplace(input);
    if (!result.ok) return;

    if (fromOnboarding) {
      navigate(ROUTES.home, { replace: true });
      return;
    }
    navigate(ROUTES.workplace, {
      replace: true,
      state: { toast: '근무지가 저장되었어요' } satisfies RouteState['/workplace'],
    });
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>{isEdit ? '근무지 수정' : '근무지 추가'}</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="저장" onClick={handleSave} />}
    >
      <TextField
        variant="line"
        label="근무지 이름"
        placeholder="예: 편의점 알바"
        maxLength={20}
        enterKeyHint="next"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (nameError) setNameError(null);
        }}
        hasError={Boolean(nameError)}
        help={nameError ?? undefined}
        data-testid="workplace-name-input"
      />

      <Spacing size={12} />

      <TextField
        variant="line"
        label="시급"
        placeholder="예: 10,320"
        inputMode="numeric"
        enterKeyHint="next"
        suffix="원"
        value={hourlyWage}
        onChange={(e) => {
          setHourlyWage(e.target.value.replace(/[^0-9]/g, ''));
          if (wageError) setWageError(null);
        }}
        hasError={Boolean(wageError)}
        help={wageError ?? undefined}
        data-testid="workplace-wage-input"
      />

      <Spacing size={12} />

      <TextField
        variant="line"
        label="급여 지급일"
        placeholder="예: 10"
        inputMode="numeric"
        enterKeyHint="next"
        suffix="일"
        value={payday}
        onChange={(e) => setPayday(e.target.value.replace(/[^0-9]/g, ''))}
        data-testid="workplace-payday-input"
      />

      <Spacing size={16} />

      <ListRow
        contents={<ListRow.Texts type="1RowTypeA" top="5인 이상 사업장" />}
        right={
          <Switch
            checked={isFiveOrMore}
            onChange={() => {
              haptic('tickWeak');
              setIsFiveOrMore((prev) => !prev);
            }}
          />
        }
      />

      <Spacing size={8} />

      <ListRow
        contents={<ListRow.Texts type="1RowTypeA" top="사업소득세 3.3% 원천징수" />}
        right={
          <Switch
            checked={taxType === 'freelance3_3'}
            onChange={() => {
              haptic('tickWeak');
              setTaxType((prev) => (prev === 'freelance3_3' ? 'none' : 'freelance3_3'));
            }}
          />
        }
      />

      <Spacing size={16} />

      <Paragraph.Text typography="st6">색상</Paragraph.Text>
      <Spacing size={8} />
      <div style={{ display: 'flex', gap: 8 }}>
        {COLOR_TOKENS.map((token) => {
          const selected = token === colorToken;
          return (
            <button
              key={token}
              type="button"
              aria-label={COLOR_LABELS[token] ?? token}
              aria-pressed={selected}
              onClick={() => {
                haptic('tickWeak');
                setColorToken(token);
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                backgroundColor: COLOR_HEX[token] ?? 'var(--adaptiveGrey400)',
                border: selected ? '3px solid var(--adaptiveGrey900)' : '3px solid transparent',
              }}
            />
          );
        })}
      </div>

      <Spacing size={96} />
    </ScreenScaffold>
  );
}
