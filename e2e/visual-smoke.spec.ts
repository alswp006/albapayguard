import { test, expect, type Page } from "@playwright/test";

/**
 * 제네릭 구조 스모크 — 이 앱 지식 없이도 jsdom이 못 보는 렌더 버그를 잡는다:
 *  · 흰 화면(#root 비어있음)        · <button> 안에 <button>(무효 HTML, 예: FixedBottomCTA 안에 Button)
 *  · 빈 입력칸(placeholder 없음)     · 콘솔 에러
 * 픽셀 베이스라인 없음(OS 안정). 각 화면 스크린샷을 e2e/__shots__/에 저장 → 끝내기 전 직접 열어 자가 리뷰.
 *
 * ▶ 이 앱에 맞게 customize:
 *   1) ROUTES에 핵심 화면을 추가(폼/결과/목록/설정 등)
 *   2) 데이터가 필요한 화면은 seed()에서 localStorage를 채워라
 */
const ROUTES: { path: string; name: string }[] = [
  { path: "/", name: "home" },
  { path: "/record/new", name: "record-new" },
  { path: "/breakdown", name: "breakdown" },
  { path: "/check", name: "check" },
  { path: "/records", name: "records" },
  // { path: "/result", name: "result" },   // ← 이 앱의 라우트를 추가
  // { path: "/settings", name: "settings" },
];

/** 데이터가 필요한 화면용 localStorage 시드(앱에 맞게 채워라). 앱 스크립트보다 먼저 실행된다. */
async function seed(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "apg:workplaces:v1",
      JSON.stringify([
        {
          id: "wp-1",
          name: "카페 알바",
          hourlyWage: 10000,
          isFiveOrMore: true,
          payday: 25,
          taxType: "none",
          colorToken: "blue",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );
    // /breakdown이 빈 상태가 아니라 실제 항목 내역을 렌더하도록 이번 달 기록 시드
    // (하드코딩 날짜 대신 실행 시점 기준으로 생성 — 스모크가 실제 시각에 돈다).
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const iso = "2026-01-01T00:00:00.000Z";
    window.localStorage.setItem(
      "apg:records:v1",
      JSON.stringify([
        {
          id: "r-1",
          workplaceId: "wp-1",
          date: `${ym}-15`,
          startTime: "09:00",
          endTime: "18:00",
          breakMinutes: 60,
          isHoliday: false,
          memo: "",
          createdAt: iso,
          updatedAt: iso,
        },
        {
          id: "r-2",
          workplaceId: "wp-1",
          date: `${ym}-16`,
          startTime: "09:00",
          endTime: "18:00",
          breakMinutes: 60,
          isHoliday: false,
          memo: "",
          createdAt: iso,
          updatedAt: iso,
        },
      ]),
    );
  });
}

// 토스 WebView 밖(일반 브라우저)에서만 나는 알려진 dev 에러 — 무시(실기기 WebView엔 안 남)
const IGNORED_CONSOLE = [/SafeAreaInsets/i, /getSafeAreaInsets/i];

for (const route of ROUTES) {
  test(`visual smoke: ${route.name} (${route.path})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !IGNORED_CONSOLE.some((re) => re.test(m.text()))) errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    await seed(page);
    await page.goto(route.path);
    await page.waitForTimeout(1000); // React 렌더 + effect 정착

    // 1) 흰 화면 방지 — #root에 실제 콘텐츠가 있어야(SDK 가드 누락 시 트리 언마운트 → 흰 화면)
    const rootText = (await page.locator("#root").innerText().catch(() => "")).trim();
    expect(rootText.length, `${route.name}: #root가 비어있음 → 흰 화면`).toBeGreaterThan(0);

    // 2) <button> 안에 <button> 금지 — 무효 HTML. FixedBottomCTA/BottomCTA/CTAButton은 자체가 button이니
    //    안에 Button을 넣지 마라(SubmitFooter는 올바르게 처리됨).
    expect(
      await page.locator("button button").count(),
      `${route.name}: <button> 안에 <button>(무효 HTML — CTA류 안에 Button 중첩)`,
    ).toBe(0);

    // 3) 입력칸은 placeholder가 보여야 — box/line variant는 빈 칸+비포커스에서 라벨이 떠 숨어 빈 회색 박스가 됨
    const inputs = page.getByRole("textbox");
    const n = await inputs.count();
    for (let i = 0; i < n; i++) {
      const ph = (await inputs.nth(i).getAttribute("placeholder")) ?? "";
      expect(ph.trim().length, `${route.name}: 입력칸 #${i}에 placeholder 없음 → 빈 회색 박스`).toBeGreaterThan(0);
    }

    // 4) 콘솔 에러 0 (알려진 dev 에러 제외) — 토스 검수는 console.error 0개 요구
    expect(errors, `${route.name}: 콘솔 에러`).toEqual([]);

    // 5) 스크린샷 저장 → 끝내기 전 직접 열어 자가 리뷰(휑함/솔리드 알약 탭/부유 CTA/앵커 없음)
    await page.screenshot({ path: `e2e/__shots__/${route.name}.png`, fullPage: true });
  });
}
