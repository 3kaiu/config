#!/usr/bin/env node
/**
 * 镜像漂移检测 (2026-09-11 分模块审计 MOD-09)
 *
 * 问题: mirror-scripts.yml 声明 `releases/latest/download/…`, 但 keep_old 会在 fetch
 * 失败时静默保留旧版 → MANIFEST 记录的是固定旧版本, 与声明不再一致。
 * 本工具比对 "workflow 声明的 mirror() URL" 与 "MANIFEST 实际记录的 source_url",
 * 输出漂移清单 — 供维护者决定是修复上游 URL、还是接受受管陈旧。
 *
 * 用法:
 *   node tools/mirror-drift-check.mjs           报告模式 (始终 exit 0, 供人看)
 *   node tools/mirror-drift-check.mjs --strict  门禁模式 (出现**未登记**的漂移/从未抓取即 exit 1)
 *   node tools/mirror-drift-check.mjs --quiet   只输出判定行
 *
 * ── 退出码语义 (2026-09-11 深度审计 NEW-10 决策) ──
 * 本工具此前默认在"从未抓到"时 exit 1, 但该状态**并不等价于缺陷** —— 镜像 PR 未合并时
 * main 上必然看到全部新增条目都是"从未抓到"(实测 PR #39 未合并期间 13 条 bundle.js)。
 * 故拆成两种模式: 默认报告 (exit 0), `--strict` 才是门禁。
 *
 * `--strict` 判定为**子集**而非相等: `ACCEPTED_*` 登记的是"已知且接受"的条目, 出现登记表
 * 之外的漂移才判红。条目消解后 (如镜像 PR 合并) 保留在登记表内无害 — 避免每次上游变化
 * 都要同步删表。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * 已知且接受的 **URL 漂移** (workflow 声明 ≠ MANIFEST 记录)。
 * 成因: NSRingo 自 v3.2.0 (2026-08) 起从 release 中移除 `.plugin` asset, 改为 `.lpx`;
 * workflow 仍声明 `releases/latest/download/iRingo.*.plugin` → 必 404 → keep_old 保留
 * 最后一个提供 `.plugin` 的版本。属**有意保留** (生产插件走 .lpx 需先验证 boxjs 兼容)。
 */
export const ACCEPTED_DRIFT = new Map([
  ["iringo/iRingo.Maps.plugin", "上游 latest 已无 .plugin asset; keep_old 保留最后一个含 .plugin 的版本"],
  ["iringo/iRingo.News.plugin", "同上"],
  ["iringo/iRingo.Search.plugin", "同上"],
  ["iringo/iRingo.Siri.plugin", "同上"],
  ["iringo/iRingo.TestFlight.plugin", "同上"],
  ["iringo/iRingo.TV.plugin", "同上"],
  ["iringo/iRingo.LocationService.plugin", "同上"],
]);

/**
 * 已知且接受的 **从未抓到** (workflow 声明但 MANIFEST 无记录)。
 * 成因: 这些条目由未合并的镜像 PR 引入 (工作流历史中断), main 上尚无记录。
 * 地址经手动 curl 验证有效 (200), 镜像 PR 合并后自动从本表消解。
 */
export const ACCEPTED_MISSING = new Map(
  [
    "WeatherKit", "GeoServices", "News", "Siri", "TestFlight", "TV", "LocationServices",
  ].flatMap((repo) =>
    (repo === "News" ? ["request.bundle.js"] : ["request.bundle.js", "response.bundle.js"]).map(
      (f) => [`iringo/${repo}/${f}`, "由未合并的镜像 PR 引入 (上游资产存在, 已验证 200)"],
    ),
  ),
);

/**
 * 解析 workflow 中的 mirror() 调用 → Map(dest → url)。
 *
 * 2026-09-11 深度审计 NEW-10: 旧实现只匹配"URL 与 dest 相邻两行"的写法, 对
 * `for n in Advertising … Global; do mirror "…/Loon/$n/$n.list" "rules/loon-$n.list" …; done`
 * 完全失明 — 它把 `rules/loon-$n.list` 当成一个字面 dest, 于是 6 个真实条目同时被报成
 * "孤儿保留"(MANIFEST 有而"workflow 不再声明") 与"从未抓到"(幻影条目)。先展开循环再解析。
 */
