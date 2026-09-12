/**
 * 라우트 단일 출처(ROUTES) 도입 + App.tsx 전체 경로 배선 + 누락 페이지 플레이스홀더 (packet heal-2-01)
 *
 * App.tsx는 이미 모든 Route가 배선되어 있다(@ai-factory:wiring-first) — 이 패킷은 App.tsx를
 * 새로 배선하는 것이 아니라, src/routes.ts라는 단일 출처를 만들고 코드베이스 전역의
 * navigate('/하드코딩') 리터럴을 그 상수/빌더로 치환하는 것이 목표다. App.tsx 자체는 건드리지
 *않으므로(수정 금지 규칙), App.tsx의 리터럴 Route path는 정적 문자열 검사로만 확인한다.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "src");

function readSrcFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

/** src 트리 전체를 순회하며 상대경로 목록을 돌려준다(테스트 파일·routes.ts·App.tsx는 제외 가능). */
function listSourceFiles(opts: { exclude?: string[] } = {}): string[] {
  const exclude = opts.exclude ?? [];
  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(ROOT, full);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "node_modules") continue;
        walk(full);
      } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
        if (exclude.some((ex) => rel === ex || rel.startsWith(ex))) continue;
        results.push(rel);
      }
    }
  }
  walk(SRC);
  return results;
}

describe("라우트 단일 출처(ROUTES) 도입 + App.tsx 전체 경로 배선 + 누락 페이지 플레이스홀더", () => {
  it("AC-1[P0]: src/routes.ts가 모든 경로 상수와 동적 경로 빌더 헬퍼를 export 한다", async () => {
    const routesModule = await import("@/routes");
    const { ROUTES, toRecordEdit, toWorkplaceEdit } = routesModule as {
      ROUTES: Record<string, string>;
      toRecordEdit: (id: string) => string;
      toWorkplaceEdit: (id: string) => string;
    };

    expect(ROUTES.home).toBe("/");
    expect(ROUTES.onboarding).toBe("/onboarding");
    expect(ROUTES.recordNew).toBe("/record/new");
    expect(ROUTES.recordEdit).toBe("/record/:id/edit");
    expect(ROUTES.records).toBe("/records");
    expect(ROUTES.breakdown).toBe("/breakdown");
    expect(ROUTES.check).toBe("/check");
    expect(ROUTES.checkResult).toBe("/check/result");
    expect(ROUTES.workplace).toBe("/workplace");
    expect(ROUTES.workplaceNew).toBe("/workplace/new");
    expect(ROUTES.workplaceEdit).toBe("/workplace/:id/edit");
    expect(ROUTES.notFound).toBe("*");

    expect(toRecordEdit("abc123")).toBe("/record/abc123/edit");
    expect(toWorkplaceEdit("wp-9")).toBe("/workplace/wp-9/edit");
  });

  it("AC-1b: 빌더 헬퍼는 서로 다른 id에 대해 항상 대응하는 recordEdit/workplaceEdit 패턴과 일치하는 문자열을 만든다", async () => {
    const { ROUTES, toRecordEdit, toWorkplaceEdit } = (await import("@/routes")) as {
      ROUTES: Record<string, string>;
      toRecordEdit: (id: string) => string;
      toWorkplaceEdit: (id: string) => string;
    };

    const recordPattern = new RegExp("^" + ROUTES.recordEdit.replace(":id", "[^/]+") + "$");
    const workplacePattern = new RegExp("^" + ROUTES.workplaceEdit.replace(":id", "[^/]+") + "$");

    expect(recordPattern.test(toRecordEdit("r-1"))).toBe(true);
    expect(workplacePattern.test(toWorkplaceEdit("w-1"))).toBe(true);
    expect(toRecordEdit("r-1")).not.toBe(toRecordEdit("r-2"));
  });

  it("AC-2[P0]: App.tsx의 <Routes>에 모든 필수 경로가 Route로 선언되어 있다", () => {
    const appSource = readSrcFile("src/App.tsx");
    const requiredPaths = [
      "/",
      "/onboarding",
      "/record/new",
      "/record/:id/edit",
      "/records",
      "/breakdown",
      "/check",
      "/check/result",
      "/workplace",
      "/workplace/new",
      "/workplace/:id/edit",
      "*",
    ];

    for (const p of requiredPaths) {
      const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const routeRegex = new RegExp(`<Route\\s+path=["']${escaped}["']`);
      expect(routeRegex.test(appSource), `App.tsx에 path="${p}" Route가 없다`).toBe(true);
    }
  });

  it("AC-3[P0]: App.tsx를 제외한 코드베이스 전역에 navigate()/Link 하드코딩 경로 리터럴이 남아있지 않다", () => {
    const files = listSourceFiles({ exclude: ["src/App.tsx", "src/routes.ts"] });
    const literalNavigatePattern = /navigate\(\s*['"`]\//g;
    const literalLinkToPattern = /\bto=\s*['"`]\//g;

    const offenders: { file: string; matches: string[] }[] = [];
    for (const rel of files) {
      const content = fs.readFileSync(path.join(ROOT, rel), "utf-8");
      const navMatches = content.match(literalNavigatePattern) ?? [];
      const linkMatches = content.match(literalLinkToPattern) ?? [];
      if (navMatches.length > 0 || linkMatches.length > 0) {
        offenders.push({ file: rel, matches: [...navMatches, ...linkMatches] });
      }
    }

    expect(offenders, JSON.stringify(offenders, null, 2)).toHaveLength(0);
  });

  it("AC-4[P0]: App.tsx가 import하는 모든 페이지 모듈이 존재하고 default export를 가진다", async () => {
    const modules = await Promise.all([
      import("@/pages/Home"),
      import("@/pages/Breakdown"),
      import("@/pages/Check"),
      import("@/pages/CheckResult"),
      import("@/pages/Records"),
      import("@/pages/Workplace"),
      import("@/pages/WorkplaceForm"),
      import("@/pages/Onboarding"),
      import("@/pages/RecordForm"),
      import("@/pages/RecordEdit"),
      import("@/pages/NotFound"),
    ]);
    const names = [
      "Home",
      "Breakdown",
      "Check",
      "CheckResult",
      "Records",
      "Workplace",
      "WorkplaceForm",
      "Onboarding",
      "RecordForm",
      "RecordEdit",
      "NotFound",
    ];

    modules.forEach((mod, i) => {
      expect(typeof mod.default, `pages/${names[i]}의 default export가 함수(컴포넌트)가 아니다`).toBe("function");
    });
  });

  it("AC-5: ROUTES의 모든 동적 경로 값이 App.tsx에 선언된 Route path 목록과 1:1로 대응한다 (라우트 누락 없음)", async () => {
    const { ROUTES } = (await import("@/routes")) as { ROUTES: Record<string, string> };
    const appSource = readSrcFile("src/App.tsx");
    const declaredPaths = [...appSource.matchAll(/<Route\s+path=["']([^"']+)["']/g)].map((m) => m[1]);

    for (const routeValue of Object.values(ROUTES)) {
      expect(
        declaredPaths.includes(routeValue),
        `ROUTES 값 "${routeValue}"에 대응하는 App.tsx Route가 없다`
      ).toBe(true);
    }
  });
});
