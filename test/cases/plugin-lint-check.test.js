/**
 * tools/plugin-lint-check.mjs 行为回归 (2026-09-19 官方文档对齐)
 *
 * 锁住三条 2026-09-19 新增的规则 —— 它们全部来自 Loon 官方文档语义:
 *   1. `[Rule]` 段禁用 `REJECT-DROP` (docs/Policy/: DROP 无响应 → App 立即重试 → 请求风暴)
 *   2. 裸 `DOMAIN-KEYWORD` 必须被锚定 (docs/Rule/sub_rule/: KEYWORD 随条数涨耗时;
 *      双样板 = bilibili-pro AND(SUFFIX,…) / qidian AND(USER-AGENT,…); 策略占位行豁免)
 *   3. 可疑 Rewrite 动作与裸 reject 的**报告**通道 (url/list/splash-reject/裸 reject)
 *
 * 另有 corpus 级断言: 真实仓库 61 个插件必须 0 errs —— 门禁自身的"fail-before"是
 * 反过来的: 新增规则若误报, 这条用例会立刻红 (而不是等人肉审计发现)。
 */
"use strict";

// 动态 import() 而非 require(esm): 后者需 Node ≥22.12, 会无谓抬高 engines 下限。
let mod = null;
const load = async () => (mod ??= await import("../../tools/plugin-lint-check.mjs"));

exports.tests = {
  "plugin-lint: [Rule] 段 REJECT-DROP 判红 (DROP→REJECT 迁移的伴随门禁)": async (a) => {
    const { lintText } = await load();
    const bad = lintText("[Rule]\nDOMAIN, x.com, REJECT-DROP,enable={A}\n", { dir: "Plugin", file: "t.plugin" });
    a.ok(bad.errs.some((e) => e.includes("DROP禁用于Rule")), "REJECT-DROP 应判红");
    const good = lintText("[Rule]\nDOMAIN, x.com, REJECT,enable={A}\n", { dir: "Plugin", file: "t.plugin" });
    a.equal(good.errs.length, 0, "REJECT 不应判红");
  },
  "plugin-lint: 裸 DOMAIN-KEYWORD 判红, 策略占位/AND 锚定/上游豁免不判红": async (a) => {
    const { lintText } = await load();
    const bare = lintText("[Rule]\nDOMAIN-KEYWORD,stun,REJECT\n", { dir: "Plugin", file: "t.plugin" });
    a.ok(bare.errs.some((e) => e.includes("KEYWORD裸奔")), "裸 KEYWORD 应判红");
    const policy = lintText("[Rule]\nDOMAIN-KEYWORD,openai,{AI_Policy}\n", { dir: "Plugin", file: "t.plugin" });
    a.equal(policy.errs.length, 0, "策略占位行 (分流非拦截) 应豁免");
    const anchored = lintText(
      "[Rule]\nAND,((DOMAIN-SUFFIX,bilibili.com),(DOMAIN-KEYWORD,stun)),REJECT\n",
      { dir: "Plugin", file: "t.plugin" }
    );
    a.equal(anchored.errs.length, 0, "AND(SUFFIX,…) 锚定形态应豁免");
    const kelee = lintText("[Rule]\nDOMAIN-KEYWORD,stun,REJECT\n", { dir: "Kelee", file: "t.plugin" });
    a.equal(kelee.errs.length, 0, "Kelee 上游外壳豁免 (上游不可改)");
  },
  "plugin-lint: 可疑 Rewrite 动作只报告不判红 (url/list/splash-reject)": async (a) => {
    const { lintText } = await load();
    for (const line of [
      "^https:\\/\\/a\\.com\\/x url reject-200",
      "^https:\\/\\/a\\.com\\/y list reject-200",
      "^https:\\/\\/a\\.com\\/z splash-reject",
    ]) {
      const r = lintText(`[Rewrite]\n${line}\n`, { dir: "Plugin", file: "t.plugin" });
      a.equal(r.errs.length, 0, `可疑动作不应判红: ${line}`);
      a.ok(r.reports.some((x) => x.includes("Rewrite动作可疑")), `应报告可疑: ${line}`);
    }
  },
  "plugin-lint: 裸 reject 报告可被 # no-retry 豁免": async (a) => {
    const { lintText } = await load();
    const r1 = lintText("[Rewrite]\n^https:\\/\\/a\\.com\\/ad reject enable={A}\n", { dir: "Plugin", file: "t.plugin" });
    a.ok(r1.reports.some((x) => x.includes("裸reject待确认")), "裸 reject 应进入报告清单");
    a.equal(r1.errs.length, 0, "裸 reject 是报告级, 不判红");
    const r2 = lintText("[Rewrite]\n^https:\\/\\/a\\.com\\/ad reject enable={A} # no-retry\n", { dir: "Plugin", file: "t.plugin" });
    a.ok(!r2.reports.some((x) => x.includes("裸reject待确认")), "# no-retry 应豁免");
  },
  "plugin-lint: enable 括号损坏与 [Script] 段外行判红": async (a) => {
    const { lintText } = await load();
    const bracket = lintText("[Rewrite]\n^https:\\/\\/a\\.com\\/x reject-200 enable={X&{Y}}\n", { dir: "Plugin", file: "t.plugin" });
    a.ok(bracket.errs.some((e) => e.includes("enable括号")), "enable={X&{Y}} 应判红");
    const outside = lintText("[Script]\nfloating-line\n", { dir: "Plugin", file: "t.plugin" });
    a.ok(outside.errs.some((e) => e.includes("Script段外行")), "[Script] 段外行应判红");
    // generic (手册触发) 是 docs/Script/ 明列的合法触发器 — 不得误报
    const generic = lintText(
      "[Script]\ngeneric script-path=https://ws.wenn.in/main/Scripts/Diagnostics.js, tag=链路诊断, timeout=15\n",
      { dir: "Plugin", file: "t.plugin" }
    );
    a.equal(generic.errs, [], "generic 触发器不得误报为段外行");
  },
  "plugin-lint: 真实仓库 corpus 全部通过 (新增规则零误报)": async (a) => {
    const { scanAll } = await load();
    const { errs, reports, files } = scanAll();
    a.equal(files, 61, "扫描 61 个插件 (Plugin 46 + Kelee 15)");
    a.equal(errs, [], `真实语料不得有 errs: ${errs.slice(0, 3).join(" | ")}`);
    a.ok(Array.isArray(reports), "报告通道存在 (裸 reject 待分拣清单)");
  },
};