export function parseDeclarations(wfTxt) {
  const declared = new Map();
  const MIRROR_RE = /mirror\s+"([^"]+)"\s+\\?\s*\n?\s*"([^"]+)"/g;

  // ① 展开 `for VAR in V1 V2 …; do … done` (单层; 本仓库仅一处, 位于规则列表段)
  //    注意 `done` 前有缩进 — 必须 `\n\s*done` 而非 `\ndone` (后者永不匹配, 静默退回旧行为)
  let rest = wfTxt;
  const LOOP_RE = /for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+([^;]+);\s*do\b([\s\S]*?)\n\s*done\b/g;
  rest = rest.replace(LOOP_RE, (_all, varName, vals, body) => {
    for (const v of vals.trim().split(/\s+/).filter(Boolean)) {
      // 同时支持 `$n` 与 `${n}` 两种写法
      const expanded = body
        .replace(new RegExp(`\\$\\{${varName}\\}`, "g"), v)
        .replace(new RegExp(`\\$${varName}\\b`, "g"), v);
      for (const m of expanded.matchAll(MIRROR_RE)) declared.set(m[2], m[1]);
    }
    return ""; // 原循环体不再参与 ② (避免重复/幻影 dest)
  });

  // ② 解析循环外的普通 mirror() 调用
  for (const m of rest.matchAll(MIRROR_RE)) declared.set(m[2], m[1]);

  return declared;
}

/** MANIFEST → Map(dest → source_url) */
export function collectRecorded(manifest) {
  const recorded = new Map();
  for (const [k, v] of Object.entries(manifest.files || {})) {
    if (v && v.source_url) recorded.set(k, v.source_url);
  }
  return recorded;
}

/**
 * 三类差异:
 *   drift   — 声明 URL ≠ 记录 URL (keep_old 残留)
 *   missing — 声明有但清单无 (从未抓到 / 镜像 PR 未合并)
 *   orphan  — 清单有但 workflow 不再声明 (孤儿保留)
 */
export function diffDeclarations(declared, recorded) {
  const drift = [];
  const missing = [];
  const orphan = [];
  for (const [dest, url] of declared) {
    const actual = recorded.get(dest);
    if (!actual) { missing.push({ dest, url }); continue; }
    if (url !== actual) drift.push({ dest, declared: url, recorded: actual });
  }
  for (const dest of recorded.keys()) {
    if (!declared.has(dest)) orphan.push({ dest, url: recorded.get(dest) });
  }
  return { drift, missing, orphan };
}

export function run(root = ROOT, { strict = false, quiet = false } = {}) {
  const wfTxt = fs.readFileSync(path.join(root, ".github/workflows/mirror-scripts.yml"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "Mirror/MANIFEST.json"), "utf8"));

  const declared = parseDeclarations(wfTxt);
  const recorded = collectRecorded(manifest);
  const { drift, missing, orphan } = diffDeclarations(declared, recorded);

  if (!quiet) {
    for (const d of drift) {
      console.log(`[URL漂移] ${d.dest}${ACCEPTED_DRIFT.has(d.dest) ? " (已登记)" : " ⚠️ 未登记"}`);
      console.log(`  声明: ${d.declared}`);
      console.log(`  记录: ${d.recorded}`);
    }
    for (const o of orphan) console.log(`[孤儿保留] ${o.dest} (workflow 不再声明)`);
    if (missing.length) {
      console.log(`\n[从未抓到] ${missing.length} 条 (声明存在但清单无记录 — 可能永久失败, 或镜像 PR 尚未合并):`);
      for (const m of missing) console.log(`  ${m.dest} → ${m.url}${ACCEPTED_MISSING.has(m.dest) ? " (已登记)" : " ⚠️ 未登记"}`);
    }
    console.log(`\n══ 镜像漂移摘要 ══`);
    console.log(`  workflow 声明: ${declared.size} 条`);
    console.log(`  MANIFEST 记录: ${recorded.size} 条`);
    console.log(`  一致:          ${declared.size - drift.length - missing.length} 条`);
    console.log(`  URL 漂移:      ${drift.length} 条 (keep_old 保留旧版)`);
    console.log(`  从未抓到:      ${missing.length} 条`);
    console.log(`  孤儿保留:      ${orphan.length} 条 (设计意图: 防清单漏项静默删仓库文件)`);
  }

  if (!strict) {
    console.log(`✅ 镜像漂移检测 (报告模式): 漂移 ${drift.length} / 从未抓到 ${missing.length} / 孤儿 ${orphan.length}`);
    return 0;
  }

  const badDrift = drift.filter((d) => !ACCEPTED_DRIFT.has(d.dest));
  const badMissing = missing.filter((m) => !ACCEPTED_MISSING.has(m.dest));
  if (badDrift.length || badMissing.length) {
    console.log(`✗ 镜像漂移门禁: ${badDrift.length} 条未登记漂移 + ${badMissing.length} 条未登记从未抓到`);
    if (!quiet) {
      for (const d of badDrift) console.log(`  [新漂移] ${d.dest}: 声明 ${d.declared} ≠ 记录 ${d.recorded}`);
      for (const m of badMissing) console.log(`  [新从未抓到] ${m.dest} → ${m.url}`);
      console.log("  处置: 修正 workflow URL, 或确认可接受后登记进 tools/mirror-drift-check.mjs 的 ACCEPTED_* 表");
    }
    return 1;
  }
  console.log(`✅ 镜像漂移门禁通过: 漂移 ${drift.length} 条 + 从未抓到 ${missing.length} 条均已登记 (孤儿 ${orphan.length} 条不参与判定)`);
  return 0;
}

const isEntryPoint = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  process.exit(run(ROOT, { strict: process.argv.includes("--strict"), quiet: process.argv.includes("--quiet") }));
}
