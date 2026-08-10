/**
 * 接线完整性检查 — node test/wiring-check.js
 *
 * 审计修复 (2026-08): 防止"写了插件/脚本但没接线"的死代码回归:
 *   1. 每个 Plugin/*.plugin 必须被 template/loon.tpl 引用 (反向: 引用的插件必须存在)
 *   2. 每个 Scripts/*.js (不含 lib/) 必须被任一模板或插件引用 (反向: 引用的脚本必须存在)
 *   3. 每个 QX/apple/*.conf 必须被 template/quantumultx.tpl 引用 (反向: 引用的模块必须存在)
 *   4. loon.tpl 引用的 Kelee/* 与 Mirror/* 插件文件必须存在
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
const qxTpl = read("template/quantumultx.tpl");

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
const allRefs = [loonTpl, qxTpl]
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

// ── 3. QX Apple 模块双向接线检查 ──
console.log("── QX/apple ↔ quantumultx.tpl ──");
const qxAppleFiles = fs
  .readdirSync(path.join(root, "QX/apple"))
  .filter((f) => f.endsWith(".conf"))
  .sort();
for (const f of qxAppleFiles) {
  log(qxTpl.includes(`QX/apple/${f}`), `QX/apple/${f} 被 quantumultx.tpl 引用`);
}
for (const m of qxTpl.matchAll(/main\/QX\/apple\/([\w.-]+\.conf)/g)) {
  const name = m[1];
  log(fs.existsSync(path.join(root, "QX/apple", name)), `quantumultx.tpl 引用 QX/apple/${name} 存在`);
}

console.log("");
if (fail) {
  console.log(`❌ 接线检查失败: ${fail} 处问题 — 死代码或失效引用, 禁止合并`);
  process.exit(1);
}
console.log("✅ 接线完整性检查通过: 无死代码, 无失效引用");