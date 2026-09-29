"use strict";
/**
 * 外部资源依赖面门禁 (2026-09-29)
 *
 * 决策: 「彻底移除不需要的外部依赖」—— 插件**不得引用任何第三方图标/图片服务**。
 *
 * 缘由: 45 个 `#!icon` 中 32 个已 404。DuckDuckGo 的图标代理 (icons.duckduckgo.com/ip3)
 * 只认真实主域的 favicon, 而仓库里大量写成接口域 (api.netflix.com / m5.amap.com /
 * ads.api.iqiyi.com), 这类域根本不提供 favicon → 恒 404。还有 6 个干脆不是域名
 * (ai.ico / bank.ico / splash.*.ico), 永远取不到。
 *
 * 图标是**纯观感**, 不影响任何规则执行。与其挂在一个随时会改规则/改路径的第三方服务上,
 * 不如交给 Loon 默认图标 —— 换取外部依赖归零。故本文件锁死这个面。
 *
 * 仍允许的外部依赖 (结构性必要, 已在 AGENTS.md 留痕):
 *   - `ws.wenn.in`        自建 CDN, 发布面即本仓 (自己维护)
 *   - `geoip-url` 的 mmdb  GEOIP,CN,DIRECT 的数据地基; 7.7MB 且每日变化, 刻意不入库
 */
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..", "..");
const PLUGIN_DIR = path.join(REPO, "Plugin");

// 允许的运行时外部依赖白名单 (域 → 理由)
const ALLOWED = {
  "ws.wenn.in": "自建 CDN — Scripts/ 分发, 本仓自己维护",
};
// 模板 [General] 里允许的外部 URL 前缀
const ALLOWED_TPL_PREFIXES = [
  "https://raw.githubusercontent.com/Loyalsoldier/geoip/", // geoip-url, GEOIP,CN,DIRECT 依赖
  // 探活端点: 只发一个请求判断链路通断, **不下载任何内容**, 不构成依赖面。
  // 一主一备是 AGENTS 已定论(同端点故障无法区分"本机断网"与"代理失效")。
  "http://cp.cloudflare.com/generate_204", // 策略组 url-test 测速端点
  "http://connectivitycheck.platform.hicloud.com/generate_204", // internet-test-url (直连可用性)
  "http://connectivitycheck.gstatic.com/generate_204", // proxy-test-url (代理链路可用性)
];

function pluginFiles() {
  return fs.readdirSync(PLUGIN_DIR).filter((f) => f.endsWith(".plugin")).map((f) => path.join(PLUGIN_DIR, f));
}

exports.tests = {
  "外部依赖: 插件不得声明 #!icon (第三方图标服务, 32/45 已 404)": async (a) => {
    const hits = [];
    for (const f of pluginFiles()) {
      for (const l of fs.readFileSync(f, "utf8").split("\n")) {
        if (/^#!icon=/.test(l.trim())) hits.push(`${path.basename(f)}: ${l.trim()}`);
      }
    }
    a.equal(
      hits.length,
      0,
      `${hits.length} 个插件重新声明了 #!icon:\n  ${hits.join("\n  ")}\n` +
        `图标是纯观感, 交给 Loon 默认图标即可; 挂第三方图标代理等于维护一个随时会坏的依赖。`
    );
  },

  "外部依赖: 插件的 script-path 只能指向自建 CDN": async (a) => {
    const bad = [];
    for (const f of pluginFiles()) {
      for (const l of fs.readFileSync(f, "utf8").split("\n")) {
        const s = l.trim();
        if (!s || s.startsWith("#")) continue;
        const m = s.match(/script-path=(https?:\/\/[^,\s]+)/);
        if (!m) continue;
        const url = m[1];
        const host = (() => {
          try {
            return new URL(url).host;
          } catch {
            return "(无法解析)";
          }
        })();
        if (!Object.prototype.hasOwnProperty.call(ALLOWED, host)) bad.push(`${path.basename(f)}: ${url}`);
      }
    }
    a.equal(
      bad.length,
      0,
      `${bad.length} 条 script-path 指向非自建 CDN:\n  ${bad.join("\n  ")}\n` +
        `仅允许: ${Object.entries(ALLOWED).map(([h, r]) => `${h} (${r})`).join(", ")}`
    );
  },

  "外部依赖: 模板 [General] 的外部 URL 仅限 mmdb 分流地基": async (a) => {
    const tpl = fs.readFileSync(path.join(REPO, "template", "loon.tpl"), "utf8");
    const sec = (tpl.match(/^\[General\]\n([\s\S]*?)(?=^\[)/m) || [])[1] || "";
    const bad = [];
    for (const l of sec.split("\n")) {
      const s = l.trim();
      if (!s || s.startsWith("#") || !s.includes("=")) continue;
      for (const m of s.matchAll(/https?:\/\/[^\s,]+/g)) {
        const url = m[0];
        if (ALLOWED_TPL_PREFIXES.some((p) => url.startsWith(p))) continue;
        bad.push(`${s.split("=")[0].trim()} = ${url}`);
      }
    }
    a.equal(
      bad.length,
      0,
      `[General] 出现非白名单外部 URL:\n  ${bad.join("\n  ")}\n` +
        `仅允许 geoip-url 的 mmdb: ${ALLOWED_TPL_PREFIXES.join(", ")}`
    );
  },
};
