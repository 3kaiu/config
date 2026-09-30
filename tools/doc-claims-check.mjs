#!/usr/bin/env node
/**
 * 文档主张核对 (doc claims check)。
 *
 * 动机: AGENTS.md 是本仓库的决策输入, 但文档里的**关键数字**与产物之间没有自动校验
 * (历史审计 NEW-04: 文档称 Global 34,579 条 SUFFIX 实测 0; MOD-10/M10: 文档称
 * "跟随 latest" 实测停在旧版 —— 两者都是"文档与实测漂移"的实锤)。本工具把
 * 文档中**可机械反算**的数字固化为断言: 每次测试都拿当前仓库状态重算,
 * 与文档声明比对, 漂移即红 —— 文档数字从"作者记得对"变成"门禁保证对"。
 *
 * 原则: 每条断言的文档值与实测值**都从仓库现场提取**。文档改数字而不改产物 → 红;
 * 改产物而不改文档 → 红。要改数字必须两者一起改 + 实测一致。
 *
 * 2026-09-29 扩面 (起因是一次真实漂移): 原先只扫 AGENTS.md, 于是
 * `MODULES.md` 与 `MODULE-MANIFEST.json`(自述的"资源归类单一真源")的数字面**无门禁**,
 * 四处 483/120/121/122 长期与实测(490/127)不符, 且 manifest 内部自相矛盾
 * (既写 127 又写 120)。现改为三文件一起扫, 跨文件矛盾也判红。新增两类断言:
 *   · rejectRules  —— [Rule] 段含 REJECT 的行数 (原只有行数被盯, REJECT 条数没人管)
 *   · 每个插件的「N 个域」 —— manifest 里最多的一类声明, 改了插件必漂 (见 checkPluginDomains)
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

/** 被扫的声明文件 (manifest 是 JSON, 单独走 extractClaimsFromJson) */
export const CLAIM_FILES = ["AGENTS.md", "MODULES.md"];
export const CLAIM_JSON = "MODULE-MANIFEST.json";

/**
 * 可机械反算的文档声明形态。新增一条 = 新增一项跨文件断言, 必须同步:
 *   ① check() 里加 expect  ② test/cases/doc-claims-check.test.js 的夹具与 rows 计数
 *
 * ⚠️ 句式即契约: 声明必须写成这些形态才受门禁保护。写成"127 条已取证 REJECT"
 * (数字与 REJECT 之间夹词)会**静默脱检** —— 这正是本工具要消灭的形状, 见文件末尾注释。
 */
