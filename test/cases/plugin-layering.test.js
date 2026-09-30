"use strict";
/**
 * 插件分层与依赖门禁 (2026-09-30 架构分层)
 *
 * 背景: 去广告能力被拆成两层 ——
 *   **L0 依赖层**: 广告平台拦截器(ad-block) + HTTPDNS 拦截器(dns-httpdns) + DNS 防泄漏(dns-leak),
 *     它们只放"所有去广告插件都需要的共享域集", 是"域名 REJECT 真正生效"的前置条件
 *     (自带解析的 SDK/浏览器会绕过系统 DNS 拿到真实 IP ⇒ 必须先收编解析面);
 *   **L1 消费层**: 单 App/单通道处置(jd / qidian / probe-*), 依赖 L0 提供的基础面。
 *
 * 为什么必须有这道门禁: 分层若只写在注释里, 三种漂移必然发生且都**无症状**——
 *   ① 顺序漂移: 官方《规则》页规定插件之间按 `[Plugin]` 登记顺序匹配, L0 一旦排到后面,
 *      后置插件的 DIRECT/Proxy 对同域会先命中(L0 静默失效, 日志里看不出来);
 *   ② 重复声明: 同一域同时写在主配置与插件里 —— 本地规则优先, 插件那行**永不命中**却看着像
 *      "已覆盖"(tools/plugin-lint-check.mjs 的跨层扫描抓的就是这个形状);
 *   ③ 自断解析链: 有人"顺手把公共 DoH 全拦了", 连本仓自己的 dns.alidns.com / doh.pub 一起拦掉,
 *      表现为解析全线异常, 而配置语法完全合法。
 */
const fs = require("fs");
let shapes = null;
const loadShapes = async () => (shapes ??= await import("../../tools/lib/dns-rule-shapes.mjs"));
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const TPL = path.join(ROOT, "template", "loon.tpl");
const PLUGIN_DIR = path.join(ROOT, "Plugin");

/** L0 依赖层清单 —— 顺序即 `[Plugin]` 段要求的先后 */
const BASE_LAYER = ["ad-block.plugin", "dns-httpdns.plugin", "dns-leak.plugin"];
/** 本仓解析链: 任何 REJECT 规则都不得命中(拦它们 = Loon 自己没有上游可用) */
const RESOLUTION_CHAIN = ["dns.alidns.com", "doh.pub"];

/** 取某段的正条目(行首锚定段名; indexOf 会命中注释里提到的段名) */
const section = (txt, name) => {
  const lines = txt.split(/\r?\n/);
  const i = lines.findIndex((l) => l.trim() === `[${name}]`);
  if (i < 0) return [];
  const out = [];
  for (let k = i + 1; k < lines.length; k++) {
    if (/^\[[A-Za-z ]+\]\s*$/.test(lines[k])) break;
    out.push(lines[k]);
  }
  return out;
};

/** `[Plugin]` 段: [{url, file, enabled, tag}] 按登记顺序 */
function pluginEntries() {
  return section(fs.readFileSync(TPL, "utf8"), "Plugin")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const parts = l.split(",").map((x) => x.trim());
      const m = /\/Plugin\/([^/]+\.plugin)$/.exec(parts[0]);
      const enabled = parts.find((p) => p.startsWith("enabled="));
      return { url: parts[0], file: m ? m[1] : null, enabled: enabled === "enabled=true" };
    })
    .filter((e) => e.file);
}

/** 一个插件里的 REJECT 规则(含类型), 用于"重复声明/自断链"两类扫描 */
function rejectRulesOf(text, file) {
  const out = [];
  for (const raw of section(text, "Rule")) {
    const t = raw.trim();
    if (!t || t.startsWith("#")) continue;
    const f = t.split(",").map((x) => x.trim());
    if (!/REJECT/.test(f[f.length - 1])) continue;
    out.push({ file, line: t, type: f[0].toUpperCase(), domain: f[1] && /^[\w.-]+$/.test(f[1]) ? f[1] : null });
  }
  return out;
}

const readPlugin = (f) => fs.readFileSync(path.join(PLUGIN_DIR, f), "utf8");

