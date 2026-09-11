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
 *
 * 入口守卫 (2026-09-11 深度审计): 纯函数已 export 供 test/cases 单测引用,
 * 因此 main() 不得在模块顶层无条件调用 (会改写 Plugin/ 产物)。
 * workflow 以 `node tools/build-startup-plugin.mjs` 调用 → 仍是入口 → 行为不变。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, "Mirror/rules/ddgksf-StartUpAds.conf");
const OUT = path.join(ROOT, "Plugin/startup-adblock-pro.plugin");

const SUB_TLDS = new Set(["com.cn", "org.cn", "net.cn", "gov.cn", "edu.cn", "com.hk", "co.uk", "co.jp", "com.tw", "co.kr", "com.au"]);
const DOMAIN_RE = /[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+/g;

export { SUB_TLDS, DOMAIN_RE };

// ── 解析上游 ──
export function parseConf(conf) {
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
  return { updateTime, rejects, scripts, hostRules, mitmBody };
}

export function hostOf(regex) {
  const m = regex.replace(/^\^/, "").match(/^https?\??:\\?\/\\?\/([^/]+)/);
  if (!m) return "";
  return m[1].replace(/\\\./g, ".").replace(/\\+$/, ""); // 去转义 + 吞掉 `\.` 切分残留的尾反斜杠
}

export function validHost(h) {
  if (!h) return false;
  if (/[[(*+\\]/.test(h)) return true; // 上游通配写法 (字符类/分组), 保留
  if (!h.includes(".")) return false;
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(h)) return false; // 日期当 host (上游转换垃圾)
  if (/^[0-9.]+$/.test(h)) return /^\d{1,3}(\.\d{1,3}){3}$/.test(h); // 纯数字仅保留合法 IPv4 字面量
  return true;
}

export function rootOf(domain) {
  const p = domain.split(".");
  if (p.length >= 3 && SUB_TLDS.has(p.slice(-2).join("."))) return p.slice(-3).join(".");
  return p.slice(-2).join(".");
}

/**
 * hostname 边界安全判定 (2026-09-11 深度审计 NEW-09)。
 *
 * 上游 hostname 是**不可信输入**。`validHost()` 对含 `*` 的写法一律放行,
 * 于是 `*ziben.com` / `*.flyert.*` 这类模式被原样透传进 [MitM] hostname,
 * 使 Loon 对**非预期域**开启 HTTPS 解密 (解密面扩张, 与最小范围原则相悖)。
 *
 * 判据: 一条模式安全 ⟺ 所有匹配它的主机都落在同一个注册域内。据此:
 *   ① 末段 (TLD 位) 含 `*`  → 可匹配任意 TLD (`*.flyert.*`, `api-…*com`, `120.241.*`)
 *   ② 去掉公共后缀后, 末段 (二级域) 含 `*` → 通配直接改写注册域 (`*ziben.com`, `*.xima*.com`)
 *   ③ 通配出现在更右侧标签 → 跨标签吞点 (`a.*.com`)
 * 安全的两种形态: 裸 `*.suffix` (后缀具体), 或通配与字面量同处**最左**标签 (`pinggai*.caixin.com`)。
 */
export function isBoundaryUnsafe(h) {
  const labels = h.split(".");
  if (labels.some((l) => !l)) return true; // 空标签 (前导点 / `..com`)
  if (!labels.some((l) => l.includes("*"))) return false;
  // ① TLD 位含通配
  if (labels[labels.length - 1].includes("*")) return true;
  // ② 二级域含通配 (公共后缀按 1 段 / 2 段剥离)
  const sub = SUB_TLDS.has(labels.slice(-2).join(".")) ? labels.slice(0, -2) : labels.slice(0, -1);
  if (sub.length === 0) return true;
  if (sub[sub.length - 1].includes("*")) return true;
  // ③ 通配只允许在最左标签
  for (let i = 1; i < sub.length; i++) if (sub[i].includes("*")) return true;
  return false;
}

/**
 * 规范化上游 hostname → { hosts, unsafe }。
 *
 *   ① `*<label>.<suffix>` (前导 `*` 后**无点**, 且其余部分无通配)
 *      → 无损展开: `<label>.<suffix>` + `*.<label>.<suffix>`
 *      (原语义 `*ziben.com` = 裸域 + 任意子域, 展开后覆盖不变、且不再命中 evilziben.com)
 *   ② 其余边界不安全形态 (通配落在 TLD 位或二级域中段) 无法无损表达 → unsafe, 剔除
 *   ③ 安全形态 → 原样返回
 *
 * 注意 `isBoundaryUnsafe()` 是**纯判定**: 对 `*ziben.com` 同样返回 true (它确实能匹配
 * 非预期注册域)。本函数在其之上给出"可否无损修复"的动作决策, 二者分工不同。
 */
export function normalizeHost(h) {
  if (h[0] === "*" && h[1] !== ".") {
    const rest = h.slice(1);
    if (!rest.includes("*")) return { hosts: [rest, `*.${rest}`], unsafe: false };
    return { hosts: [], unsafe: true };
  }
  if (isBoundaryUnsafe(h)) return { hosts: [], unsafe: true };
  return { hosts: [h], unsafe: false };
}

/** 去重 (上游存在同 regex 重复行) + host 合法性过滤 */
export function buildRules(rejects) {
  const seen = new Set();
  let droppedGarbage = 0;
  const rules = rejects
    .filter((r) => !seen.has(r.regex) && seen.add(r.regex))
    .filter((r) => {
      if (validHost(hostOf(r.regex))) return true;
      droppedGarbage++;
      return false;
    });
  return { rules, seen, droppedGarbage };
}

/**
 * MitM hostname 最小化: 仅保留被 reject 规则消费的域
 * (与 mitm-orphan-check.mjs 方法 B/C 对齐: 根域对齐 或 主标签(≥4)出现在规则文本中),
 * 再剔除边界不安全通配 (NEW-09)。
 */
export function minimizeHosts(upstreamHosts, rules) {
  const rootSet = new Set();
  const ruleText = rules.map((r) => r.regex.toLowerCase()).join("\n");
  for (const r of rules) {
    const s = r.regex.replace(/\\\./g, ".").replace(/\\d/g, "d").replace(/\\\*/g, "*");
    const m = s.match(DOMAIN_RE);
    if (m) for (const d of m) rootSet.add(rootOf(d.toLowerCase()));
  }
  const kept = [];
  const dropped = [];
  const unsafe = [];
  const seenHosts = new Set();
  for (const h of upstreamHosts) {
    const root = rootOf(h.replace(/\*/g, "").toLowerCase());
    const label = root.split(".")[0];
    if (!(rootSet.has(root) || (label.length >= 4 && ruleText.includes(label)))) { dropped.push(h); continue; }
    const { hosts, unsafe: isUnsafe } = normalizeHost(h);
    if (isUnsafe) { unsafe.push(h); continue; }
    for (const e of hosts) {
      if (seenHosts.has(e)) continue;
      seenHosts.add(e);
      kept.push(e);
    }
  }
  return { kept, dropped, unsafe };
}

export function upstreamHostsOf(mitmBody) {
  return [...new Set(mitmBody.split(",").map((h) => h.trim()).filter((h) => h && !h.startsWith("-")))];
}

// ── 生成插件 (头部 + 手写补充块 + 生成块) ──
// 注意: [Argument] 与 #!arguments-desc 必须严格配对且**不得含死开关**
// (check:contract / argument-contract-check.mjs 会拦)。STARTUP_DEBUG 于
// 2026-09-11 MOD-05 作为 vestigial 参数从插件移除, 生成器模板此前未同步 —
// 若此处再加回来, 下一次镜像 run 会产出 check:contract 判红的插件。
const HEADER = `#!name=墨鱼去开屏广告 Pro v3.0
#!desc=覆盖数百个 App 的开屏广告通杀过滤 · ddgksf2013 StartUpAds 每日数据化同步 + 手写补充
#!version=3.0
#!author=3kaiu (数据源 ddgksf2013, 参考 blackmatrix7)
#!homepage=https://github.com/3kaiu/config
#!icon=https://icons.duckduckgo.com/ip3/splash.*.ico
#!system = iOS,iPadOS,macOS
#!loon_version = 3.2.4(787)

#!arguments-desc=\\n- \\{ENABLE_STARTUP}: ["true","false"],tag=总开关，desc=开启后过滤所有 App 开屏广告

[Argument]
ENABLE_STARTUP=switch,"true","false",tag=总开关，desc=开启后过滤所有 App 开屏广告

[Script]
# ════════════════════════════════════════
# ⏰ Cron 定时任务（可选）
# ════════════════════════════════════════

[Rewrite]
# ── 🎬 开屏广告通杀层 (ddgksf2013 风格) ────────────────────
`;

export const BEGIN_MANUAL = "# === BEGIN 3kaiu 手写补充 ===";
export const END_MANUAL = "# === END 3kaiu 手写补充 ===";
export const BEGIN_GEN = "# === BEGIN ddgksf2013 StartUpAds 自动生成 (勿手改, 由 tools/build-startup-plugin.mjs 维护) ===";
export const END_GEN = "# === END ddgksf2013 StartUpAds 自动生成 ===";

/** 手写补充块: 从现有插件提取 (BEGIN/END 标记之间, 无标记则取整个手写段) */
export function extractManualBlock(cur) {
  const i = cur.indexOf(BEGIN_MANUAL), j = cur.indexOf(END_MANUAL);
  if (i >= 0 && j > i) return cur.slice(i + BEGIN_MANUAL.length, j).replace(/^\n+|\n+$/g, "");
  // 首次迁移: 提取旧插件 [Rewrite] 段的全部手写规则 (reject 行及其注释分组)
  const seg = (cur.split(/\n\[Rewrite\]/)[1] || "").split(/\n\[[A-Za-z ]+\]/)[0] || "";
  return seg.replace(/^\n+|\n+$/g, "").replace(/^# ──.*$/gm, "").replace(/\n{3,}/g, "\n\n");
}

export function renderPlugin({ updateTime, rules, rejects, seen, droppedGarbage, scripts, hostRules, manualBlock, kept, dropped, unsafe, upstreamCount }) {
  // 手写块内与上游重复的 regex 剔除 (避免重复规则)
  const manualLines = manualBlock.split("\n").filter((l) => {
    const m = l.trim().match(/^(\^\S+) reject/);
    return !(m && seen.has(m[1]));
  });
  const genLines = rules.map((r) => {
    // 上游部分规则未加 ^ 锚 (均以 https? 开头, 补锚语义等价), 仓库 plugin-lint 门禁要求 ^ 起始
    const re = r.regex.startsWith("^") ? r.regex : `^${r.regex}`;
    return `${re} ${r.action} enable={ENABLE_STARTUP}`;
  });
  const unsafeNote = unsafe.length
    ? `\n# ⛔ 已剔除边界不安全通配 ${unsafe.length} 条 (可匹配非预期注册域, 解密面扩张): ${unsafe.join(", ")}`
    : "";
  return `${HEADER}
${BEGIN_MANUAL}
${manualLines.join("\n")}
${END_MANUAL}

${BEGIN_GEN}
# 来源: https://ddgksf2013.top/rewrite/StartUpAds.conf (镜像 ifflagged/Romeo, @UpdateTime ${updateTime})
# 转换: QX url reject[-xxx] → Loon rewrite, 共 ${rules.length} 条 (上游 ${rejects.length} 行, 去重 ${rejects.length - seen.size} 条, 垃圾host ${droppedGarbage} 条)
# 未纳入: ${scripts.length} 条 script 型 + ${hostRules} 条 host 型 (见工具脚本注释)
${genLines.join("\n")}
${END_GEN}

[MitM]
# ⚠️ 注意：部分 App 禁用了 MITM，无法拦截其开屏广告
# 上游 hostname 最小化子集 (${kept.length}/${upstreamCount} 条, 仅被 reject 规则消费的域)${unsafeNote}
hostname = %APPEND% ${kept.join(", ")}
`;
}

export function main() {
  const conf = fs.readFileSync(SRC, "utf8");
  const { updateTime, rejects, scripts, hostRules, mitmBody } = parseConf(conf);
  const { rules, seen, droppedGarbage } = buildRules(rejects);

  // 下限门禁: 上游被清空/截断时保留旧插件并 fail-red (与 geonode MIN_NODES 同哲学;
  // mirror 整步失败, 次日上游恢复后自愈; 勿改 exit 0, 否则空插件静默上线)
  if (rules.length < 50) {
    console.error(`::error::reject 规则仅 ${rules.length} 条 (<50), 上游疑似被清空 — 保留旧插件`);
    return 1;
  }

  const upstreamHosts = upstreamHostsOf(mitmBody);
  const { kept, dropped, unsafe } = minimizeHosts(upstreamHosts, rules);

  const manualBlock = fs.existsSync(OUT) ? extractManualBlock(fs.readFileSync(OUT, "utf8")) : "";
  const out = renderPlugin({
    updateTime, rules, rejects, seen, droppedGarbage, scripts, hostRules, manualBlock,
    kept, dropped, unsafe, upstreamCount: upstreamHosts.length,
  });

  fs.writeFileSync(OUT, out);

  console.log(`✅ ${path.relative(ROOT, OUT)} 已生成 (上游 @UpdateTime ${updateTime})`);
  console.log(`   reject 规则: ${rules.length} 条 (上游 ${rejects.length} 行, 去重 ${rejects.length - seen.size} 条, 垃圾host ${droppedGarbage} 条)`);
  console.log(`   未纳入 script 型: ${scripts.length} 条 / host 型: ${hostRules} 条`);
  console.log(`   MitM hostname: 保留 ${kept.length} / 上游 ${upstreamHosts.length} (剔除未被消费 ${dropped.length})`);
  if (unsafe.length) {
    console.log(`   ⛔ 剔除边界不安全通配 ${unsafe.length} 条 (NEW-09):`);
    for (const h of unsafe) console.log(`      ${h}`);
  }
  console.log("\n── 未纳入的 script 型条目 (供后续决策) ──");
  for (const s of scripts) console.log(`   ${s}`);
  return 0;
}

const isEntryPoint =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) process.exit(main());
