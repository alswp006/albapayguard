#!/usr/bin/env node
// check-routes.mjs — 경로 문자열과 라우트 테이블(src/routes.ts ROUTES)의 정합성 가드.
//
// Usage: node scripts/check-routes.mjs [scan-dir]     (default scan-dir = src)
//   Exit 0 = 모든 경로 리터럴이 ROUTES로 설명된다.
//   Exit 1 = ROUTES에 없는 경로가 있다(= 배포 후 404가 되는 화면).
//   Exit 2 = 스캔 대상/라우트 테이블을 읽지 못했다.
//
// 왜 필요한가: navigate('/workpalce')처럼 오타 난 경로는 타입도 테스트도 안 잡는다.
// 빌드 전(prebuild)에 한 번 훑어서 "도달할 수 없는 화면"을 만들기 전에 막는다.
//
// devDependency 없이 Node 내장 모듈만 사용한다(정규식 스캔 — AST 파서 불필요).

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, basename, sep } from "node:path";

const ROOT = process.cwd();
const scanDir = process.argv[2] ?? "src";
const ROUTES_FILE = join(ROOT, "src", "routes.ts");
const APP_FILE = join(ROOT, "src", "App.tsx");

const SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const SKIP_DIRS = new Set(["node_modules", "__tests__", "dist", ".git"]);

// 스캔에서 제외하는 파일 — 라우트 테이블 그 자체(정의는 검사 대상이 아니다).
const SKIP_FILES = new Set([join("src", "routes.ts")]);

// 개발 전용 경로 접두사. `/__tds-gallery`처럼 프로덕션 번들에서 트리셰이킹되는
// 화면은 ROUTES(제품 경로 목록)에 넣지 않는다.
const DEV_PATH_PREFIX = "/__";

/**
 * 주석 내용을 같은 길이의 공백으로 치환한다(줄바꿈은 유지 — 줄 번호가 보존된다).
 * 설명 주석에 적힌 경로("`/record/*`에서는 탭바 숨김")까지 위반으로 잡으면
 * 가드가 잡음만 내고 아무도 안 쓰게 된다.
 */
function stripComments(source) {
  let out = "";
  let i = 0;
  let state = "code"; // code | line | block | single | double | template
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];

    if (state === "code") {
      if (c === "/" && next === "/") {
        state = "line";
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        state = "block";
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "'") state = "single";
      else if (c === '"') state = "double";
      else if (c === "`") state = "template";
      out += c;
      i += 1;
      continue;
    }

    if (state === "line") {
      if (c === "\n") state = "code";
      out += c === "\n" ? c : " ";
      i += 1;
      continue;
    }

    if (state === "block") {
      if (c === "*" && next === "/") {
        state = "code";
        out += "  ";
        i += 2;
        continue;
      }
      out += c === "\n" ? c : " ";
      i += 1;
      continue;
    }

    // 문자열 안 — 이스케이프를 건너뛰며 그대로 옮긴다.
    if (c === "\\") {
      out += source.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (
      (state === "single" && c === "'") ||
      (state === "double" && c === '"') ||
      (state === "template" && c === "`")
    ) {
      state = "code";
    }
    out += c;
    i += 1;
  }
  return out;
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

if (!existsSync(ROUTES_FILE)) fail(`✗ 라우트 테이블을 찾지 못했다: ${ROUTES_FILE}`);
if (!existsSync(join(ROOT, scanDir))) fail(`✗ 스캔할 디렉터리가 없다: ${scanDir}`);

// ---------------------------------------------------------------------------
// 1. ROUTES 값 수집
// ---------------------------------------------------------------------------

const routesSource = readFileSync(ROUTES_FILE, "utf-8");
const routePatterns = [
  ...routesSource.matchAll(/^\s*[A-Za-z0-9_]+\s*:\s*'([^']+)'/gm),
].map((m) => m[1]);

if (routePatterns.length === 0) fail("✗ src/routes.ts의 ROUTES에서 경로 값을 하나도 읽지 못했다");

/** '/record/:id/edit' → /^\/record\/[^/]+\/edit$/ */
function toRegExp(pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + escaped.replace(/:[A-Za-z0-9_]+/g, "[^/]+") + "$");
}

const routeMatchers = routePatterns.filter((p) => p.startsWith("/")).map(toRegExp);