exports.tests = {
  "layering: L0 依赖层必须排在 [Plugin] 段最前且 enabled": async (a) => {
    const entries = pluginEntries();
    a.ok(entries.length >= 10, `[Plugin] 段应至少 10 个插件, 实为 ${entries.length}`);
    // ① L0 三项必须都在
    for (const f of BASE_LAYER) {
      a.ok(fs.existsSync(path.join(PLUGIN_DIR, f)), `L0 依赖层缺少 Plugin/${f}`);
      const e = entries.find((x) => x.file === f);
      a.ok(e, `Plugin/${f} 未登记进 template/loon.tpl 的 [Plugin] 段 —— 客户端拿不到`);
      a.ok(e.enabled, `L0 依赖层 Plugin/${f} 必须 enabled=true —— 关掉它等于加密 DNS/HTTPDNS 绕过面回归`);
    }
    // ② L0 三项必须**连续占据最前**, 且在任何 L1 之前
    const head = entries.slice(0, BASE_LAYER.length).map((x) => x.file);
    a.equal(
      head.join(","),
      BASE_LAYER.join(","),
      `[Plugin] 段顺序漂移: 前 ${BASE_LAYER.length} 条应为 L0 依赖层 ${BASE_LAYER.join(" → ")}, 实为 ${head.join(" → ")}` +
        `\n(官方《规则》页: 插件之间按登记顺序匹配 ⇒ L0 排到后面会被别的插件的 DIRECT/Proxy 抢先)`
    );
    // ③ L0 的头部必须写明分层契约(防止后人"顺手挪位置"时无从判断)
    for (const f of BASE_LAYER) {
      a.ok(/L0/.test(readPlugin(f)), `Plugin/${f} 头部未声明 L0 依赖层契约`);
    }
  },

  "layering: L0 域集不得与主配置重复 (重复 = 插件那行永不命中)": async (a) => {
    const tpl = fs.readFileSync(TPL, "utf8");
    const localRules = rejectRulesOf(tpl, "template/loon.tpl");
    const localDomains = new Set(localRules.filter((r) => r.type === "DOMAIN" && r.domain).map((r) => r.domain));
    const localSuffixes = localRules.filter((r) => r.type === "DOMAIN-SUFFIX" && r.domain).map((r) => r.domain);
    for (const f of BASE_LAYER) {
      for (const r of rejectRulesOf(readPlugin(f), f)) {
        if (r.type !== "DOMAIN" || !r.domain) continue;
        const dup =
          localDomains.has(r.domain) || localSuffixes.some((s) => r.domain === s || r.domain.endsWith("." + s));
        a.ok(
          !dup,
          `Plugin/${f} 的 ${r.domain} 已被主配置 REJECT 覆盖 ⇒ 该插件行永不命中(本地规则优先)` +
            `\n单一真源: 域名级清单只放在插件里, 主配置不得重复声明`
        );
      }
    }
    // 关键词同理: 主配置不得再留裸 httpdns 关键词(已迁入 dns-httpdns 的 AND 锚定形式)
    a.ok(
      !/^DOMAIN-KEYWORD,\s*httpdns\s*,\s*REJECT\s*$/m.test(tpl),
      "主配置仍有裸 `DOMAIN-KEYWORD, httpdns` —— 它会让 Plugin/dns-httpdns.plugin 的全部行次永不命中"
    );
  },

  "layering: 不得拦掉本仓解析链 (dns.alidns.com / doh.pub)": async (a) => {
    const tpl = fs.readFileSync(TPL, "utf8");
    for (const chain of RESOLUTION_CHAIN) {
      const hits = rejectRulesOf(tpl, "template/loon.tpl").filter(
        (r) =>
          (r.domain === chain || (r.domain && chain.endsWith("." + r.domain))) &&
          (r.type === "DOMAIN" || r.type === "DOMAIN-SUFFIX")
      );
      a.equal(
        hits.length,
        0,
        `主配置出现针对解析链 ${chain} 的 REJECT(${hits.map((h) => h.line).join(" / ")}) —— 拦它等于 Loon 自己没有上游可用`
      );
    }
    for (const f of fs.readdirSync(PLUGIN_DIR).filter((x) => x.endsWith(".plugin"))) {
      for (const chain of RESOLUTION_CHAIN) {
        const hits = rejectRulesOf(readPlugin(f), f).filter(
          (r) => r.domain === chain && (r.type === "DOMAIN" || r.type === "DOMAIN-SUFFIX")
        );
        a.equal(hits.length, 0, `Plugin/${f} 拦了本仓解析链 ${chain} —— 必须从名单中移除`);
      }
      // AND 形式的关键词兜底不得把解析链卷进来: dns.alidns.com / doh.pub 都不含 "httpdns"
      a.ok(
        !RESOLUTION_CHAIN.some((c) => readPlugin(f).includes(`DOMAIN, ${c}, REJECT`)),
        `Plugin/${f} 出现对解析链的精确 REJECT`
      );
    }
  },

  "layering: 框架层端口兜底必须存在 (DoT/DoQ 853)": async (a) => {
    const tpl = fs.readFileSync(TPL, "utf8");
    a.ok(
      /^DEST-PORT,\s*853,\s*REJECT\s*$/m.test(tpl),
      "主配置缺少 `DEST-PORT, 853, REJECT` —— DoT/DoQ(端口 853)是域名规则覆盖不到的加密 DNS 绕过面;" +
        "它是框架层兜底(插件被关也仍在), 删掉即静默退回可绕过状态"
    );
  },

  "layering: dns-* 插件只做 L2 收编 (无 MitM/Script/Rewrite/Argument/宽匹配)": async (a) => {
    const { isAllowedDnsRule, isPlaintextOnlyRule, DNS_RULE_SHAPES } = await loadShapes();
    const files = fs.readdirSync(PLUGIN_DIR).filter((f) => /^dns-.*\.plugin$/.test(f)).sort();
    a.ok(files.length >= 2, `应存在 dns-httpdns / dns-leak 两个 DNS 层插件, 实为 ${files.join(", ")}`);
    for (const f of files) {
      const txt = readPlugin(f);
      for (const seg of ["MitM", "Script", "Rewrite", "Argument"]) {
        const body = section(txt, seg).filter((l) => l.trim() && !l.trim().startsWith("#"));
        a.equal(body.length, 0, `Plugin/${f} 不应有 [${seg}] 正条目 —— 本层是纯 L2 域名收编, 零证书成本`);
      }
      // 形状白名单收敛在 tools/lib/dns-rule-shapes.mjs(三处用例共用, 避免各写一份漂移)
      for (const line of section(txt, "Rule").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))) {
        a.ok(
          isAllowedDnsRule(line),
          `Plugin/${f} 的规则 "${line}" 不在允许形状内 —— 允许: ${DNS_RULE_SHAPES.map((x) => x.name).join(" / ")}` +
            `(裸 DOMAIN-KEYWORD 由 plugin-lint-check 判红; DOMAIN-SUFFIX/通配会误伤同域功能)`
        );
        // 反身不变量: URL-REGEX/USER-AGENT 类必须限定明文 —— https 形态要 MitM, 与本层零解密面冲突
        a.ok(isPlaintextOnlyRule(line), `Plugin/${f} 出现非明文规则(需 MitM): ${line}`);
      }
    }
  },
};
