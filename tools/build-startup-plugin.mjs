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
  // 上游动作原样透传: 16 条裸 `reject` 是上游墨鱼的显式选择 (同 conf 另有 430+
  // 条 reject-200 — 作者知晓 200 形态, 裸 reject 系"无 UI 等待"接口的断连处理,
  // 有意而非遗漏)。故生成块 16 裸 reject 不做本地改写 (改了下次镜像即漂移)。
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

/**
 * 通配 hostname 覆盖报告 (2026-09-19 官方文档对齐 P2-3, **只报告不自动收敛**)。
 *
 * 背景: 上游保留的 `*.suffix` 通配虽经 isBoundaryUnsafe 边界校验 (只匹配单一注册域),
 * 但"通配 = 该注册域**全量子域**解密"的覆盖面本身需要可见性 —— 维护者要能一眼看到
 * 哪条通配被多少条规则消费、是否值得收窄为枚举。自动收敛会改变解密面, 需人工决策,
 * 故本函数只产出数据; main() 打印为报告。
 */
export function wildcardReport(kept, rules) {
  // 根域子串计数: 归一化规则文本后, 含该通配根域即计消费。
  // 与 minimizeHosts 同口径 (判定器), 避免"计数器与判定器口径不一":
  // 旧实现取最左 label 子串 (p*.meituan.net → label "p" 命中 449 条), 现以根域为准。
  // 注意: 归一化后 `pinggai*.caixin.com` → `pinggai.*caixin.com`, 而规则侧
  // `pinggai.*caixin.com` 同形 → 仍命中; 但 `interface*.music.163.com` 等
  // 在 449 条生成规则中无文本对应 → 0 消费 (见下 ZERO_ALLOW 测试)。
  const norm = (s) => s.replace(/\\\./g, ".").replace(/\\\*/g, "*").toLowerCase();
  const ruleText = rules.map((r) => norm(r.regex)).join("\n");
  const rows = [];
  for (const h of kept.filter((x) => x.includes("*"))) {
    const root = rootOf(h.replace(/\*/g, "x")).toLowerCase();
    const n = root ? ruleText.split("\n").filter((line) => line.includes(root)).length : 0;
    rows.push({ host: h, rules: n });
  }
  return rows;
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
export const BEGIN_EXTRA = "# === BEGIN 3kaiu script→原生 reject 精准补充 (由 tools/build-startup-plugin.mjs 维护) ===";
export const END_EXTRA = "# === END 3kaiu script→原生 reject 精准补充 ===";
export const BEGIN_GEN = "# === BEGIN ddgksf2013 StartUpAds 自动生成 (勿手改, 由 tools/build-startup-plugin.mjs 维护) ===";
export const END_GEN = "# === END ddgksf2013 StartUpAds 自动生成 ===";

// ── script 型条目台账 (2026-09-20 精准去广告审计) ────────────────────────────
// 上游墨鱼 StartUpAds 的 script-response-body/header 型条目, 生成器不纳脚本,
// 逐条登记去向, 杜绝"上游新增 script 条目 → 静默泄漏"。status:
//   covered   已由其他层 [Rewrite] path 级覆盖 (2026-09-20 全量核对)
//   extra     已转 EXTRA_REJECTS 本地原生 reject (生成器维护, host 并入 MitM)
//   pending   待真机验证 / 已判定不做 (逐条写明缘由与障碍)
// 新上游条目不在台账 → scriptLedger 判 "unregistered" (报告 ⚠️ + 测试判红)。
export const EXTRA_REJECTS = [
  {
    regex: "^https?:\\/\\/api\\.m\\.jd\\.com\\/api\\?functionId=delivery_show",
    action: "reject-dict",
    host: "api.m.jd.com",
    reason: "京东开屏广告外层 (上游 startup.js); 纯广告 JSON 接口, host 已在解密面, reject-dict 去广告不伤功能",
  },
  {
    regex: "^https?:\\/\\/ccsp-egmas\\.sf-express\\.com\\/cx-app-base\\/base\\/app\\/ad\\/queryInfoFlow",
    action: "reject-dict",
    host: "ccsp-egmas.sf-express.com",
    reason: "顺丰信息流广告 (上游 shunfeng_json.js); 同 host 已有 queryAdImages reject-200 先例, reject-dict 去广告 JSON",
  },
  {
    regex: "^https?:\\/\\/api\\.369cx\\.cn\\/v\\d\\/Splash\\/GetSplashAd",
    action: "reject-200",
    host: "api.369cx.cn",
    reason: "漫画开屏广告 (上游 dict.js); 端点名即 Splash/GetSplashAd, 同文件 430+ 开屏 reject-200 先例; host 为此新入 MitM 解密面",
  },
  {
    regex: "^https?:\\/\\/[^\\/]*zdmimg\\.com\\/cpm\\/api\\/v\\d\\/advert_distribution\\/get_all_advertise",
    action: "reject-dict",
    host: "*.zdmimg.com",
    reason: "什么值得买 CPM 广告分发 (上游 smzdm_json.js); 端点名即 get_all_advertise 纯广告 JSON, path 级精准不伤 zdmimg 图床; Kelee smzdm-remove-ads 同功能先例",
  },
  {
    regex: "^https?:\\/\\/apiproxy\\.zuche\\.com\\/resource\\/cardes\\/toufang\\/marketing",
    action: "reject-dict",
    host: "apiproxy.zuche.com",
    reason: "神州租车营销投放 (上游 dict.js); 路径名即 toufang/marketing 纯营销 JSON, path 级精准不伤租车功能接口; 同生成块 reject-dict 先例",
  },
];

/**
 * 上游有 rule 无 hostname 的纯广告域补齐 (2026-09-22 全仓解密面抽查)。
 *
 * 入选标准 (缺一不可, 逐条 DoH 实测 Status 0 存活: 2026-09-22):
 *   ① 规则路径即广告语义 (/site/ad|advertisements|/adv|i_adverseInterface|
 *     start_ad|top_notice|xgapp.php) — 整 host 流量即广告, 解密面零功能风险
 *   ② 非 App 主功能 host (pinning 风险低; pinduoduo/musical.ly 等混合 host 不入)
 *   ③ isBoundaryUnsafe 判定安全 (精确域或裸 *.suffix)
 * 未入选的一律保持 orphan 登记待真机: 混合 host 13 (pinning 未知) /
 * pzoap.moedot.net (DoH NXDOMAIN, 上游规则已实质死亡) /
 * cdn.dianshihome.com (DoH SERVFAIL, 存在性不可判定) /
 * kugou×4 (alternation 无法安全展开) / mangaapi.manhuaren (TLD 位通配无法表达)。
 */
export const EXTRA_HOSTS = [
  { host: "open.78dm.net", reason: "78dm 开屏 `/v1/site/ad/` 纯广告接口" },
  { host: "api4.bybutter.com", reason: "bybutter `/placements/*/advertisements` 纯广告 API" },
  { host: "cmt.comp.360os.com", reason: "360os `/adv` 纯广告接口" },
  { host: "aikanvod.miguvideo.com", reason: "咪咕 `i_adverseInterface.jsp` 纯广告接口" },
  { host: "siteapi.zaixs.com", reason: "zaixs `/*/start_ad` 开屏广告" },
  { host: "qcwx.medproad.com", reason: "medproad `:8080/ad/` 纯广告接口 (去 :port 精确匹配)" },
  { host: "js-ad.ayximgs.com.ad-universe-cdn.hzhcbkj.cn", reason: "hzhcbkj `xgapp.php` 广告 SDK (ad-universe-cdn 即广告基建)" },
  { host: "*.admobile.top", reason: "admobile `[..]+.admobile.top` 广告域族, 裸后缀安全形态" },
  { host: "tk.lanjiyin.com.cn", reason: "lanjiyin `/ad/getAdList` — DoH 实测 .com.cn 存活而 MitM/上游仅有 .com (TLD 打架, 以规则侧为准)" },
];

/** [token, status, note] — token 取 path 级唯一锚 (见 scriptLedger 匹配) */
export const SCRIPT_LEDGER = [
  // covered: 已由其他层 path 级覆盖 (2026-09-20 全量核对)
  ["index_recommend", "covered", "video-community-purify.plugin (555Ad)"],
  ["123pan", "covered", "Mirror/rules/loon-AllInOne.plugin"],
  ["getAdList", "covered", "AllInOne + social-netdisk-purify"],
  ["mobileDispatch", "covered", "shopping-purify / amap"],
  ["ahhhhfs", "covered", "AllInOne"],
  ["phpui2", "covered", "AllInOne (baidumap Ads)"],
  ["gg\\.caixin", "covered", "AllInOne (财新广告)"],
  ["cupid", "covered", "iqiyi-pro + AdvertisingScript"],
  ["coolapk", "covered", "social-netdisk-purify + AllInOne"],
  ["open-cms", "covered", "social-netdisk-purify (quark/UC)"],
  ["pupuapi", "covered", "shopping-purify (pupu 营销 banner)"],
  ["teamair", "covered", "AllInOne (起点/Qidian)"],
  ["launch_v2", "covered", "zhihu-pro + AdvertisingScript"],
  // extra: 已转 EXTRA_REJECTS 本地原生 reject
  ["GetSplashAd", "extra", "EXTRA_REJECTS[2] 369cx 开屏 reject-200"],
  ["delivery_show", "extra", "EXTRA_REJECTS[0] 京东开屏 reject-dict"],
  ["queryInfoFlow", "extra", "EXTRA_REJECTS[1] 顺丰信息流 reject-dict"],
  ["get_all_advertise", "extra", "EXTRA_REJECTS[3] 值得买 CPM reject-dict (2026-09-22 P0-3)"],
  ["cardes", "extra", "EXTRA_REJECTS[4] 神州租车营销 reject-dict (2026-09-22 P0-3)"],
  // pending: 待真机验证 / 已判定不做
  ["getCommonMixData", "pending", "百视TV 信息流: host 已解密, reject 动作形态待真机"],
  ["threadpost", "pending", "飞客茶馆: host 已解密, 待真机"],
  ["umetrip", "pending", "航旅 .com.cn 真身待确认 (umetrip-pro 仅覆盖 .com)"],
  ["indexv", "pending", "IT之家: MitM napi.ithome.com 已在 news-purify/上游; 缺 upstream ithome.js (indexv feed 去广告) 移植 + 真机定形"],
  ["hotWords", "pending", "京东搜索热词系功能接口 (jd_json.js 只剥广告字段), 整拒会砍功能, 不做 — 待上游脚本化"],
  ["mgw\\.htm", "pending", "农行网关页 (上游为 script-response-header), reject 形态待真机"],
  ["api\\.jk\\.cn", "pending", "平安广告接口: 待真机"],
  ["stay-fork", "pending", "深银客户端: 待真机"],
];

/** 把 27 条 script 条目归类为 covered / extra / pending / unregistered */
export function scriptLedger(scripts) {
  return scripts.map((s) => {
    const re = s.split(" → ")[0];
    const hit = SCRIPT_LEDGER.find(([tok]) => re.includes(tok));
    return hit
      ? { line: s, regex: re, status: hit[1], note: hit[2] }
      : { line: s, regex: re, status: "unregistered", note: "上游新增 script 条目, 需人工分诊!" };
  });
}

/** 手写补充块: 从现有插件提取 (BEGIN/END 标记之间, 无标记则取整个手写段) */
export function extractManualBlock(cur) {
  const i = cur.indexOf(BEGIN_MANUAL), j = cur.indexOf(END_MANUAL);
  if (i >= 0 && j > i) return cur.slice(i + BEGIN_MANUAL.length, j).replace(/^\n+|\n+$/g, "");
  // 首次迁移: 提取旧插件 [Rewrite] 段的全部手写规则 (reject 行及其注释分组)
  const seg = (cur.split(/\n\[Rewrite\]/)[1] || "").split(/\n\[[A-Za-z ]+\]/)[0] || "";
  return seg.replace(/^\n+|\n+$/g, "").replace(/^# ──.*$/gm, "").replace(/\n{3,}/g, "\n\n");
}

/**
 * 手写块 host → 精确 MitM hostname (2026-09-21 回归修复)。
 *
 * 背景: 4d470bb (生成器引入前) 该插件 [MitM] 靠 `splash.*, ad.*, flash.*` 一级通配
 * 覆盖手写块 host;NEW-09 (f9077ee) 按边界安全原则剔除这些通配, 但生成器 host 归并
 * 只消费**上游 rejects** (`minimizeHosts` 的 `kept`), 从不扫描手写块 → 去掉通配后
 * 手写块规则的精确 host 全部失去解密面, https 规则静默失效。
 *
 * 修复: 扫手写块每条 reject 规则, hostOf() 取 host 表达式 → 展开 alternation
 * `(a|b)` → 精确域 → 边界安全校验 (NEW-09 判据不变) → 并入 [MitM]。
 * 无法安全表达的 (跨标签通配, 如 `api.wan..*.weixin.qq.com`) 不等价于任何精确域,
 * 按 NEW-09 口径剔除并报告 (规则保留但 https 不保证生效, 与上游 unsafe 同待遇)。
 */
export function manualMitmHosts(manualLines) {
  const hosts = [];
  const unsafe = [];
  const seen = new Set();
  const push = (h) => {
    h = h.replace(/\\\./g, ".");
    if (seen.has(h)) return;
    const r = normalizeHost(h);
    if (r.unsafe) { if (!unsafe.includes(h)) unsafe.push(h); return; }
    for (const e of r.hosts) { if (!seen.has(e)) { seen.add(e); hosts.push(e); } }
  };
  for (const line of manualLines) {
    if (!line) continue;
    const m = line.match(/^(\^\S+?)\s+reject/);
    if (!m) continue;
    let h = hostOf(m[1]);
    if (!h || !h.includes(".")) continue;
    // `(a|b)` alternation 展开 → 各自精确域 (ads.api.(yy|6rooms).com → yy + 6rooms)
    if (/\([^()]+\|[^()]+\)/.test(h)) {
      const parts = h.split(/[()]/).filter(Boolean);
      if (parts.length === 3 && parts[1].includes("|")) {
        for (const alt of parts[1].split("|")) push(parts[0] + alt + parts[2]);
        continue;
      }
    }
    // `\d?` 可选数字 (dc\d?.bz.mgtv.com): 现存 [MitM] 已用 `dc?` 通配盖住, 此处不做穷举
    if (/\\d\?/.test(h)) { unsafe.push(`${h} (可选数字, 未并入)`); continue; }
    // 含 `*` 跨标签通配 → 不等价精确域, 剔除 (NEW-09)
    if (h.includes("*")) { unsafe.push(h); continue; }
    push(h);
  }
  return { hosts, unsafe };
}

/**
 * Rewrite 规则 → MitM 解密面覆盖检查 (2026-09-22 1c576f2 回归门禁)。
 *
 * 背景: 1c576f2 误删插件 [MitM] hostname 整行 (422 域): 约 493 条 Rewrite
 * 对 HTTPS 静默失效。既有"产物一致性"只断言字节相等 (报 diff 不定位病因),
 * 本函数逐条回答"每条规则的 host 是否在 MitM 有解密面"。
 * 口径与 minimizeHosts 对齐 (根域比对, SUB_TLDS 同表), 方向相反
 * (规则→host, 而非 host→规则)。
 *
 * 已知局限 (从严记录, 不拦门): 根域口径会把深层子域误判为已覆盖 —
 * 如 `api.wan.*.weixin.qq.com` 的根域 qq.com 在 MitM 有其它条目即判覆盖,
 * 而 Loon 实际按 host pattern 精确匹配 (该条依然无解密面, 见产物手写块注释)。
 * 精确到 host 级需要 Loon 通配语义的形式化, 暂不做; 本门禁的目标是
 * "整行误删 / 上游 rule 无 hostname" 类结构性事故, 根域口径已足够。
 *
 * 返回 { uncovered: [{ regex, missing: [根域...] }], generic: [regex...] }:
 *   - uncovered: 可抽取 host 但根域不在 MitM (多为上游 rule 无 hostname,
 *     生成器无法凭空发明解密面 — 逐条登记, 新增即红)
 *   - generic: host 无法静态抽取 (裸 `.*` / 全通配 catch-all / TLD 位通配类),
 *     覆盖性不可判定 — 锁定数量, 漂移需分诊
 */
export function expandAltGroups(h, cap = 64) {
  const groups = [...h.matchAll(/\(([^()]+)\)/g)];
  if (!groups.length) return [h];
  const parts = [];
  const alts = [];
  let last = 0;
  for (const g of groups) {
    parts.push(h.slice(last, g.index));
    alts.push(g[1].split("|"));
    last = g.index + g[0].length;
  }
  parts.push(h.slice(last));
  const out = [];
  const rec = (i, acc) => {
    if (out.length >= cap) return;
    if (i === alts.length) { out.push(acc + parts[i]); return; }
    for (const alt of alts[i]) {
      rec(i + 1, acc + parts[i] + alt);
      if (out.length >= cap) return;
    }
  };
  rec(0, "");
  return out;
}

export function ruleHostRoots(regex) {
  // `https:?\/\/` (匹配 http/https 的简写, 如 social 的 jumpvg 行) hostOf 无法解析
  // (`?` 卡在 `://` 中间) — 仅 checker 内归一化, 不碰规则本身
  regex = regex.replace(/^(\^https?):\?\\?\/\\?\//, "$1://");
  // 先剥 regex 首部通配前缀再取 host: `[^\/]*` 含字面 `/` 会把 hostOf 的
  // `([^/]+)` 提前截断 (`[^\/]*zdmimg.com` → `[^\`), 必须在 hostOf 之前处理
  const pre = regex.match(/^(\^https?\??:(?:\\?\/){2})((?:\.\*|\\\.\*|\[\^?[^\]]*\]\*?|\[[^\]]+\][+*?]?)+)/);
  if (pre) regex = pre[1] + regex.slice(pre[1].length + pre[2].length);
  let h = hostOf(regex);
  if (!h) return { roots: [], generic: true, ip: null };
  h = h.replace(/\\\//g, "/").replace(/\\\./g, ".");
  // IP 字面量 (:port 剥离后精确比对, 不走根域口径)
  const ip = h.split(":")[0].replace(/\\+$/g, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return { roots: [], generic: false, ip };
  const variants = expandAltGroups(h);
  if (variants.length >= 64) return { roots: [], generic: true, ip: null };
  const roots = new Set();
  let parsedAny = false;
  for (let v of variants) {
    v = v.split(":")[0].replace(/\\+$/g, "");
    // `\d` 序列紧贴点号/结尾时直接删除取根域: 数字永不改变根域
    // (`toutiao\d*.com` → `toutiao.com`; `p\d.meituan.net` → `p.meituan.net`)。
    // 注意只删"点边"形态: 标签中段的 `a\db` 删除会伪造根域 (ab.com≠a5b.com),
    // 该形态本仓未出现, 若出现则保持原样走 generic/orphan 如实报告。
    v = v.replace(/\\d(?:\{[^}]*\})?[*+?]?(?=[.]|$)/g, "");
    // 通配序列是分隔符而非粘合剂: `.*` 直接删会把两侧拼成一个假 token
    // (`list-app-m.i4.cn.*adinfo.xhtml` → `...cn..adinfo...` 误判), 故按段切分
    const frags = v.split(/(?:\.\*|\*|\[[^\]]+\][+*?]?)+/).filter(Boolean);
    const toks = [];
    for (const f of frags) {
      for (const t of (f.match(DOMAIN_RE) || [])) {
        if (/[\\?[\]()+{}]/.test(t) || /^[0-9.]+$/.test(t)) continue;
        toks.push(t);
      }
    }
    if (!toks.length) continue;
    parsedAny = true;
    // 最长 token 优先: 短 token 多为 `api.wan` 类截断 artifact
    const longest = toks.sort((x, y) => y.length - x.length)[0];
    roots.add(rootOf(longest.toLowerCase()));
  }
  if (!parsedAny) return { roots: [], generic: true, ip: null };
  return { roots: [...roots], generic: false, ip: null };
}

export function uncoveredRules(rules, mitmHosts) {
  const roots = new Set();
  const ips = new Set();
  for (const h of mitmHosts) {
    const low = h.toLowerCase();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(low)) { ips.add(low); continue; }
    const bare = low.replace(/\*/g, "");
    if (bare.includes(".")) roots.add(rootOf(bare));
  }
  const uncovered = [];
  const generic = [];
  for (const r of rules) {
    const { roots: rr, generic: g, ip } = ruleHostRoots(r.regex);
    if (g) { generic.push(r.regex); continue; }
    if (ip) { if (!ips.has(ip)) uncovered.push({ regex: r.regex, missing: [ip] }); continue; }
    const missing = rr.filter((x) => !roots.has(x));
    if (missing.length) uncovered.push({ regex: r.regex, missing });
  }
  return { uncovered, generic };
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
  // 前缀遮蔽自剪 (2026-09-20 精简优化): Loon url-regex 规则 = 锚起始的前缀匹配,
  // 若已有更早的 (手写或生成) 同 action+enable 规则是当前规则的严格字面前缀,
  // 则当前规则永远无法命中, 剪掉 (如上游 ad.mcloud.139.com/advertapi 罩住尾部
  // adv-filter/.../getAdInfos$ 子条)。手写块永不剪。
  const parts = (l) => {
    const m = l.trim().match(/^(\S+)\s+(\S+)\s+(.*)$/);
    return m ? { regex: m[1], action: m[2], rest: m[3] } : null;
  };
  const seenMeta = manualLines.map(parts).filter(Boolean);
  const prunedGenLines = [];
  for (const l of genLines) {
    const p = parts(l);
    const shadowed = p && seenMeta.some(
      (s) => s.action === p.action && s.rest === p.rest && p.regex.startsWith(s.regex) && p.regex.length > s.regex.length
    );
    if (!shadowed) { prunedGenLines.push(l); if (p) seenMeta.push(p); }
  }
  // script→原生 reject 精准补充块 (EXTRA_REJECTS): 生成的规则与对应 host 必须同生共死
  const extraLines = EXTRA_REJECTS.map((e) => `# ${e.reason}\n${e.regex} ${e.action} enable={ENABLE_STARTUP}`);
  // 未纳入计数口径: script 条目扣除已转原生的 (extra)
  const unconvertedScripts = scriptLedger(scripts).filter((r) => r.status !== "extra").length;
  const unsafeNote = unsafe.length
    ? `\n# ⛔ 已剔除边界不安全通配 ${unsafe.length} 条 (可匹配非预期注册域, 解密面扩张): ${unsafe.join(", ")}`
    : "";
  // 手写块规则 host 并入 [MitM] (2026-09-21 回归修复): 去掉 splash.*/ad.*/flash.*
  // 边界不安全通配后, 手写块精确 host 必须显式并入, 否则 https 规则静默失效
  const manual = manualMitmHosts(manualLines);
  const manualUnsafeNote = manual.unsafe.length
    ? `\n# ⚠️ 手写块 无法安全表达 host ${manual.unsafe.length} 条 (跨标签通配/可选数字, https 不保证): ${manual.unsafe.join(", ")}`
    : "";
  const mitmHosts = [...new Set([...kept, ...EXTRA_HOSTS.map((e) => e.host), ...EXTRA_REJECTS.map((e) => e.host), ...manual.hosts])];
  return `${HEADER}
${BEGIN_MANUAL}
${manualLines.join("\n")}
${END_MANUAL}

${BEGIN_EXTRA}
${extraLines.join("\n")}
${END_EXTRA}

${BEGIN_GEN}
# 来源: https://ddgksf2013.top/rewrite/StartUpAds.conf (镜像 ifflagged/Romeo, @UpdateTime ${updateTime})
# 转换: QX url reject[-xxx] → Loon rewrite, 共 ${prunedGenLines.length} 条 (上游 ${rejects.length} 行, 去重 ${rejects.length - seen.size} 条, 前缀遮蔽剪 ${genLines.length - prunedGenLines.length} 条, 垃圾host ${droppedGarbage} 条)
# 未纳入: ${unconvertedScripts} 条 script 型 + ${hostRules} 条 host 型 (去向见 scriptLedger/SCRIPT_LEDGER, 见工具注释)
${prunedGenLines.join("\n")}
${END_GEN}

[MitM]
# ⚠️ 注意：部分 App 禁用了 MITM，无法拦截其开屏广告
# 上游 hostname 最小化子集 (${mitmHosts.length}/${upstreamCount} 条, 仅被 reject 规则消费的域 + EXTRA_REJECTS/EXTRA_HOSTS host + 手写块 host)${unsafeNote}${manualUnsafeNote}
hostname = %APPEND% ${mitmHosts.join(", ")}
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
  // 通配覆盖报告 (2026-09-19, P2-3): 只报告不动解密面 — 收窄通配需人工决策
  const wild = wildcardReport(kept, rules);
  if (wild.length) {
    console.log(`\n── 通配 hostname 覆盖报告 (${wild.length} 条, 解密面提示, 只报告不自动收敛) ──`);
    for (const w of wild.sort((x, y) => y.rules - x.rules || x.host.localeCompare(y.host))) {
      console.log(`   ${w.host} → ${w.rules} 条规则消费`);
    }
  }
  // script 型条目台账 (2026-09-20): covered/extra/pending 有主, unregistered 需分诊
  const ledger = scriptLedger(scripts);
  console.log(`\n── script 型条目台账 (${ledger.length} 条: covered ${ledger.filter((r) => r.status === "covered").length} / 已转原生 ${ledger.filter((r) => r.status === "extra").length} / 待真机 ${ledger.filter((r) => r.status === "pending").length} / 未登记 ${ledger.filter((r) => r.status === "unregistered").length}) ──`);
  for (const r of ledger) {
    const tag = r.status === "covered" ? "✅已覆盖" : r.status === "extra" ? "🔧已转原生" : r.status === "pending" ? "⏳待真机" : "⚠️未登记";
    console.log(`   ${tag} ${r.regex.slice(0, 78)} — ${r.note}`);
  }
  return 0;
}

const isEntryPoint =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) process.exit(main());
