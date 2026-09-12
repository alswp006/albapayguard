// 경로 단일 출처. 화면 코드의 navigate()/Link는 반드시 여기서 값을 가져온다.
// App.tsx의 <Route path="…">만 리터럴을 유지한다(정적 검사 대상) — 대신
// packet-heal-2-01 테스트가 ROUTES 값과 App.tsx 선언의 1:1 대응을 강제한다.
export const ROUTES = {
  home: '/',
  onboarding: '/onboarding',
  recordNew: '/record/new',
  recordEdit: '/record/:id/edit',
  records: '/records',
  breakdown: '/breakdown',
  check: '/check',
  checkResult: '/check/result',
  workplace: '/workplace',
  workplaceNew: '/workplace/new',
  workplaceEdit: '/workplace/:id/edit',
  notFound: '*',
} as const;

export const toRecordEdit = (id: string) => `/record/${id}/edit`;
export const toWorkplaceEdit = (id: string) => `/workplace/${id}/edit`;
