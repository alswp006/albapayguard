import { Component, type ReactNode } from 'react';
import { Asset } from '@toss/tds-mobile';

interface IconBoundaryProps {
  children: ReactNode;
}

interface IconBoundaryState {
  hasError: boolean;
}

/**
 * Asset.ContentIcon은 아이콘 리소스를 네트워크로 불러오다가 실패하면 throw한다(Suspense는
 * 로딩만 잡을 뿐 이 throw는 못 잡는다). 가드가 없으면 이 에러가 앱 최상단 경계까지 뚫고 올라가
 * 트리 전체가 리마운트되며 화면이 순간적으로 흰 화면이 되고 입력 중이던 상태도 날아간다
 * (매장 와이파이처럼 불안정한 네트워크에서 실제로 재현됨). 아이콘 바로 옆에서 좁게 잡아
 * 실패해도 나머지 화면은 그대로 보이게 한다.
 */
class IconErrorBoundary extends Component<IconBoundaryProps, IconBoundaryState> {
  state: IconBoundaryState = { hasError: false };

  static getDerivedStateFromError(): IconBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    // 조용히 degrade — 콘솔에 이미 React가 에러를 남기므로 중복 로깅하지 않는다.
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function SafeIcon({ name, alt }: { name: string; alt?: string }) {
  return (
    <IconErrorBoundary>
      <Asset.ContentIcon name={name} alt={alt} />
    </IconErrorBoundary>
  );
}
