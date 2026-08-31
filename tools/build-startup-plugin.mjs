#!/usr/bin/env node
/**
 * 开屏通杀插件数据化生成器 (2026-08-31)
 *
 * 输入: Mirror/rules/ddgksf-StartUpAds.conf (ddgksf2013 墨鱼 StartUpAds, QX 格式, 每日镜像)
 * 输出: Plugin/startup-adblock-pro.plugin (Loon 插件)
 *
 * 转换:
 *   QX `<regex> url reject[-xxx]`  →  Loon [Rewrite] `<regex> reject[-xxx] enable={ENABLE_STARTUP}`
 *   (Loon [Rewrite] 原生支持 reject/reject-200/reject-dict/reject-img, 语义与 QX 一致, 仅需去掉 url 标记)
 *   upstream `hostname = ...`      →  [MitM] %APPEND% 最小化子集 (仅保留被 reject 规则消费的域,
 *                                    判定逻辑与 tools/mitm-orphan-check.mjs 对齐, 防孤儿域门禁失败)
 *
 * 不纳入 (仅统计, 见生成块尾注释与镜像 PR 报告):
 *   - script 型条目 (script-response-body 等) — 需单独评估脚本依赖
 *   - QX `host, ..., direct` 条目 — 非 rewrite 语义
 *
 * 用法: node tools/build-startup-plugin.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, "Mirror/rules/ddgksf-StartUpAds.conf");
const OUT = path.join(ROOT, "Plugin/startup-adblock-pro.plugin");

const conf = fs.readFileSync(SRC, "utf8");

// ── 解析上游 ──
const updateTime = (conf.match(/@UpdateTime\s+(\S+)/) || [])[1] || "unknown";
const rejects = []; // { regex, action }
const scripts = [];
let hostRules = 0;
let mitmBody = "";
for (const raw of conf.split("\n")) {
  const line = raw.trim();
  if (!line || line.startsWith("#") || line.startsWith(";")) continue;
  const mr = line.match(/^(\S+)\s+url (reject(?:-[a-z0-9]+)?)$/);
  if (mr) { rejects.push({ regex: mr[1], action: mr[2] }); continue; }
  const ms = line.match(/^(\S+) url (script-\S+) (\S+)$/);
  if (ms) { scripts.push(`${ms[1]} → ${ms[2]} ${ms[3]}`); continue; }
  if (/^host\s*,/i.test(line)) { hostRules++; continue; }
  const mh = line.match(/^hostname\s*=\s*(.+)$/);
  if (mh) mitmBody = mh[1];
}

// 去重 (上游存在同 regex 重复行)
const seen = new Set();
const rules = rejects.filter((r) => !seen.has(r.regex) && seen.add(r.regex));

// ── MitM hostname 最小化: 仅保留被 reject 规则消费的域 ──
// 与 mitm-orphan-check.mjs 方法 B/C 对齐: 根域对齐 或 主标签(≥4)出现在规则文本中
const SUB_TLDS = new Set(["com.cn", "org.cn", "net.cn", "gov.cn", "edu.cn", "com.hk", "co.uk", "co.jp", "com.tw", "co.kr", "com.au"]);
const DOMAIN_RE = /[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+/g;
function rootOf(domain) {
  const p = domain.split(".");
  if (p.length >= 3 && SUB_TLDS.has(p.slice(-2).join("."))) return p.slice(-3).join(".");
  return p.slice(-2).join(".");
}
const rootSet = new Set();
const ruleText = rules.map((r) => r.regex.toLowerCase()).join("\n");
for (const r of rules) {
  const s = r.regex.replace(/\\\./g, ".").replace(/\\d/g, "d").replace(/\\\*/g, "*");
  const m = s.match(DOMAIN_RE);
  if (m) for (const d of m) rootSet.add(rootOf(d.toLowerCase()));
}
const upstreamHosts = [...new Set(
  mitmBody.split(",").map((h) => h.trim()).filter((h) => h && !h.startsWith("-")),
)];
const keptHosts = [];
const droppedHosts = [];
for (const h of upstreamHosts) {
  const root = rootOf(h.replace(/\*/g, "").toLowerCase());
  const label = root.split(".")[0];
  if (rootSet.has(root) || (label.length >= 4 && ruleText.includes(label))) keptHosts.push(h);
  else droppedHosts.push(h);
}

