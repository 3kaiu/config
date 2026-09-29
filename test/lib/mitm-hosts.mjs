/**
 * MitM 解密面覆盖检查的 host 提取逻辑
 * (2026-09-29 从已删除的 tools/build-startup-plugin.mjs 逐字抽出)
 *
 * 为什么留在 test/: 原生成器每日从上游 conf 重建开屏插件, 随镜像体系移除后已删除;
 * 但它导出的 `ruleHostRoots` / `uncoveredRules` 仍被 mitm-coverage 用例需要 ——
 * 二者回答「每条 Rewrite 规则是否有解密面」, 与镜像无关, 属独立安全网, 予以保留。
 * 根域口径与原 minimizeHosts 对齐, 未做顺手优化。
 */
"use strict";

export function hostOf(regex) {
  const m = regex.replace(/^\^/, "").match(/^https?\??:\\?\/\\?\/([^/]+)/);
  if (!m) return "";
  return m[1].replace(/\\\./g, ".").replace(/\\+$/, ""); // 去转义 + 吞掉 `\.` 切分残留的尾反斜杠
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

const DOMAIN_RE = /[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+/g;

const SUB_TLDS = new Set(["com.cn", "org.cn", "net.cn", "gov.cn", "edu.cn", "com.hk", "co.uk", "co.jp", "com.tw", "co.kr", "com.au"]);

