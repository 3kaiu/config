"use strict";
/**
 * DNS / GeoIP / ASN 侧的静态门禁 (2026-09-29 对抗审计)
 *
 * 依据 Loon 官方规则优先级语义:
 *   ① 域名类规则优先于 IP 类规则, 域名命中后不再走 IP 匹配;
 *   ② **本地 [Rule] 优先级高于插件 [Rule]**(AGENTS 已定论, 官方《规则系统 3.1 规则优先级》)。
 *
 * ②的直接推论是本文件存在的理由: 插件 [Rule] 里任何 IP-ASN / IP-CIDR 规则都排在
 * 本地 GEOIP,CN 之后, 因此**只要目标是境内 IP 就永不求值**。本仓曾有 3 条这样的死规则
 * (didi-pro 的 IP-ASN 45090/55990/63646), 靠一条"ipasn-url 有活跃消费者"断言把此类错误永久挡住。
 */
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..", "..");
const TPL = path.join(REPO, "template", "loon.tpl");

function expand(file, seen = new Set()) {
  const raw = fs.readFileSync(file, "utf8");
  return raw.replace(/\{%\s*include\s+"([^"]+)"\s*%\} /g, "").replace(
    /\{%\s*include\s+"([^"]+)"\s*%\}/g,
    (_, rel) => {
      const abs = path.join(REPO, "template", rel);
      if (seen.has(abs)) return "";
      seen.add(abs);
      return expand(abs, seen);
    }
  );
}
const TPL_TEXT = expand(TPL);

// 模板里的值可能是 {{ customParams.x }} 占位 (surgio 渲染时才替换),
// 故此处对占位符改查 surgio.conf.js 的 customParams, 而不是直接判协议前缀失败。
const customParams = (() => {
  const src = fs.readFileSync(path.join(REPO, "surgio.conf.js"), "utf8");
  const m = src.match(/customParams\s*:\s*\{([\s\S]*?)\n\s*\}/);
  if (!m) return {};
  const out = {};
  for (const l of m[1].split("\n")) {
    const mm = l.match(/(\w+)\s*:\s*['"]([^'"]+)['"]/);
    if (mm) out[mm[1]] = mm[2];
  }
  return out;
})();

function generalValue(key) {
  const g = TPL_TEXT.match(/^\[General\]\n([\s\S]*?)(?=^\[)/m);
  if (!g) throw new Error("loon.tpl 未找到 [General]");
  for (const l of g[1].split("\n")) {
    const s = l.trim();
    if (s.startsWith(key + " =")) {
      const raw = s.slice(s.indexOf("=") + 1).trim();
      // 展开 {{ customParams.x }} —— 这是产物形态, 而非模板形态
      return raw.replace(/\{\{\s*customParams\.(\w+)\s*\}\}/g, (_, k) => customParams[k] ?? raw);
    }
  }
  return null;
}

function ruleSection() {
  const m = TPL_TEXT.match(/^\[Rule\]\n([\s\S]*?)(?=^\[[A-Za-z ]+\]$)/m);
  if (!m) throw new Error("loon.tpl 未找到 [Rule]");
  return m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(",").map((x) => x.trim()));
}

