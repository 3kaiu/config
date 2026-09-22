/**
 * 全仓插件解密面抽查 (2026-09-22 1c576f2 回归门禁体系)。
 *
 * 背景: 1c576f2 误删插件 [MitM] hostname 整行导致 Rewrite 对 HTTPS 静默失效。
 * startup 插件已有专用门禁 (startup-plugin-host.test.js "解密面全覆盖", 27 根域
 * 登记); 本用例把同一检查 (`uncoveredRules`, 口径与 minimizeHosts 对齐的根域
 * 比对) 推广到其余全部 Plugin/*.plugin + Kelee/*.plugin, 防止"规则在、MitM 缺"
 * 类漂移在任何手写插件重演。
 *
 * 覆盖口径: 插件自身 [MitM] ∪ template/loon.tpl [MitM] 正条目 (`-` 排除不计入,
 * 其与并入条目的冲突优先级未经官方文档确认, 见 2026-09-22 结论: 未知即不动)。
 * startup-adblock-pro.plugin 除外 (专用测试已逐条登记, 避免双重维护)。
 *
 * EXPECTED_GENERIC (2): host 无法静态抽取, 覆盖性不可判定 — 锁定集合 —
 *   ① shopping-purify `119.29.29.\d+` (HTTPDNS /24, IP 段通配无精确 MitM 表达)
 *   ② wechat-pro `^(https?://)?([alnum]+.)+...` 全通用域名正则 (裸 catch-all 形态)
 * 漂移 (新增 orphan 或 generic 增减) 即红 → 先定位是规则新增还是 MitM 被改。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const TPL = path.join(ROOT, "template", "loon.tpl");
const SKIP = new Set(["startup-adblock-pro.plugin"]);

const EXPECTED_GENERIC = [
  "Plugin/shopping-purify.plugin :: ^https?:\\/\\/119\\.29\\.29\\.\\d+\\/d",
  "Plugin/wechat-pro.plugin :: ^(https?://)?([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*\\.)+[a-zA-Z]{2,}(:\\d+)?/wp-json/[a-zA-Z0-9_-]+/(mp\\/)?v\\d/posts",
];

let mod = null;
const load = async () => (mod ??= await import("../../tools/build-startup-plugin.mjs"));

/** 插件文本 → [MitM] hostname 列表 (去 %APPEND% / 负条目, 与 startup 测试同口径) */
const hostnamesOf = (txt) => {
  const m = txt.match(/^hostname\s*=\s*(.*)$/m);
  if (!m) return [];
  return m[1]
    .replace(/^%APPEND%\s*,?\s*/, "")
    .split(",")
    .map((h) => h.trim())
    .filter((h) => h && !h.startsWith("-") && !h.startsWith("%"));
};

/** 插件文本 → 待检查规则: [Rewrite] ^ 开头行 + [Script] http 脚本行 */
const rulesOf = (txt) => {
  const rules = [];
  const seg = (txt.split("[Rewrite]")[1] || "").split(/\n\[[A-Za-z ]+\]/)[0] || "";
  for (const raw of seg.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const mr = line.match(/^(\^\S+?)\s+(reject\S*|script-\S+|response-body\S*)/);
    if (mr) rules.push({ regex: mr[1], action: mr[2] });
  }
  for (const sec of ["[Rewrite]", "[Script]"]) {
    const part = (txt.split(sec)[1] || "").split(/\n\[[A-Za-z ]+\]/)[0] || "";
    if (sec === "[Rewrite]") continue;
    for (const raw of part.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const mr = line.match(/^http-(?:response|request)\s+(\^\S+?)\s+.*script-path=/);
      if (mr) rules.push({ regex: mr[1], action: "script-path" });
    }
  }
  return rules;
};

exports.tests = {
  "mitm-coverage: 非 startup 插件零无解密面规则 (新增 orphan 即红)": async (a) => {
    const m = await load();
    const tplHosts = hostnamesOf(fs.readFileSync(TPL, "utf8"));
    a.ok(tplHosts.length > 50, `模板 [MitM] 应有规模 (当前 ${tplHosts.length})`);
    const orphans = [];
    for (const dir of ["Plugin", "Kelee"]) {
      for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith(".plugin")).sort()) {
        if (SKIP.has(f)) continue;
        const txt = fs.readFileSync(path.join(ROOT, dir, f), "utf8");
        const rules = rulesOf(txt);
        if (!rules.length) continue;
        const mitm = [...new Set([...hostnamesOf(txt), ...tplHosts])];
        const { uncovered } = m.uncoveredRules(rules, mitm);
        for (const u of uncovered) orphans.push(`${dir}/${f}: [${u.missing.join(",")}] ${u.regex.slice(0, 60)}`);
      }
    }
    a.equal(orphans, [], `无解密面规则必须为零:\n${orphans.join("\n")}`);
  },

  "mitm-coverage: generic (host 不可静态抽取) 集合锁定": async (a) => {
    const m = await load();
    const tplHosts = hostnamesOf(fs.readFileSync(TPL, "utf8"));
    const generics = [];
    for (const dir of ["Plugin", "Kelee"]) {
      for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith(".plugin")).sort()) {
        if (SKIP.has(f)) continue;
        const txt = fs.readFileSync(path.join(ROOT, dir, f), "utf8");
        const rules = rulesOf(txt);
        if (!rules.length) continue;
        const mitm = [...new Set([...hostnamesOf(txt), ...tplHosts])];
        const { generic } = m.uncoveredRules(rules, mitm);
        for (const g of generic) generics.push(`${dir}/${f} :: ${g}`);
      }
    }
    a.equal(
      generics.slice().sort(),
      [...EXPECTED_GENERIC].sort(),
      "generic 集合漂移需分诊 (规则新增/改写或 checker 语义变更)"
    );
  },
};
