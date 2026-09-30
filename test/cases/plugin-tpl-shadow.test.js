/**
 * 插件 [Rule] REJECT 不得被主配置 [Rule] 无条件条目遮蔽 (2026-09-22 跨层复用审计)。
 *
 * 背景: privacy-shield 75 条 REJECT 里 64 条与主配置逐字重复 — 官方优先级
 * 本地规则 > 插件规则 (nsloon.app/docs/Rule), 模板先命中, 插件条目永不可达,
 * 且 PRIVACY_ENABLE 开关拨动对这 64 域零效果 (MOD-04 同型假粒度, 当日删除)。
 *
 * 本门禁把"模板无条件 REJECT ⊇ 插件 REJECT 即判红"固化为法律:
 *   - shadower 仅取模板无条件条目 (含 enable= / ${policy} 的条件条目不计,
 *     它们可能关闭, 插件侧是有效兜底)
 *   - 只判 REJECT-vs-REJECT (DIRECT/PROXY 动作是策略分流, 不在此列;
 *     qidian.plugin 的 DIRECT 白名单另有 B7-1 矛盾记录, 不归本门禁)
 *   - 维度仅限域名 (DOMAIN/DOMAIN-SUFFIX/DOMAIN-KEYWORD; DEST-PORT 等不参与)
 *   - Remote Rule 不参与: 远程列表需联网加载, 本地重复是刻意兜底 (template 注释已声明)
 * 新增命中即红 → 要么删插件重复 (模板已拦, 零行为变化), 要么给出保留理由并登记。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

const section = (txt, name) => {
  const out = [];
  let on = false;
  for (const l of txt.split("\n")) {
    if (/^\[[A-Za-z ]+\]$/.test(l.trim())) {
      on = l.trim() === `[${name}]`;
      continue;
    }
    if (on) out.push(l);
  }
  return out;
};

const RULE_RE = /^(DOMAIN(?:-SUFFIX|-KEYWORD)?),([^,]+),\s*REJECT\b/;

const loadTemplateShadows = () => {
  const txt = fs.readFileSync(path.join(ROOT, "template", "loon.tpl"), "utf8");
  const out = [];
  for (const raw of section(txt, "Rule")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.includes("enable=") || line.includes("${")) continue;
    const m = line.match(RULE_RE);
    if (m) out.push({ type: m[1], dom: m[2].trim() });
  }
  return out;
};

const shadowedBy = (shadows, type, dom) =>
  shadows.some(
    ([tt, td]) =>
      (tt === "DOMAIN-SUFFIX" && (dom === td || dom.endsWith("." + td))) ||
      (tt === "DOMAIN" && dom === td) ||
      (tt === "DOMAIN-KEYWORD" && dom.includes(td))
  );

exports.tests = {
  "plugin-tpl-shadow: 插件 REJECT 不得被模板无条件条目遮蔽 (假开关即红)": async (a) => {
    const shadows = loadTemplateShadows();
    a.ok(shadows.length > 50, `模板无条件 REJECT 应有规模 (当前 ${shadows.length})`);
    const fakes = [];
    for (const dir of ["Plugin", "Plugin"]) {
      for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith(".plugin")).sort()) {
        const txt = fs.readFileSync(path.join(ROOT, dir, f), "utf8");
        for (const raw of section(txt, "Rule")) {
          const line = raw.trim();
          if (!line || line.startsWith("#")) continue;
          const m = line.match(RULE_RE);
          if (!m) continue;
          if (shadowedBy(shadows.map((s) => [s.type, s.dom]), m[1], m[2].trim())) {
            fakes.push(`${dir}/${f}: ${line.slice(0, 70)}`);
          }
        }
      }
    }
    a.equal(fakes, [], `插件侧被模板遮蔽的 REJECT 必须为零:\n${fakes.join("\n")}`);
  },
  "plugin-shadow: 后注册插件的规则不得被先注册插件遮蔽 (含同文件内重复)": async (a) => {
    // 2026-09-30 补的另一半: 原门禁只查"模板 → 插件", 而**插件之间**同样按 [Plugin] 注册顺序
    // 先到先得 ⇒ 先注册插件里已有的域, 在后注册插件里是永不命中的死规则。实测抓到两条真重复:
    //   · `tangram.e.qq.com`  ad-block(L0) 与 qidian     · `resolver.msg.xiaomi.net`  dns-httpdns(L0) 与 probe-oem
    // 两条都已删(各留一行说明); 本用例守这条不变量 —— 判据与模板-shadow 同源, 只判 REJECT-vs-REJECT 的域名维度。
    const tpl = fs.readFileSync(path.join(ROOT, "template", "loon.tpl"), "utf8");
    const order = section(tpl, "Plugin")
      .map((l) => /Plugin\/([\w.-]+\.plugin)/.exec(l))
      .filter(Boolean)
      .map((m) => m[1]);
    a.ok(order.length >= 5, `[Plugin] 段插件数异常: ${order.length}`);

    const rulesOf = (file) => {
      const txt = fs.readFileSync(path.join(ROOT, "Plugin", file), "utf8");
      return section(txt, "Rule")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
    };

    /** 累积"已被先注册插件拦下的域"(精确 + 后缀包含) */
    const exact = new Map(); // host → 先注册的插件
    const suffixes = []; // [{suffix, file}]
    const coveredBy = (host) => {
      if (exact.has(host)) return exact.get(host);
      const hit = suffixes.find((s) => host !== s.suffix && host.endsWith("." + s.suffix));
      return hit ? hit.file : null;
    };

    const problems = [];
    for (const file of order) {
      const seen = new Set(); // 同文件内重复
      for (const line of rulesOf(file)) {
        const m = /^(DOMAIN|DOMAIN-SUFFIX),\s*([\w.-]+),\s*REJECT$/.exec(line);
        if (!m) continue; // 只判裸域名 REJECT: AND/USER-AGENT/URL-REGEX 等形态不参与
        const kind = m[1];
        const host = m[2].toLowerCase();
        if (seen.has(host)) problems.push(`Plugin/${file} 文件内重复: ${host}`);
        seen.add(host);
        if (kind === "DOMAIN") {
          const who = coveredBy(host);
          if (who && who !== file) problems.push(`Plugin/${file}: ${host} 已被先注册的 ${who} 拦下(永不命中)`);
          exact.set(host, file);
        } else {
          const who = coveredBy(host);
          if (who && who !== file) problems.push(`Plugin/${file}: 后缀 ${host} 已被先注册的 ${who} 罩住`);
          suffixes.push({ suffix: host, file });
          exact.set(host, file);
        }
      }
    }
    a.equal(problems.length, 0, `插件↔插件死规则:\n${problems.join("\n")}`);
  },

};
