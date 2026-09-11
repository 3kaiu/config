/**
 * 接线完整性检查 — node test/wiring-check.js
 *
 * 审计修复 (2026-08): 防止"写了插件/脚本但没接线"的死代码回归:
 *   1. 每个 Plugin/*.plugin 必须被 template/loon.tpl 引用 (反向: 引用的插件必须存在)
 *   2. 每个 Scripts/*.js (不含 lib/) 必须被任一模板或插件引用 (反向: 引用的脚本必须存在)
 *   3. loon.tpl 引用的 Kelee/* 与 Mirror/* 插件文件必须存在
 *
 * 用法: node test/wiring-check.js   (退出码 0 = 通过)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
let fail = 0;
const log = (ok, msg) => {
  console.log((ok ? "✅ " : "❌ ") + msg);
  if (!ok) fail++;
};

function read(p) {
  return fs.readFileSync(path.join(root, p), "utf8");
}

const loonTpl = read("template/loon.tpl");

const pluginSrcs = fs
  .readdirSync(path.join(root, "Plugin"))
  .filter((f) => f.endsWith(".plugin"))
  .sort();

// ── 1. 自维护插件双向接线检查 ──
console.log("── Plugin ↔ loon.tpl ──");
for (const f of pluginSrcs) {
  log(loonTpl.includes(`Plugin/${f}`), `Plugin/${f} 被 loon.tpl 引用`);
}
for (const m of loonTpl.matchAll(/main\/Plugin\/([\w.-]+\.plugin)/g)) {
  const name = m[1];
  log(fs.existsSync(path.join(root, "Plugin", name)), `loon.tpl 引用 Plugin/${name} 存在`);
}
for (const m of loonTpl.matchAll(/main\/(Kelee|Mirror\/[a-z0-9-]+)\/([\w.-]+\.plugin)/g)) {
  const sub = m[1];
  const name = m[2];
  log(fs.existsSync(path.join(root, sub, name)), `loon.tpl 引用 ${sub}/${name} 存在`);
}

// ── 2. 脚本双向接线检查 ──
console.log("── Scripts ↔ 引用 ──");
const allRefs = [loonTpl]
  .concat(pluginSrcs.map((f) => read(path.join("Plugin", f))))
  .join("\n");
const scriptFiles = fs
  .readdirSync(path.join(root, "Scripts"))
  .filter((f) => f.endsWith(".js") && !f.startsWith("lib/"))
  .sort();
for (const f of scriptFiles) {
  log(allRefs.includes(`Scripts/${f}`), `Scripts/${f} 被模板或插件引用`);
}
for (const m of allRefs.matchAll(/Scripts\/([\w.-]+\.js)/g)) {
  const name = m[1];
  if (name.startsWith("lib/")) continue;
  log(fs.existsSync(path.join(root, "Scripts", name)), `引用 Scripts/${name} 存在`);
}

// ── 4. tools/ 接线检查 (2026-09-11 深度审计 NEW-10) ──
// 背景: 审计结论是"不接线的门禁正是本仓库反复发现的'看起来有门禁其实没有'"。当时列出 3 个
// 零接线工具; 本轮按同一判据扫描时又查出**第 4 个** —— `argument-contract-check.mjs`
// (MOD-13 新增, 写了 npm script 却从未进任何 workflow)。说明"人肉记得接线"不可靠, 故固化。
// 判据: 被某个 workflow 引用, **或**被 `test/**` 引用 (经 `npm test` 在 CI 执行)。
//   ⚠️ 刻意**不**把 `package.json` 的 `check:*` 当作"已接线" —— argument-contract-check 正是
//   "有 npm script 但没进 CI" 的形态, 若把它算作已接线, 这条规则就永远抓不到那类缺陷。
// 确实只能人工运行的须进下方白名单并给出理由。
console.log("── tools/*.mjs ↔ workflow/test 引用 ──");
const LOCAL_ONLY_PREFIXES = [
  [
    "tools/rewrite-migrate/",
    "一次性迁移工具包 (旧→新 rewrite 语法转换 + 可逆回退), 由人工在 Loon 版本切换时运行; 见 CHANGELOG",
  ],
];
const workflowDir = path.join(root, ".github", "workflows");
const workflowText = fs
  .readdirSync(workflowDir)
  .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
  .map((f) => fs.readFileSync(path.join(workflowDir, f), "utf8"))
  .join("\n");
// test/ 全量文本 (含 cases/) — 被测试引用 = 经 npm test 进 CI
const testDir = path.join(root, "test");
function collectTestText(dir) {
  let acc = "";
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) acc += collectTestText(p);
    else if (/\.(js|mjs)$/.test(ent.name)) acc += fs.readFileSync(p, "utf8");
  }
  return acc;
}
const testText = collectTestText(testDir);
const wiredText = workflowText + "\n" + testText;

function walkTools(dir, acc) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTools(p, acc);
    else if (ent.name.endsWith(".mjs")) acc.push(path.relative(root, p).split(path.sep).join("/"));
  }
  return acc;
}
for (const rel of walkTools(path.join(root, "tools"), []).sort()) {
  const exempt = LOCAL_ONLY_PREFIXES.find(([p]) => rel.startsWith(p));
  if (exempt) {
    console.log(`ℹ️  ${rel} — 白名单 (人工运行): ${exempt[1]}`);
    continue;
  }
  log(wiredText.includes(rel), `${rel} 被某个 workflow 或 test/ 引用 (或在 wiring-check 白名单中)`);
}
// 反向: workflow 里引用的 tools/ 路径必须存在
for (const m of workflowText.matchAll(/tools\/([\w./-]+\.mjs)/g)) {
  log(fs.existsSync(path.join(root, "tools", m[1])), `workflow 引用 tools/${m[1]} 存在`);
}
// package.json 的 check:* / audit:* script 指向的文件必须存在
const pkg = JSON.parse(read("package.json"));
for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
  if (!/^(check|audit):/.test(name)) continue;
  for (const m of String(cmd).matchAll(/tools\/([\w./-]+\.mjs)/g)) {
    log(fs.existsSync(path.join(root, "tools", m[1])), `npm run ${name} 引用的 tools/${m[1]} 存在`);
  }
}

// ── 5. 接线完整性总结 ──
console.log("");
if (fail) {
  console.log(`❌ 接线检查失败: ${fail} 处问题 — 死代码或失效引用, 禁止合并`);
  process.exit(1);
}
console.log("✅ 接线完整性检查通过: 无死代码, 无失效引用");