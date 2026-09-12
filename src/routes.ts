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
