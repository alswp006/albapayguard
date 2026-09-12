import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, ListRow, Paragraph, Spacing, Switch, TextField, Top } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SubmitFooter } from '@/components/BottomCTA';
import { LoadingState } from '@/components/StateView';
import { useAppData } from '@/hooks/useAppData';
import { useHaptic } from '@/hooks/useHaptic';
import { COLOR_TOKENS, type RouteState } from '@/lib/types';
import { validateWorkplaceFields } from '@/lib/repository';
import { colorLabel, colorVar } from '@/lib/workplaceColors';
import { ROUTES } from '@/routes';

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
  const [paydayError, setPaydayError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>근무지</Top.TitleParagraph>} />}>
        <LoadingState rows={5} />
      </ScreenScaffold>
    );
  }

  async function handleSave() {
    if (saving) return;

    const input = {
      name: name.trim(),
      hourlyWage: parseNumber(hourlyWage),
      isFiveOrMore,
      // 지급일은 빈 칸이면 0으로 읽혀 "1~31" 에러가 난다 — 빈 칸도 사용자에게 이유를 말해야 한다.
      payday: parseNumber(payday),
      taxType,
      colorToken,
    };

    const errors = validateWorkplaceFields(input);
    setNameError(errors.name ?? null);
    setWageError(errors.hourlyWage ?? null);
    setPaydayError(errors.payday ?? null);
    // 세금·색상은 고정 선택지라 UI상 위반이 불가능하다 — 그래도 뚫리면 하단에 한 줄로 알린다.
    setSaveError(errors.taxType ?? errors.colorToken ?? null);
    if (errors.name || errors.hourlyWage || errors.payday || errors.taxType || errors.colorToken) {
      return;
    }

    haptic('success');
    setSaving(true);
    const result = isEdit && id ? await editWorkplace(id, input) : await addWorkplace(input);
    if (!result.ok) {
      setSaving(false);
      setSaveError(
        result.reason === 'max_workplaces'
          ? '근무지는 최대 5개까지 등록할 수 있어요'
          : '저장하지 못했어요. 잠시 후 다시 시도해 주세요'
      );
      return;
    }

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
      top={
        // 이 경로에서는 하단 탭바가 숨겨진다(App.tsx) — 저장 말고 나갈 길을 헤더에 둔다.
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <Top title={<Top.TitleParagraph>{isEdit ? '근무지 수정' : '근무지 추가'}</Top.TitleParagraph>} />
          </div>
          <Button
            variant="weak"
            size="small"
            onClick={() => {
              haptic('tickWeak');
              navigate(fromOnboarding ? ROUTES.home : ROUTES.workplace);
            }}
          >
            취소
          </Button>
        </div>
      }
      bottom={<SubmitFooter label="저장" onClick={handleSave} loading={saving} />}
    >
      <TextField
        variant="line"
        label="근무지 이름"
        // 빈 칸에서는 플로팅 라벨이 숨으므로 placeholder가 필드 이름까지 말해야 한다.
        placeholder="근무지 이름 (예: 편의점 알바)"
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
        placeholder="시급 (예: 10,320)"
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
        placeholder="급여 지급일 (예: 10)"
        inputMode="numeric"
        enterKeyHint="done"
        suffix="일"
        value={payday}
        onChange={(e) => {
          setPayday(e.target.value.replace(/[^0-9]/g, ''));
          if (paydayError) setPaydayError(null);
        }}
        hasError={Boolean(paydayError)}
        help={paydayError ?? undefined}
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
              aria-label={colorLabel(token)}
              aria-pressed={selected}
              onClick={() => {
                haptic('tickWeak');
                setColorToken(token);
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                backgroundColor: colorVar(token),
                border: selected ? '3px solid var(--adaptiveGrey900)' : '3px solid transparent',
              }}
            />
          );
        })}
      </div>

      {saveError && (
        <>
          <Spacing size={16} />
          <div role="alert">
            <Paragraph.Text typography="st12" color="var(--adaptiveRed500)">
              {saveError}
            </Paragraph.Text>
          </div>
        </>
      )}

      <Spacing size={96} />
    </ScreenScaffold>
  );
}
