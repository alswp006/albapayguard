import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Top, ListRow, Badge, Paragraph, Spacing, Button, AlertDialog, Toast, Asset } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { EmptyState, LoadingState } from '@/components/StateView';
import { Amount } from '@/components/Amount';
import { useAppData } from '@/hooks/useAppData';
import { useHaptic } from '@/hooks/useHaptic';
import { MAX_WORKPLACES, type RouteState } from '@/lib/types';

export default function Workplace() {
  const navigate = useNavigate();
  const location = useLocation();
  const { haptic } = useHaptic();
  const { loading, workplaces, records, payChecks, removeWorkplace } = useAppData();

  const incomingToast = (location.state as RouteState['/workplace'])?.toast;
  const [savedToastOpen, setSavedToastOpen] = useState(Boolean(incomingToast));
  const [limitToastOpen, setLimitToastOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (incomingToast) setSavedToastOpen(true);
  }, [incomingToast]);

  if (loading) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>근무지</Top.TitleParagraph>} />}>
        <LoadingState rows={2} />
      </ScreenScaffold>
    );
  }

  function handleAdd() {
    if (workplaces.length >= MAX_WORKPLACES) {
      haptic('tickWeak');
      setLimitToastOpen(true);
      return;
    }
    haptic('tickWeak');
    navigate('/workplace/new');
  }

  function handleRowClick(id: string) {
    haptic('tickWeak');
    navigate(`/workplace/${id}`);
  }

  const deleteTarget = workplaces.find((w) => w.id === deleteTargetId);
  const linkedRecordCount = deleteTarget
    ? records.filter((r) => r.workplaceId === deleteTarget.id).length
    : 0;
  const linkedPayCheckCount = deleteTarget
    ? payChecks.filter((p) => p.workplaceId === deleteTarget.id).length
    : 0;

  async function handleConfirmDelete() {
    if (!deleteTargetId) return;
    await removeWorkplace(deleteTargetId);
    setDeleteTargetId(null);
  }

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>근무지</Top.TitleParagraph>} />}>
      {workplaces.length === 0 ? (
        <EmptyState
          icon={<Asset.ContentIcon name="iconStarRegular" alt="근무지" />}
          title="등록된 근무지가 없어요"
          action={
            <Button variant="fill" display="block" onClick={handleAdd}>
              근무지 추가하기
            </Button>
          }
          testId="workplace-empty"
        />
      ) : (
        <>
          {workplaces.map((w) => (
            <div key={w.id}>
              <ListRow
                data-testid="workplace-row"
                onClick={() => handleRowClick(w.id)}
                contents={
                  <ListRow.Texts
                    type="2RowTypeA"
                    top={
                      <>
                        {w.name}
                        {w.isFiveOrMore && (
                          <>
                            {' '}
                            <Badge size="small" variant="weak" color="blue">
                              5인 이상
                            </Badge>
                          </>
                        )}
                      </>
                    }
                    bottom={<Amount value={w.hourlyWage} unit="원/시간" typography="st12" />}
                  />
                }
                right={
                  <Button
                    variant="weak"
                    size="small"
                    color="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      haptic('tickWeak');
                      setDeleteTargetId(w.id);
                    }}
                  >
                    삭제
                  </Button>
                }
              />
              <Spacing size={4} />
            </div>
          ))}

          <Spacing size={16} />

          <Button variant="weak" display="block" onClick={handleAdd} data-testid="workplace-add-button">
            근무지 추가하기
          </Button>
        </>
      )}

      <Spacing size={32} />

      <Paragraph.Text typography="st13">
        급여 기록은 이 기기에만 저장돼요. 앱 삭제나 브라우저 데이터 삭제 시 함께 사라져요
      </Paragraph.Text>

      <Spacing size={24} />

      <AlertDialog
        open={Boolean(deleteTarget)}
        title="근무지를 삭제할까요"
        description={
          deleteTarget
            ? `기록 ${linkedRecordCount}건과 저장된 분석 결과 ${linkedPayCheckCount}건도 함께 삭제됩니다`
            : undefined
        }
        alertButton={<AlertDialog.AlertButton onClick={handleConfirmDelete}>삭제</AlertDialog.AlertButton>}
        onClose={() => setDeleteTargetId(null)}
      />

      <Toast
        open={savedToastOpen}
        position="bottom"
        text={incomingToast ?? ''}
        duration={3000}
        onClose={() => setSavedToastOpen(false)}
      />
      <Toast
        open={limitToastOpen}
        position="bottom"
        text="근무지는 최대 5개까지 등록할 수 있어요"
        duration={3000}
        onClose={() => setLimitToastOpen(false)}
      />
    </ScreenScaffold>
  );
}
