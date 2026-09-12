// RecordForm.tsx가 /record/new(신규)와 /record/:id/edit(수정)의 폼 로직·검증·중복 체크·
// 실시간 프리뷰·삭제 확인을 useParams(id) 유무로 이미 겸용 구현하고 있다(heal-1 패킷에서 통합).
// 별도 구현을 새로 만들면 로직이 중복되므로, 이 파일은 라우트 전용 진입점으로 재노출만 한다.
export { default } from './RecordForm';