/** 경로 리터럴이 ROUTES로 설명되는가. */
function isKnownPath(literal) {
  if (literal === "*" || literal.startsWith(DEV_PATH_PREFIX)) return true;
  // `pathname.startsWith('/record/')` 같은 접두사 검사 — 실제 경로의 앞부분이면 통과.
  if (literal.endsWith("/") && literal !== "/") {
    return routePatterns.some((p) => p.startsWith(literal));
  }
  // 템플릿 리터럴의 `${...}`는 동적 세그먼트로 본다.
  const normalized = literal.replace(/\$\{[^}]*\}/g, ":param");
  return routeMatchers.some((re) => re.test(normalized));
}

// ---------------------------------------------------------------------------
// 2. App.tsx의 <Route path="…"> 선언이 ROUTES에 모두 있는가 (라우트 누락 0건)
// ---------------------------------------------------------------------------

const violations = [];
const declaredRoutePaths = new Set();

if (existsSync(APP_FILE)) {
  const appSource = stripComments(readFileSync(APP_FILE, "utf-8"));
  for (const match of appSource.matchAll(/<Route\s[^>]*path=["'`]([^"'`]+)["'`]/g)) {
    const declared = match[1];
    declaredRoutePaths.add(declared);
    if (declared.startsWith(DEV_PATH_PREFIX)) continue;
    if (!routePatterns.includes(declared)) {
      violations.push({
        file: relative(ROOT, APP_FILE),
        line: appSource.slice(0, match.index).split("\n").length,
        literal: declared,
        why: "App.tsx가 선언한 Route인데 ROUTES에 없다",
      });
    }
  }

  // 2b. 반대 방향 — ROUTES에 있는데 App.tsx에 <Route>가 없는 항목(= 도달 불가 화면).
  for (const pattern of routePatterns) {
    if (pattern === "*" || pattern.startsWith(DEV_PATH_PREFIX)) continue;
    if (!pattern.startsWith("/")) continue;
    if (!declaredRoutePaths.has(pattern)) {
      violations.push({
        file: relative(ROOT, ROUTES_FILE),
        line: routesSource.split("\n").findIndex((l) => l.includes(`'${pattern}'`)) + 1,
        literal: pattern,
        why: "ROUTES에 정의됐지만 App.tsx에 대응하는 <Route>가 없다(도달 불가 화면)",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 3. 소스 트리의 경로 리터럴 스캔
// ---------------------------------------------------------------------------

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      yield* walk(full);
      continue;
    }
    // `__`로 시작하는 파일은 스캐폴드 스크래치/개발 전용 — 번들에 들어가지 않는다.
    if (basename(full).startsWith("__")) continue;
    if (SKIP_FILES.has(relative(ROOT, full))) continue;
    if (SCAN_EXTENSIONS.some((ext) => full.endsWith(ext))) yield full;
  }
}

// 따옴표로 감싼 경로 모양 문자열: '/', '/check/result', `/workplace/${id}/edit`
const PATH_LITERAL = /(['"`])(\/[A-Za-z0-9_:./*${}-]*)\1/g;

for (const file of walk(join(ROOT, scanDir))) {
  const source = stripComments(readFileSync(file, "utf-8"));
  for (const match of source.matchAll(PATH_LITERAL)) {
    const literal = match[2];
    const after = source.slice(match.index + match[0].length);
    // 객체/타입의 **키** 위치('/check/result': …)는 내비게이션이 아니라 색인이다.
    // RouteState 같은 경로 키 맵이 여기 걸리지 않도록 건너뛴다.
    if (/^\s*[:?]/.test(after)) continue;
    if (isKnownPath(literal)) continue;

    violations.push({
      file: relative(ROOT, file),
      line: source.slice(0, match.index).split("\n").length,
      literal,
      why: "ROUTES에 정의되지 않은 경로",
    });
  }
}

// ---------------------------------------------------------------------------
// 4. 보고
// ---------------------------------------------------------------------------

if (violations.length > 0) {
  console.error("✗ 라우트 정합성 검사 실패 — ROUTES에 없는 경로가 있다:\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.literal}  (${v.why})`);
  }
  console.error(
    `\n  고치는 법: src/routes.ts의 ROUTES에 경로를 추가하고 App.tsx에 <Route>를 달거나,` +
      `\n  화면 코드가 ROUTES.<key> / to*(id) 헬퍼를 쓰도록 바꿔라.`
  );
  process.exit(1);
}

console.log(
  `✓ 라우트 정합성 OK — ${routePatterns.length}개 경로 기준, ${scanDir}${sep}에 미정의 경로 없음`
);
