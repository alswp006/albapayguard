import { useNavigate } from 'react-router-dom';
import { Top, Asset } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SubmitFooter } from '@/components/BottomCTA';
import { EmptyState } from '@/components/StateView';
import { ROUTES } from '@/routes';

// SPEC S8 AC-8: /unknown-path, /record/:id/edit(존재하지 않는 recordId) 등
// 정의되지 않은 모든 경로가 이 화면으로 떨어진다. 화이트 스크린 대신
// 홈으로 돌아갈 경로 하나를 항상 보장한다.
export default function NotFound() {
  const navigate = useNavigate();

  function handleGoHome() {
    navigate(ROUTES.home, { replace: true });
  }

  return (
    <ScreenScaffold
      top={
        <Top title={<Top.TitleParagraph>페이지를 찾을 수 없어요</Top.TitleParagraph>} />
      }
      bottom={
        <SubmitFooter label="홈으로 가기" onClick={handleGoHome} />
      }
    >
      <EmptyState
        testId="notfound-empty"
        icon={<Asset.ContentIcon name="iconStarRegular" alt="페이지 없음" />}
        title="페이지를 찾을 수 없어요"
        description="주소가 바뀌었거나 삭제된 화면이에요"
      />
    </ScreenScaffold>
  );
}
