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
 * EXPECTED_GENERIC (0): 2026-09-29 精简后剩余的 qidian.plugin, 其 10 条 [Script]
 *   规则域名均为具名 host (ii.gdt.qq.com / api-access.pangolin-sdk-toutiao{,.1}.com /
 *   h5|magev6.if.qidian.com), 无不可静态抽取的 catch-all 正则 → 集合为空。
 *   原基线两条 (shopping-purify 的 119.29.29.\d+ HTTPDNS 通配、wechat-pro 的全通用
 *   域名正则) 已随 45 个插件删除而消失 —— 这是真实的覆盖面收缩, 不是门禁放宽。
 *   漂移 (新增 orphan 或 generic 增减) 仍即红 → 先定位是规则新增还是 MitM 被改。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const TPL = path.join(ROOT, "template", "loon.tpl");
const SKIP = new Set(["startup-adblock-pro.plugin"]);

const EXPECTED_GENERIC = [];

let mod = null;
const load = async () => (mod ??= await import("../lib/mitm-hosts.mjs"));

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

/** 插件文本 → 待检查规则: [Rewrite] ^ 开头行 + [Script] http 脚本行
 *  `only` 可传 "Rewrite" 只取 [Rewrite] 段 (用于"解析器是否看得见"的对账断言)。 */
const rulesOf = (txt, only) => {
  const rules = [];
  const seg = (txt.split("[Rewrite]")[1] || "").split(/\n\[[A-Za-z ]+\]/)[0] || "";
  for (const raw of seg.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    // 旧语法: `<regex> <action> [args]`; 新语法 (3.5.1+): `response if … ${url} ~= /<regex>/ then <action>`
    // 两种形态都要抽到 regex + action, 否则迁移后本用例会**空转假绿**。
    const mOld = line.match(/^(\^\S+?)\s+(reject\S*|script-\S+|response-body\S*)/);
    if (mOld) {
      rules.push({ regex: mOld[1], action: mOld[2] });
      continue;
    }
    const mNew = line.match(/^(?:request|response)\s+if\s+.*?\$\{url\}\s*~=\s*\/(.*)$/);
    if (mNew) {
      const act = (mNew[1].split(/\s+then\s+/)[1] || "").trim();
      rules.push({ regex: mNew[1].split(/\s+then\s+/)[0].trim(), action: act });
    }
  }
  for (const sec of ["[Rewrite]", "[Script]"]) {
    if (only && sec !== only) continue;
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
  "mitm-coverage: 非 startup 插件零无解密面规则 (新增 orphan 即红; host 提取逻辑见 test/lib/mitm-hosts.mjs)": async (a) => {
    const m = await load();
    const tplHosts = hostnamesOf(fs.readFileSync(TPL, "utf8"));
    // 2026-09-29 精简: 正解密面由 51 条收窄至 7 条 (仅 qidian 实际消费)。
    // 注: hostnamesOf 按设计已过滤负条目(去 %APPEND% / - 前缀), 故 tplHosts 即"正解密面"。
    // 原 "> 50" 断言写死了旧规模, 现改为按**实际消费面**判定 —— 收窄过度(删掉 qidian
    // 真正需要的 host)会静默失去净化能力, 那是比"规模缩水"更危险的失败方向。
    a.ok(tplHosts.length > 0, `模板 [MitM] 正解密面不应为空 (当前 ${tplHosts.length})`);
    for (const need of ["h5.if.qidian.com", "magev6.if.qidian.com"])
      a.ok(tplHosts.includes(need), `qidian 实际消费的解密面 ${need} 缺失 —— 收窄过度会静默失去净化能力`);

    // 免解密排除(负条目)由 mitm-orphan 门禁从产物侧另行校验, 此处只断言其仍在模板中
    // —— M4 的核心保证是银行域不进解密面, 与正解密面规模无关。
    const tplRaw = fs.readFileSync(TPL, "utf8");
    const negLine = (tplRaw.match(/^hostname\s*=\s*(.*)$/m) || ["", ""])[1];
    const negCount = negLine.split(",").map((x) => x.trim()).filter((x) => x.startsWith("-")).length;
    a.ok(negCount >= 40, `负条目(银行/Apple 免解密排除) 应保留, 当前 ${negCount} 条 —— 归零即破坏 M4 保证`);
    const orphans = [];
    for (const dir of ["Plugin"]) {
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

  "mitm-coverage: 解析器不得对已迁移插件空转 (新语法失明即红)": async (a) => {
    // 背景 (2026-09-29): qidian [Rewrite] 迁到 Loon 3.5.1(978) 新语法后, rulesOf
    // 匹配 0 条, 而下面两处都是 `if (!rules.length) continue` —— 插件被**整段跳过**,
    // 无解密面检查与 generic 锁定同时"全绿"。即: 门禁越是解析不了, 报得越干净。
    // 本例把 "[Rewrite] 有实质行 ⇒ 必须解析出等量规则" 钉死, 让失明立刻判红。
    const rows = [];
    for (const dir of ["Plugin"]) {
      for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith(".plugin")).sort()) {
        if (SKIP.has(f)) continue;
        const txt = fs.readFileSync(path.join(ROOT, dir, f), "utf8");
        if (!txt.split(/\r?\n/).some((l) => l.trim() === "[Rewrite]")) continue;
        const seg = (txt.split("[Rewrite]")[1] || "").split(/\n\[[A-Za-z ]+\]/)[0] || "";
        const substantive = seg
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#")).length;
        const got = rulesOf(txt, "Rewrite").length;
        rows.push(`${dir}/${f}: [Rewrite] 实质行 ${substantive}, 解析出 ${got}`);
        a.ok(
          got > 0,
          `${dir}/${f} 的 [Rewrite] 有 ${substantive} 条实质规则却解析出 0 条 —— rulesOf 不认识该语法, 后续检查会整段跳过 (假绿)`
        );
        a.equal(
          got,
          substantive,
          `${dir}/${f} 的 [Rewrite] 存在未被 rulesOf 识别的行 (旧/新语法解析器有盲区)`
        );
      }
    }
    a.ok(rows.length > 0, `应至少检查 1 个含 [Rewrite] 的插件, 实际 ${rows.length}`);
  },

  "mitm-coverage: generic (host 不可静态抽取) 集合锁定": async (a) => {
    const m = await load();
    const tplHosts = hostnamesOf(fs.readFileSync(TPL, "utf8"));
    const generics = [];
    for (const dir of ["Plugin"]) {
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