exports.tests = {
  "dns-geoip: ipasn-url 必须有活跃 IP-ASN 消费者, 否则删 (省 12MB)": async (a) => {
    const consumers = [];
    // 本地 [Rule]
    for (const f of ruleSection()) if (f[0] === "IP-ASN" || /,\s*IP-ASN/.test(f[0])) consumers.push("loon.tpl");
    // 插件 [Rule]
    for (const fn of fs.readdirSync(path.join(REPO, "Plugin"))) {
      if (!fn.endsWith(".plugin")) continue;
      const txt = fs.readFileSync(path.join(REPO, "Plugin", fn), "utf8");
      const sec = txt.match(/^\[Rule\]\n([\s\S]*?)(?=^\[[A-Za-z ]+\]$)/m);
      if (!sec) continue;
      for (const l of sec[1].split("\n")) {
        const s = l.trim();
        if (s && !s.startsWith("#") && s.includes("IP-ASN")) consumers.push(fn);
      }
    }
    const ipasn = generalValue("ipasn-url");
    a.ok(
      (!!ipasn) === consumers.length > 0,
      ipasn
        ? `ipasn-url 已配置但无 IP-ASN 规则消费 (${ipasn}) —— 每次白拉 12MB, 应删除该键`
        : `存在 IP-ASN 规则 (${[...new Set(consumers)].join(", ")}) 却未配 ipasn-url, 规则将无法匹配`
    );
  },

  "dns-geoip: 插件 IP 规则不得被本地 GEOIP 抢走 (死规则检测)": async (a) => {
    const local = ruleSection();
    const geoipAt = local.findIndex((f) => f[0] === "GEOIP");
    a.ok(geoipAt > -1, "本地 [Rule] 应含 GEOIP 规则");
    const dead = [];
    for (const fn of fs.readdirSync(path.join(REPO, "Plugin"))) {
      if (!fn.endsWith(".plugin")) continue;
      const txt = fs.readFileSync(path.join(REPO, "Plugin", fn), "utf8");
      const sec = txt.match(/^\[Rule\]\n([\s\S]*?)(?=^\[[A-Za-z ]+\]$)/m);
      if (!sec) continue;
      for (const l of sec[1].split("\n")) {
        const s = l.trim();
        // IP-ASN 只能匹配已解析出的 IP; 本地 GEOIP 排在插件之前, 境内目标必然先被 GEOIP 吃掉
        if (s && !s.startsWith("#") && s.includes("IP-ASN"))
          dead.push(`${fn}: ${s.slice(0, 80)}`);
      }
    }
    a.equal(
      dead.length,
      0,
      `${dead.length} 条插件 IP-ASN 规则为死规则(本地 GEOIP,CN 位于第 ${geoipAt + 1} 条, 优先级高于插件):\n  ${dead.join("\n  ")}`
    );
  },

  "dns-geoip: geoip-url 必须存在 (GEOIP,CN 依赖)": async (a) => {
    const v = generalValue("geoip-url");
    a.ok(v && /^https:\/\//.test(v), `geoip-url 缺失或非 https: ${v}`);
  },

  "dns-geoip: DoH/DoH3/DoQ 端点齐备且为加密协议": async (a) => {
    a.ok((generalValue("doh-server") || "").includes("https://"), "doh-server 应全为 https://");
    a.ok((generalValue("doh3-server") || "").includes("h3://"), "doh3-server 应全为 h3://");
    const doq = generalValue("doq-server");
    a.ok((doq || "").includes("quic://"), `doq-server 应为 quic://, 实得 ${doq}`);
  },

  "dns-geoip: 断网探活一主一备 (同端点无法区分断网/代理失效)": async (a) => {
    const i = generalValue("internet-test-url");
    const p = generalValue("proxy-test-url");
    a.ok(i && p, "internet-test-url 与 proxy-test-url 均须存在");
    const host = (u) => {
      try {
        return new URL(u.includes("://") ? u : `http://${u}`).host;
      } catch {
        return null;
      }
    };
    a.ok(
      host(i) !== host(p),
      `两个探活 URL 同为 ${host(i)} —— 该端点故障会同时误判"本机断网 + 代理失效", 排障无法区分`
    );
  },

  // 2026-09-29: hijack-dns 改为 *:53 后, 本用例的"列举式比对"变得**恒真** ——
  // 那是"看起来有门禁其实没有"的典型形态, 不能就这么留着。改为显式分流:
  //   · 列举式形态 → 保留原重叠检查 (自噬防护有意义)
  //   · *:53 形态  → 重叠检查不适用 (全端口 53 语义下与具体 IP 无可比项),
  //     改断言"未混入列举项", 真正的形态语义由 general-semantics 的
  //     "hijack-dns 必须是 *:53" 用例承担。
  "dns-geoip: dns-server 不被自身 hijack (防加密链自噬)": async (a) => {
    const servers = (generalValue("dns-server") || "").split(",").map((x) => x.trim()).filter(Boolean);
    const hijack = (generalValue("hijack-dns") || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (hijack.length === 1 && /^\*:(\d+)$/.test(hijack[0])) {
      a.ok(
        hijack[0] === "*:53",
        `hijack-dns=${hijack[0]} 为全端口形态, 官方示例只给 *:53 (劫持所有端口会误伤非 DNS 流量)`
      );
      return;
    }
    const overlap = servers.filter((s) => hijack.includes(s));
    a.equal(
      overlap.join(","),
      "",
      `dns-server 与 hijack-dns 重叠: ${overlap.join(", ")} —— 加密失败回落明文时自劫持, 形成解析链自噬`
    );
  },

  // 2026-09-29 反转为"零值条目须为空"。
  // 原断言要求恰好 6 条 httpdns 零值映射, 但它们已被 [Rule] 的
  // `DOMAIN-KEYWORD, httpdns, REJECT` 完全覆盖 (超集 + 同为 DNS 层处置), 属冗余。
  // 判据之所以反转而非删除: 零值映射 (`域 = 0.0.0.0`) 会**静默吞掉真实解析** ——
  // 一旦有人为省事再加一条, 没有任何门禁会报警。空集合是唯一安全终态。
  "dns-geoip: [Host] 不得有零值条目 (会静默吞掉真实解析)": async (a) => {
    const h = TPL_TEXT.match(/^\[Host\]\n([\s\S]*?)(?=^\[[A-Za-z ]+\]$)/m);
    a.ok(h, "应有 [Host] 段");
    const zero = [];
    for (const l of h[1].split("\n")) {
      const s = l.trim();
      if (!s || s.startsWith("#")) continue;
      const rhs = s.split("=").slice(1).join("=").trim();
      if (rhs === "0.0.0.0") zero.push(s.split("=")[0].trim());
    }
    a.equal(
      zero.length,
      0,
      `[Host] 出现 ${zero.length} 条零值映射: ${zero.join(", ")} —— 零值会静默吞掉真实解析; ` +
        `HTTPDNS 拦截请走 [Rule] 的 DOMAIN-KEYWORD, httpdns, REJECT (超集且同为 DNS 层)`
    );
  },

  // 兜底: HTTPDNS 拦截面本身不能消失 —— 上一条把零值映射清空后, 拦截责任全落在这里。
  "dns-geoip: HTTPDNS 拦截规则须存在 (零值映射已移除)": async (a) => {
    const found = ruleSection().some((f) => f[0] === "DOMAIN-KEYWORD" && f[1] === "httpdns" && /REJECT/.test(f[2] || ""));
    a.ok(found, "应有 DOMAIN-KEYWORD, httpdns, REJECT —— [Host] 零值映射已于 2026-09-29 移除, 此规则是唯一的 HTTPDNS 拦截面");
  },
};
