import { AdSlot } from './AdSlot';

/** 콘솔에서 발급한 광고 그룹 ID. 빌드 시 정적으로 치환된다(미설정이면 빈 문자열). */
const AD_GROUP_ID: string = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? '';

/** 배너 실측 높이 — 로드 전에도 자리를 잡아 콘텐츠가 밀려 올라가는 레이아웃 점프를 막는다. */
const BANNER_MIN_HEIGHT = 100;

export interface AdSlotBannerProps {
  /** 광고 그룹 ID 직접 지정(기본: VITE_TOSS_AD_GROUP_ID) */
  adGroupId?: string;
  testId?: string;
}

/**
 * 본문 맨 아래 배너 광고 영역.
 *
 * 홈에서는 '최근 기록' 카드·기록 추가 CTA **아래**에 둔다 — 1차 액션을 광고가 밀어내지 않게.
 * 하단 FloatingTabBar와는 App.tsx의 본문 paddingBottom(탭바 높이 + safe-area)으로 분리되므로
 * 겹치지 않는다. 광고 그룹 ID가 없으면(로컬·미설정) 자리를 비워둔다 — 빈 회색 박스를 남기지 않는다.
 */
export function AdSlotBanner({
  adGroupId = AD_GROUP_ID,
  testId = 'home-ad-slot',
}: AdSlotBannerProps) {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: adGroupId ? BANNER_MIN_HEIGHT : 0,
      }}
    >
      {adGroupId ? <AdSlot adGroupId={adGroupId} variant="card" /> : null}
    </div>
  );
}

export default AdSlotBanner;
