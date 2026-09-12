// @ai-factory:wiring-first — 스캐폴드가 설계(SPEC 화면 표·패킷 목록)로부터 결정론으로 깐 라우트 골격이다.
// 진입점(App.tsx) 패킷: 처음부터 다시 쓰지 마라 — SPEC과 경로를 대조·보완하고, 전역 Provider(광고/결제 SDK·앱 상태)를
//   <Routes>를 감싸는 자리에 끼워라. 라우트 경로는 지우지 말고 고쳐라(화면 파일은 이 경로로 navigate한다).
// 화면 패킷: 이 파일을 건드리지 마라 — 자기 페이지 파일(자리 페이지)만 통째로 교체한다.
import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppDataProvider } from './providers/AppDataProvider';
import { useAppData } from './hooks/useAppData';
import { FloatingTabBar, type TabItem } from './components/FloatingTabBar';
import { ScreenScaffold } from './components/ScreenScaffold';
import { LoadingState } from './components/StateView';
import Home from './pages/Home';
import Breakdown from './pages/Breakdown';
import Check from './pages/Check';
import CheckResult from './pages/CheckResult';
import Records from './pages/Records';
import Workplace from './pages/Workplace';
import WorkplaceForm from './pages/WorkplaceForm';
import Onboarding from './pages/Onboarding';
import RecordForm from './pages/RecordForm';
import NotFound from './pages/NotFound';

// Dev-only TDS Gallery route — `import.meta.env.DEV` is statically replaced
// (true in dev, false in prod) so the entire import + Route is tree-shaken
// from production builds. Verify with: `grep -r "TdsGallery" dist/` → empty.
const DevTdsGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/__TdsGallery'))
  : null;

// SPEC S8: 4탭 — 홈 / 기록 / 분석 / 근무지. 활성 표시는 FloatingTabBar가 현재 경로로 자동(컬러 틴트).
const TAB_ITEMS: TabItem[] = [
  { label: '홈', path: '/' },
  { label: '기록', path: '/records' },
  { label: '분석', path: '/check' },
  { label: '근무지', path: '/workplace' },
];

// 탭바 높이(아이콘 없는 라벨 탭) — 본문이 탭바에 가리지 않도록 하단 여백으로 보정.
const TAB_BAR_SPACE = 'calc(var(--toss-safe-area-bottom) + 60px)';

/**
 * SPEC S8: `/onboarding`, `/record/*`, `/check/result`, `/workplace/new`, `/workplace/:id`에서는 탭바 숨김.
 * 정의되지 않은 경로(404)에서는 일부러 **표시**한다 — 빠져나갈 길 없는 화면을 만들지 않기 위해.
 */
function isTabBarVisible(pathname: string): boolean {
  if (pathname === '/onboarding') return false;
  if (pathname.startsWith('/record/')) return false;
  if (pathname === '/check/result') return false;
  if (pathname.startsWith('/workplace/')) return false;
  return true;
}

/** 라우트 전환 시 스크롤 최상단 복원. window.scrollTo는 jsdom에서 미구현 에러를 남기므로 쓰지 않는다. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return null;
}

/**
 * 온보딩 게이트 — 저장된 설정을 다 읽은 뒤에만 판단한다.
 * 로딩 중에 판단하면 기본값(onboardingSeenAt: null) 때문에 매번 온보딩으로 튄다.
 */
function HomeRoute() {
  const { loading, settings } = useAppData();
  if (!loading && !settings?.onboardingSeenAt) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Home />;
}

function AppRoutes() {
  const { pathname } = useLocation();
  // 저장소를 다 읽기 전에는 화면을 그리지 않는다 — 페이지마다 로딩 골격이 한 번 깜빡였다가
  // 실제 내용으로 교체되는 이중 렌더를 없앤다(온보딩 판단도 이 시점 이후에만 가능).
  const { loading } = useAppData();
  const tabBarVisible = !loading && isTabBarVisible(pathname);

  return (
    <>
      <ScrollToTop />
      {/* 탭바를 <Routes>보다 먼저 둔다 — 페이지의 하단 고정 CTA(FixedBottomCTA)가 위에 그려지도록(겹침 시 CTA 우선). */}
      {tabBarVisible && <FloatingTabBar items={TAB_ITEMS} />}
      <div style={{ paddingBottom: tabBarVisible ? TAB_BAR_SPACE : undefined }}>
        {loading ? (
          <ScreenScaffold>
            <LoadingState rows={3} testId="app-boot-skeleton" />
          </ScreenScaffold>
        ) : (
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/record/new" element={<RecordForm />} />
            <Route path="/record/:id/edit" element={<RecordForm />} />
            <Route path="/records" element={<Records />} />
            <Route path="/breakdown" element={<Breakdown />} />
            <Route path="/check" element={<Check />} />
            <Route path="/check/result" element={<CheckResult />} />
            <Route path="/workplace" element={<Workplace />} />
            <Route path="/workplace/new" element={<WorkplaceForm />} />
            <Route path="/workplace/:id" element={<WorkplaceForm />} />
            {/* `/workplace/:id`의 별칭 — 외부에서 들어온 편집 링크가 404로 떨어지지 않게. */}
            <Route path="/workplace/:id/edit" element={<WorkplaceForm />} />
            <Route path="*" element={<NotFound />} />
            {DevTdsGallery && (
              <Route
                path="/__tds-gallery"
                element={
                  <Suspense fallback={null}>
                    <DevTdsGallery />
                  </Suspense>
                }
              />
            )}
          </Routes>
        )}
      </div>
    </>
  );
}

export default function App() {
  return (
    // @ai-factory:providers — 전역 Provider는 <Routes>를 감싸는 이 자리에 둔다(main.tsx는 @AI:ANCHOR, 수정 금지).
    <AppDataProvider>
      <AppRoutes />
    </AppDataProvider>
  );
}
