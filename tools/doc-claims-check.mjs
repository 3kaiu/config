#!/usr/bin/env node
/**
 * 文档主张核对 (doc claims check) — 2026-09-18 优化审计, deepdive §3.2 建议 4。
 *
 * 动机: AGENTS.md 是本仓库的决策输入, 但文档里的**关键数字**与产物之间没有自动校验
 * (deepdive NEW-04: 文档称 Global 34,579 条 SUFFIX 实测 0; MOD-10/M10: 文档称
 * "跟随 latest" 实测停在旧版 —— 两者都是"文档与实测漂移"的实锤)。本工具把
 * AGENTS.md 中**可机械反算**的数字固化为断言: 每次测试都拿当前仓库状态重算,
 * 与文档声明比对, 漂移即红 —— 文档数字从"作者记得对"变成"门禁保证对"。
 *
 * 原则: 每条断言的文档值与实测值**都从仓库现场提取**。文档改数字而不改产物 → 红;
 * 改产物而不改文档 → 红。要改数字必须两者一起改 + 实测一致。
 *
 * 用法: node tools/doc-claims-check.mjs [--quiet]
 * 接线: npm test (test/cases/doc-claims-check.test.js) — 经 npm test 进 CI。
 *       刻意**不**进 package.json check:all — check:* 是"当前状态自检",
 *       本工具是"文档↔产物一致性", 归测试层与 wiring-check 同区。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** 从文本提取"数字声明" → key → [{n, line}] */
export function extractClaims(text) {
  const patterns = [
    ["testCases", /`npm test`[^`\n]*?(\d+)\s*个行为级用例/g],
    ["scriptArtifacts", /引用全部\s*(\d+)\s*个\s*Scripts?\s*产物/g],
    ["ruleLines", /\[Rule\]\s*(\d+)\s*行/g],
    ["pluginTotal", /(\d+)\s*个插件(?:的声明与占位符全部配对|\s*=)/g],
    ["devDeps", /仅\s*(\d+)\s*个 devDependencies/g],
    ["keleeCount", /\(\s*(\d+)\s*个:12306/g],
  ];
  const claims = new Map();
  const lines = text.split("\n");
  for (const [key, re] of patterns) {
    const values = [];
    lines.forEach((ln, i) => {
      for (const m of ln.matchAll(re)) values.push({ n: Number(m[1]), line: i + 1 });
    });
    claims.set(key, { values, pattern: re.source });
  }
  return claims;
}

/** 产物/清单实测值 (用例计数经动态 import, 故为 async) */
export async function measure(root = ROOT) {
  const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

  // 1. 用例数: exports.tests 键数 (与 run-tests.js 的用例语义一致 — 本仓库不用 it())
  // 动态 import() 而非 require(esm): 后者需 Node ≥22.12 会抬高 engines 下限 (同 rule-shadow 用例口径)
  let testCases = 0;
  const casesDir = path.join(root, "test", "cases");
  for (const f of fs.readdirSync(casesDir).filter((x) => x.endsWith(".test.js"))) {
    const mod = await import(path.join(casesDir, f).replace(/\\/g, "/"));
    if (mod && mod.tests) testCases += Object.keys(mod.tests).length;
  }

  // 2. [Rule] 非注释非空行 ([Rule] 起至 [Remote Rule] 止)
  const lcf = read(path.join("Profile", "Loon.lcf")).split("\n");
  let inRule = false;
  let ruleLines = 0;
  for (const ln of lcf) {
    const t = ln.trim();
    if (t === "[Rule]") { inRule = true; continue; }
    if (t === "[Remote Rule]") { inRule = false; continue; }
    if (inRule && t && !t.startsWith("#")) ruleLines++;
  }

  // 3-5. 产物与插件计数; 6-7. package.json
  const scripts = fs.readdirSync(path.join(root, "Scripts")).filter((x) => x.endsWith(".js"));
  const plugins = fs.readdirSync(path.join(root, "Plugin")).filter((x) => x.endsWith(".plugin"));
  const kelee = fs.readdirSync(path.join(root, "Kelee")).filter((x) => x.endsWith(".plugin"));
  const pkg = JSON.parse(read("package.json"));
  return {
    testCases,
    ruleLines,
    scripts: scripts.length,
    plugins: plugins.length,
    kelee: kelee.length,
    devDeps: Object.keys(pkg.devDependencies || {}).length,
    nodeReq: ((pkg.engines && pkg.engines.node) || "").replace(/[^\d.]/g, "").split(".")[0],
  };
}

/** 断言主逻辑: 返回 { fails, rows } — 供测试注入夹具复用 */
export function check(claims, measured, options = {}) {
  const fails = [];
  const rows = [];
  const expect = (key, actual, label) => {
    const c = claims.get(key);
    if (!c || c.values.length === 0) {
      rows.push({ ok: false, label, detail: "文档中未找到该声明" });
      fails.push({ key, claim: null, actual, reason: "missing-claim" });
      return;
    }
    const distinct = [...new Set(c.values.map((v) => v.n))];
    if (distinct.length > 1) {
      rows.push({ ok: false, label, detail: `文档自相矛盾: ${distinct.join(" vs ")}` });
      fails.push({ key, claim: distinct, actual, reason: "contradiction" });
      return;
    }
    const ok = distinct[0] === actual;
    rows.push({ ok, label, detail: `文档 ${distinct[0]} ↔ 实测 ${actual}` });
    if (!ok) fails.push({ key, claim: distinct[0], actual, reason: "mismatch" });
  };

  expect("testCases", measured.testCases, "npm test 用例数");
  expect("scriptArtifacts", measured.scripts, "Scripts 产物数");
  expect("ruleLines", measured.ruleLines, "[Rule] 非注释行数");
  expect("pluginTotal", measured.plugins + measured.kelee, "插件总数 (Plugin + Kelee)");
  expect("devDeps", measured.devDeps, "devDependencies 数");
  expect("keleeCount", measured.kelee, "Kelee 外壳数");

  // engines.node: 文档形态 `engines.node >= 22`, 与 pkg 实测主版本比对
  const claimed = options.claimsText ? (options.claimsText.match(/engines\.node\s*[≥>=]+\s*(\d+)/) || [])[1] : null;
  const okEngines = claimed != null && claimed === String(measured.nodeReq);
  rows.push({ ok: okEngines, label: "engines.node 主版本", detail: `文档 ${claimed ?? "未找到"} ↔ 实测 ${measured.nodeReq}` });
  if (!okEngines) fails.push({ key: "nodeReq", claim: claimed, actual: measured.nodeReq, reason: "mismatch" });

  return { fails, rows };
}

/** 入口守卫: 顶层仅在被直接执行时跑 main (测试可安全 import) */
function isMain() {
  const arg = process.argv[1] && path.resolve(process.argv[1]);
  return arg === fileURLToPath(import.meta.url);
}

export async function main() {
  const quiet = process.argv.includes("--quiet");
  const agentsText = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
  const claims = extractClaims(agentsText);
  const measured = await measure(ROOT);
  const { fails, rows } = check(claims, measured, { claimsText: agentsText });

  if (!quiet) {
    console.log("── 文档主张 ↔ 产物实测 ──");
    for (const r of rows) console.log(`${r.ok ? "✅" : "❌"} ${r.label}: ${r.detail}`);
  }
  if (fails.length) {
    console.log(`✗ 文档主张核对失败: ${fails.length} 处漂移`);
    process.exit(1);
  }
  console.log(`✅ 文档主张核对通过: ${rows.length} 项声明与实测一致`);
}

if (isMain()) main();

