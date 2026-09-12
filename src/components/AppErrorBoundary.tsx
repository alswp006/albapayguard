import { Component, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SubmitFooter } from '@/components/BottomCTA';
import { EmptyState } from '@/components/StateView';

function ErrorFallback({ onRecover }: { onRecover: () => void }) {
  const navigate = useNavigate();

  function handleGoHome() {
    navigate('/', { replace: true });
    onRecover();
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>문제가 생겼어요</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="홈으로 가기" onClick={handleGoHome} />}
    >
      <EmptyState
        testId="app-error-boundary"
        title="화면을 불러오지 못했어요"
        description="홈으로 돌아가 다시 시도해주세요"
      />
    </ScreenScaffold>
  );
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * 화면 어딘가에서 예상 못한 렌더 에러가 나면(가드 안 된 서드파티 컴포넌트, 네트워크 의존
 * 리소스 실패 등) 이 경계 없이는 트리 전체가 사라져 흰 화면으로 남고 되돌아갈 길이 없다.
 * 홈으로 돌아갈 카드를 항상 보장해 막다른 길을 없앤다.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  handleRecover = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) return <ErrorFallback onRecover={this.handleRecover} />;
    return this.props.children;
  }
}