export const CLAIM_PATTERNS = [
  ["testCases", /`npm test`[^`\n]*?(\d+)\s*个行为级用例/g],
  ["scriptArtifacts", /引用全部\s*(\d+)\s*个\s*Scripts?\s*产物/g],
  // "行" 与 "条:" 两种写法都认 (AGENTS.md 写 "[Rule] 490 行", MODULES.md 写
  // "[Rule] 段 490 行", manifest 写 "[Rule] 490 条:")。刻意**不**认
  // "[Rule] 策略层 127 条 REJECT" —— 那个 127 是 REJECT 条数, 归 rejectRules。
  ["ruleLines", /\[Rule\][^\n]{0,6}?(\d+)\s*(?:行|条(?=\s*[:：]))/g],
  // 计数口径: [Rule] 段内含 REJECT 的非注释行数 (含 `PROTOCOL, STUN, REJECT` 与
  // `DEST-PORT, 3478, REJECT` 两条)。要求数字与 REJECT 紧邻, 故
  // "97 条域级 REJECT"(插件层)与 "16 条广告面 REJECT"(snippet URL 路径)都不会误配。
  ["rejectRules", /(\d+)\s*条\s*REJECT/g],
  ["pluginTotal", /(\d+)\s*个插件(?:的声明与占位符全部配对|\s*=)/g],
  ["devDeps", /仅\s*(\d+)\s*个 devDependencies/g],
];

/** 从文本提取"数字声明" → key → [{n, line, source}] */
export function extractClaims(text, source = "AGENTS.md") {
  const claims = new Map();
  const lines = text.split("\n");
  for (const [key, re] of CLAIM_PATTERNS) {
    const values = [];
    lines.forEach((ln, i) => {
      for (const m of ln.matchAll(re)) values.push({ n: Number(m[1]), line: i + 1, source });
    });
    claims.set(key, { values, pattern: re.source });
  }
  return claims;
}

/**
 * JSON 真源里所有字符串值同样参与提取。
 * MODULE-MANIFEST.json 是机器读的, 但它的数字**同样会漂** (而且没人用眼睛看) ——
 * 它自述"资源归类单一真源", 真源里的数字没有门禁是最坏的一种。
 */
export function extractClaimsFromJson(value, source = CLAIM_JSON) {
  const merged = new Map(CLAIM_PATTERNS.map(([k, re]) => [k, { values: [], pattern: re.source }]));
  const walk = (node) => {
    if (typeof node === "string") {
      for (const [k, v] of extractClaims(node, source)) merged.get(k).values.push(...v.values);
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") return Object.values(node).forEach(walk);
  };
  walk(value);
  return merged;
}

/** 合并多来源声明; values 保留 source 以便报错时定位到具体文件 */
export function mergeClaims(...maps) {
  const out = new Map();
  for (const m of maps) {
    for (const [k, v] of m) {
      if (!out.has(k)) out.set(k, { values: [], pattern: v.pattern });
      out.get(k).values.push(...v.values);
    }
  }
  return out;
}

/**
 * 每个插件条目 reason 里的「N 个域」声明 ↔ 该插件 `[Rule]` 段实测 DOMAIN 行数。
 *
 * 为什么单独做: 这类声明在 manifest 里有十余条, 且**必然**随插件增删域而漂 ——
 * 它不属于"全局一个数"的形态, 无法用 CLAIM_PATTERNS 的全局正则断言 (会把
 * "共 38 域"这种汇总与逐插件声明混为一谈, 互相判成矛盾)。
 */
export function checkPluginDomains(root = ROOT) {
  const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
  const manifest = JSON.parse(read(CLAIM_JSON));
  // 逐行状态机, 与 test/cases/dns-liveness.test.js 同口径。
  // ⚠️ 不要改用 `^\[Rule\]\n([\s\S]*?)(?=^\[)` 这类正则: 插件里 [Rule] 常是最后一段,
  // 前瞻找不到下一个 `[` 就整体不匹配 → 实测恒为 0, 门禁静默失效 (本工具首版即踩此坑)。
  const countRuleDomains = (txt) => {
    let sec = null;
    let n = 0;
    for (const l of txt.split("\n")) {
      const t = l.trim();
      if (/^\[[A-Za-z ]+\]$/.test(t)) { sec = t; continue; }
      if (sec === "[Rule]" && t && !t.startsWith("#") && /^DOMAIN/.test(t)) n++;
    }
    return n;
  };
  const rows = [];
  const fails = [];
  for (const mod of manifest.modules || []) {
    for (const p of mod.plugins || []) {
      const m = String(p.reason || "").match(/(\d+)\s*个?\s*域/);
      if (!m) continue; // 用 functionId / [Rewrite] 计数的条目不在本断言范围
      const actual = countRuleDomains(read(path.join("Plugin", p.file)));
      const claimed = Number(m[1]);
      const ok = claimed === actual;
      rows.push({ ok, label: `${mod.id} ${p.file} 域数`, detail: `声明 ${claimed} ↔ 实测 ${actual}` });
      if (!ok) fails.push({ file: p.file, module: mod.id, claim: claimed, actual, reason: "mismatch" });
    }
  }
  return { fails, rows };
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

  // 2. [Rule] 非注释非空行 ([Rule] 起至 [Remote Rule] 止) + 其中含 REJECT 者
  const lcf = read(path.join("Profile", "Loon.lcf")).split("\n");
  let inRule = false;
  let ruleLines = 0;
  let rejectRules = 0;
  for (const ln of lcf) {
    const t = ln.trim();
    if (t === "[Rule]") { inRule = true; continue; }
    if (t === "[Remote Rule]") { inRule = false; continue; }
    if (inRule && t && !t.startsWith("#")) {
      ruleLines++;
      if (/REJECT/.test(t)) rejectRules++;
    }
  }

  // 3-5. 产物与插件计数; 6-7. package.json
  const scripts = fs.readdirSync(path.join(root, "Scripts")).filter((x) => x.endsWith(".js"));
  const plugins = fs.readdirSync(path.join(root, "Plugin")).filter((x) => x.endsWith(".plugin"));
  const pkg = JSON.parse(read("package.json"));
  return {
    testCases,
    ruleLines,
    rejectRules,
    scripts: scripts.length,
    plugins: plugins.length,
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
    const srcs = [...new Set(c.values.map((v) => v.source).filter(Boolean))];
    const at = srcs.length ? ` [${srcs.join(" / ")}]` : "";
    const distinct = [...new Set(c.values.map((v) => v.n))];
    if (distinct.length > 1) {
      rows.push({ ok: false, label, detail: `文档自相矛盾: ${distinct.join(" vs ")}${at}` });
      fails.push({ key, claim: distinct, actual, reason: "contradiction" });
      return;
    }
    const ok = distinct[0] === actual;
    rows.push({ ok, label, detail: `文档 ${distinct[0]} ↔ 实测 ${actual}${at}` });
    if (!ok) fails.push({ key, claim: distinct[0], actual, reason: "mismatch" });
  };

  expect("testCases", measured.testCases, "npm test 用例数");
  expect("scriptArtifacts", measured.scripts, "Scripts 产物数");
  expect("ruleLines", measured.ruleLines, "[Rule] 非注释行数");
  expect("rejectRules", measured.rejectRules, "[Rule] 含 REJECT 行数");
  expect("pluginTotal", measured.plugins, "插件总数 (Plugin)");
  expect("devDeps", measured.devDeps, "devDependencies 数");

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
  const texts = CLAIM_FILES.map((f) => ({ f, text: fs.readFileSync(path.join(ROOT, f), "utf8") }));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, CLAIM_JSON), "utf8"));
  const claims = mergeClaims(
    ...texts.map(({ f, text }) => extractClaims(text, f)),
    extractClaimsFromJson(manifest, CLAIM_JSON)
  );
  const measured = await measure(ROOT);
  const agentsText = (texts.find((t) => t.f === "AGENTS.md") || {}).text || "";
  const { fails, rows } = check(claims, measured, { claimsText: agentsText });
  const domains = checkPluginDomains(ROOT);

  if (!quiet) {
    console.log("── 文档主张 ↔ 产物实测 ──");
    for (const r of rows) console.log(`${r.ok ? "✅" : "❌"} ${r.label}: ${r.detail}`);
    console.log(`── 插件域数声明 (${CLAIM_JSON}) ↔ 插件本体 ──`);
    for (const r of domains.rows) console.log(`${r.ok ? "✅" : "❌"} ${r.label}: ${r.detail}`);
  }
  const total = fails.length + domains.fails.length;
  if (total) {
    console.log(`✗ 文档主张核对失败: ${total} 处漂移`);
    process.exit(1);
  }
  console.log(`✅ 文档主张核对通过: ${rows.length + domains.rows.length} 项声明与实测一致`);
}

if (isMain()) main();