// ── 生成插件 (头部 + 手写补充块 + 生成块) ──
const header = `#!name=墨鱼去开屏广告 Pro v3.0
#!desc=覆盖数百个 App 的开屏广告通杀过滤 · ddgksf2013 StartUpAds 每日数据化同步 + 手写补充
#!version=3.0
#!author=3kaiu (数据源 ddgksf2013, 参考 blackmatrix7)
#!homepage=https://github.com/3kaiu/config
#!icon=https://icons.duckduckgo.com/ip3/splash.*.ico
#!system = iOS,iPadOS,macOS
#!loon_version = 3.2.4(787)

#!arguments-desc=\\n- \\{ENABLE_STARTUP}: ["true","false"],tag=总开关，desc=开启后过滤所有 App 开屏广告\\n- \\{STARTUP_DEBUG}: switch,"false","true",tag=调试模式，desc=输出详细日志

[Argument]
ENABLE_STARTUP=switch,"true","false",tag=总开关，desc=开启后过滤所有 App 开屏广告
STARTUP_DEBUG=switch,"false","true",tag=调试模式，desc=输出详细日志

[Script]
# ════════════════════════════════════════
# ⏰ Cron 定时任务（可选）
# ════════════════════════════════════════

[Rewrite]
# ── 🎬 开屏广告通杀层 (ddgksf2013 风格) ────────────────────
`;

// 手写补充块: 从现有插件提取 (BEGIN/END 标记之间, 无标记则取整个手写段)
const BEGIN_MANUAL = "# === BEGIN 3kaiu 手写补充 ===";
const END_MANUAL = "# === END 3kaiu 手写补充 ===";
let manualBlock = "";
if (fs.existsSync(OUT)) {
  const cur = fs.readFileSync(OUT, "utf8");
  const i = cur.indexOf(BEGIN_MANUAL), j = cur.indexOf(END_MANUAL);
  if (i >= 0 && j > i) manualBlock = cur.slice(i + BEGIN_MANUAL.length, j).replace(/^\n+|\n+$/g, "");
}
if (!manualBlock) {
  // 首次迁移: 提取旧插件 [Rewrite] 段的全部手写规则 (reject 行及其注释分组)
  const cur = fs.readFileSync(OUT, "utf8");
  const seg = (cur.split(/\n\[Rewrite\]/)[1] || "").split(/\n\[[A-Za-z ]+\]/)[0] || "";
  manualBlock = seg.replace(/^\n+|\n+$/g, "").replace(/^# ──.*$/gm, "").replace(/\n{3,}/g, "\n\n");
}
// 手写块内与上游重复的 regex 剔除 (避免重复规则)
const manualLines = manualBlock.split("\n").filter((l) => {
  const m = l.trim().match(/^(\^\S+) reject/);
  return !(m && seen.has(m[1]));
});

const BEGIN_GEN = "# === BEGIN ddgksf2013 StartUpAds 自动生成 (勿手改, 由 tools/build-startup-plugin.mjs 维护) ===";
const END_GEN = "# === END ddgksf2013 StartUpAds 自动生成 ===";
const genLines = rules.map((r) => {
  // 上游部分规则未加 ^ 锚 (均以 https? 开头, 补锚语义等价), 仓库 plugin-lint 门禁要求 ^ 起始
  const re = r.regex.startsWith("^") ? r.regex : `^${r.regex}`;
  return `${re} ${r.action} enable={ENABLE_STARTUP}`;
});

const out = `${header}
${BEGIN_MANUAL}
${manualLines.join("\n")}
${END_MANUAL}

${BEGIN_GEN}
# 来源: https://ddgksf2013.top/rewrite/StartUpAds.conf (镜像 ifflagged/Romeo, @UpdateTime ${updateTime})
# 转换: QX url reject[-xxx] → Loon rewrite, 共 ${rules.length} 条 (上游 ${rejects.length} 行, 去重 ${rejects.length - rules.length} 条)
# 未纳入: ${scripts.length} 条 script 型 + ${hostRules} 条 host 型 (见工具脚本注释)
${genLines.join("\n")}
${END_GEN}

[MitM]
# ⚠️ 注意：部分 App 禁用了 MITM，无法拦截其开屏广告
# 通配兜底 (手写补充层) + 上游 hostname 最小化子集 (${keptHosts.length}/${upstreamHosts.length} 条, 仅被 reject 规则消费的域)
hostname = %APPEND% splash.*, ad.*, flash.*, ${keptHosts.join(", ")}
`;

fs.writeFileSync(OUT, out);

console.log(`✅ ${path.relative(ROOT, OUT)} 已生成 (上游 @UpdateTime ${updateTime})`);
console.log(`   reject 规则: ${rules.length} 条 (上游 ${rejects.length} 行, 去重 ${rejects.length - rules.length})`);
console.log(`   未纳入 script 型: ${scripts.length} 条 / host 型: ${hostRules} 条`);
console.log(`   MitM hostname: 保留 ${keptHosts.length} / 上游 ${upstreamHosts.length} (剔除未被消费 ${droppedHosts.length})`);
console.log("\n── 未纳入的 script 型条目 (供后续决策) ──");
for (const s of scripts) console.log(`   ${s}`);
