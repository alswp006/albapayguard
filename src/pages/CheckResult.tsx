// 복잡도 분리(packet: 미지급 분석 결과 페이지 `/check/result` 리워드 광고 게이트 split)로
// 이 화면의 실제 구현은 CheckResultCore(순수 표시) + CheckResultAd(광고 게이트·저장)로 옮겨졌다.
// 기존 임포트 경로(@/pages/CheckResult)를 그대로 쓰는 코드/테스트가 깨지지 않도록 재수출만 한다.
export { default } from '@/pages/CheckResultAd';
