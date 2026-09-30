"use strict";
/**
 * 上游直连依赖的双向覆盖门禁 (2026-09-29)
 *
 * 背景: 精简时把 9 个去广告脚本从自建 CDN 改为直连第三方 upstream raw, 但
 * `upstream-health.yml` 的探活清单没跟着重算 —— 一边漏登记 3 个从未被探活的上游,
 * 另一边还探活着一个已不被引用的文件 (P3TERX GeoLite2-ASN.mmdb, 其唯一消费者
 * didi-pro 的 IP-ASN 规则早已确认为死规则并删除)。
 *
 * 即"清单"与"代码"是两处独立演化的事实, 必然漂移。本文件把漂移变成可执行断言:
 *   ① Plugin/ 的活 script-path 上游引用 ⊆ 探活清单   (漏探活 → 判红)
 *   ② 探活清单 ⊆ 实际会被消费的资源                  (探活死资源 → 判红)
 * 两个方向都要, 只查一个方向仍会漏。
 */
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..", "..");
const WORKFLOW = path.join(REPO, ".github", "workflows", "upstream-health.yml");

// Plugin/ 中真正会拉取并执行的 script-path 上游 (排除注释行)
function liveUpstreamScriptPaths() {
  const out = new Map();
  for (const fn of fs.readdirSync(path.join(REPO, "Plugin"))) {
    if (!fn.endsWith(".plugin")) continue;
    for (const l of fs.readFileSync(path.join(REPO, "Plugin", fn), "utf8").split("\n")) {
      const s = l.trim();
      if (!s || s.startsWith("#") || !s.startsWith("http-")) continue;
      const m = s.match(/script-path=(https?:\/\/\S+?)(?:,\s*|\s*$)/);
      if (!m) continue;
      const url = m[1];
      // 只认第三方 GitHub raw/gist —— 自建 CDN 由同文件的 CDN 探活覆盖
      if (!/^https?:\/\/(raw|gist)\.githubusercontent\.com\//.test(url)) continue;
      if (!out.has(url)) out.set(url, []);
      out.get(url).push(`${fn}: ${s.slice(0, 70)}`);
    }
  }
  return out;
}

// workflow 里 check_url "<name>" "<url>" 的第二个参数
function checkedUrls() {
  const yml = fs.readFileSync(WORKFLOW, "utf8");
  const out = new Map();
  for (const m of yml.matchAll(/check_url\s+"([^"]+)"\s+"([^"]+)"/g)) out.set(m[2], m[1]);
  return out;
}

// APP-ONBOARDING「0. 分发与验真」公开声明的导入地址 —— 用户按文档导入的东西必须被探活。
// 双向: 文档里声明了就必须在探活清单里; 探活清单里的 CDN 地址也必须在文档里出现过。
function documentedImportUrls() {
  const doc = fs.readFileSync(path.join(REPO, "APP-ONBOARDING.md"), "utf8");
  const out = new Set();
  for (const m of doc.matchAll(/https:\/\/ws\.wenn\.in\/main\/[^\s`|)]+/g)) out.add(m[0]);
  return out;
}

// loon.tpl 的 [General] 里会引用外部 URL 的键
function generalExternalUrls() {
  const tpl = fs.readFileSync(path.join(REPO, "template", "loon.tpl"), "utf8");
  const sec = (tpl.match(/^\[General\]\n([\s\S]*?)(?=^\[)/m) || [])[1] || "";
  const out = new Map();
  for (const l of sec.split("\n")) {
    const s = l.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    for (const m of s.matchAll(/https?:\/\/\S+/g)) out.set(m[0].replace(/[,/]$/, ""), s.split("=")[0].trim());
  }
  return out;
}

exports.tests = {
  "upstream: Plugin 的上游 script-path 必须在探活清单内 (漏探活即红)": async (a) => {
    const live = liveUpstreamScriptPaths();
    const checked = checkedUrls();
    const missing = [...live.entries()].filter(([url]) => !checked.has(url));
    a.equal(
      missing.length,
      0,
      `${missing.length} 个上游脚本在运行但无探活 —— 上游挂掉/被投毒时无告警:\n` +
        missing.map(([u, sites]) => `  ${u}\n    被: ${sites.join("\n    被: ")}`).join("\n")
    );
  },

  // 2026-09-29: 原豁免写的是 `!url.includes("ws.wenn.in")` —— 一刀切跳过整个 CDN,
  // 于是 CDN 探活指向已删资源也判绿 (曾长期探活 jd-pro.plugin / Jingdong.js 两个
  // 早已不存在的文件)。改为按 [Plugin] 段与 script-path 的**实际引用**判定。
  "upstream: 探活清单不得含已不被引用的资源 (探活死资源即红)": async (a) => {
    const checked = checkedUrls();
    const live = liveUpstreamScriptPaths();
    const general = generalExternalUrls();
    // 自建 CDN 例外: CDN 上的资源由 [Plugin] 段的 URL 引用, 而 [Plugin] 段不在
    // loon.tpl 的 [General] 里, 故需从模板的 [Plugin] 段单独收集。
    const cdnPluginUrls = (() => {
      const tpl = fs.readFileSync(path.join(REPO, "template", "loon.tpl"), "utf8");
      const sec = (tpl.match(/^\[Plugin\]\n([\s\S]*?)(?=^\[)/m) || [])[1] || "";
      const out = new Map();
      for (const l of sec.split("\n")) {
        const s = l.trim();
        if (!s || s.startsWith("#") || !s.startsWith("http")) continue;
        const u = s.split(",")[0].trim();
        out.set(u, "template [Plugin] 段");
      }
      return out;
    })();
    // CDN 上的脚本 URL (Plugin 内 script-path 指向 ws.wenn.in 的) 同样算活引用
    for (const fn of fs.readdirSync(path.join(REPO, "Plugin"))) {
      if (!fn.endsWith(".plugin")) continue;
      const txt = fs.readFileSync(path.join(REPO, "Plugin", fn), "utf8");
      for (const m of txt.matchAll(/script-path=(https?:\/\/ws\.wenn\.in\/\S+?)(?:,\s*|\s*$)/gm)) {
        cdnPluginUrls.set(m[1], `Plugin/${fn} script-path`);
      }
    }
    const documented = documentedImportUrls();
    a.ok(documented.size >= 1, "APP-ONBOARDING 应公开声明至少一个导入地址(用户按文档导入的东西必须可被探活)");
    for (const u of documented) {
      a.ok(checked.has(u), `文档声明的导入地址 ${u} 不在 upstream-health 探活清单里 —— 挂了没人告警`);
    }
    const dead = [...checked.entries()].filter(
      ([url]) => !live.has(url) && !general.has(url) && !cdnPluginUrls.has(url) && !documented.has(url)
    );
    a.equal(
      dead.length,
      0,
      `${dead.length} 条探活指向已不被引用的资源 —— 无意义噪声, 且每次探活白下流量:\n` +
        dead.map(([u, n]) => `  ${n}\n    ${u}`).join("\n")
    );
  },

  "upstream: 当前不应存在任何第三方 GitHub 直连脚本 (暂只留自维护)": async (a) => {
    // 本断言是**当前决策**的守卫, 不是永久不变量。若日后重新集成上游, 应连同本断言
    // 与 upstream-health.yml 的探活清单一起改 —— 门禁强制这两处同步变更, 避免只改一处。
    const live = liveUpstreamScriptPaths();
    a.equal(
      live.size,
      0,
      `出现 ${live.size} 个第三方 GitHub 直连脚本, 与「暂时只留自己维护的」决定冲突:\n` +
        [...live.keys()].map((u) => `  ${u}`).join("\n") +
        `\n若确需集成: ①确认上游可信 ②在 upstream-health.yml 加 check_url ③改本断言`
    );
  },
  "upstream: 自建 CDN 探活必须做内容哈希比对 (只探状态码即静默失效)": async (a) => {
    // 2026-09-30 (吸纳 SukkaW/Surge 的 post-deploy marker 判据): ws.wenn.in/main/<path> 是
    // origin/main 的**纯字节镜像**(实测 qidian.plugin 两边 sha256 同为 3b81e1de…,
    // Scripts/Qidian.js 逐字节一致) ⇒ 同路径 sha256 是精确不变量。
    // 只探状态码漏三类失效: CDN 缓存滞后(200 但内容是旧版)、200 的 HTML 错误页/截断、
    // 产物改了没重新发布。本断言守住"这个比对存在且对每一条自建 CDN 探活生效"。
    const yml = fs.readFileSync(WORKFLOW, "utf8");
    const cdnProbes = [...checkedUrls().keys()].filter((u) => u.startsWith("https://ws.wenn.in/"));
    // 数量随分发面变化 (2026-09-30 平台集合化: 7 个 ad-* 合并为 ad-block ⇒ 15 条降为 10 条),
    // 故此处只做地板断言; 真正的"漏探活/探死资源"由本文件另两条双向覆盖用例锁死。
    a.ok(cdnProbes.length >= 5, `自建 CDN 探活应 ≥5 条, 实为 ${cdnProbes.length}`);
    a.ok(/https:\/\/ws\.wenn\.in\/\*\)\s*tmp=\$\(mktemp\)/.test(yml), "自建 CDN 资源必须落盘取正文(否则无从比对内容)");
    a.ok(/rel="\$\{url#https:\/\/ws\.wenn\.in\/main\/\}"/.test(yml), "必须把 CDN URL 映射回仓库相对路径同路径比对");
    a.ok(/sha256sum "\$tmp"/.test(yml) && /sha256sum "\$rel"/.test(yml), "必须两侧都算 sha256");
    a.ok(/CDN 内容 ≠ 仓库/.test(yml), "不一致必须改写成非 200 的显式串 (下游判红/开 issue 逻辑才自动生效)");
    a.ok(/CDN 有内容但仓库无此文件/.test(yml), "CDN 有而仓库无(模板引用与仓库脱节)同样要判红");
    // 每条 CDN 探活的路径都必须真的存在于仓库 —— 否则立刻就是"引用与仓库脱节"。
    for (const u of cdnProbes) {
      const rel = u.replace("https://ws.wenn.in/main/", "");
      a.ok(fs.existsSync(path.join(REPO, rel)), `探活指向仓库内不存在的路径: ${rel}`);
    }
  },
};
