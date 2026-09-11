// @ai-factory:wiring-first — 스캐폴드가 설계(SPEC 화면 표·패킷 목록)로부터 결정론으로 깐 라우트 골격이다.
// 진입점(App.tsx) 패킷: 처음부터 다시 쓰지 마라 — SPEC과 경로를 대조·보완하고, 전역 Provider(광고/결제 SDK·앱 상태)를
//   <Routes>를 감싸는 자리에 끼워라. 라우트 경로는 지우지 말고 고쳐라(화면 파일은 이 경로로 navigate한다).
// 화면 패킷: 이 파일을 건드리지 마라 — 자기 페이지 파일(자리 페이지)만 통째로 교체한다.
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppDataProvider } from './providers/AppDataProvider';
import Home from './pages/Home';
import Breakdown from './pages/Breakdown';
import Check from './pages/Check';
import CheckResult from './pages/CheckResult';
import Records from './pages/Records';
import Workplace from './pages/Workplace';
import Onboarding from './pages/Onboarding';
import RecordForm from './pages/RecordForm';
import NotFound from './pages/NotFound';

// Dev-only TDS Gallery route — `import.meta.env.DEV` is statically replaced
// (true in dev, false in prod) so the entire import + Route is tree-shaken
// from production builds. Verify with: `grep -r "TdsGallery" dist/` → empty.
const DevTdsGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/__TdsGallery'))
  : null;

export default function App() {
  return (
    // @ai-factory:providers — 전역 Provider는 <Routes>를 감싸는 이 자리에 둔다(main.tsx는 @AI:ANCHOR, 수정 금지).
    <AppDataProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/breakdown" element={<Breakdown />} />
        <Route path="/check" element={<Check />} />
        <Route path="/check/result" element={<CheckResult />} />
        <Route path="/records" element={<Records />} />
        <Route path="/workplace" element={<Workplace />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/record/new" element={<RecordForm />} />
        <Route path="/record/:id/edit" element={<RecordForm />} />
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
    </AppDataProvider>
  );
}
