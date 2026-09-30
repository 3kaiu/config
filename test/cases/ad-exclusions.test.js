/**
 * 广告平台「已否决面必须不存在对应规则」门禁 (2026-09-29)
 *
 * 这是 AGENTS.md 广告面治理纪律里那条**只写在文档里、没人守**的断言:
 *   「已否决面必须不存在对应规则(防上游误伤回流)」
 * 台账与判据在 tools/lib/ad-exclusions.mjs; 扫描原语在 tools/lib/rule-scan.mjs;
 * 决策理由在 APP-ONBOARDING.md 附六。
 *
 * 为什么值得单独一个门禁: 排除决策的失效方式不是报错, 而是**后人顺手补一条规则**
 * —— 本仓已犯过"凭域名字义加 REJECT"的错(京东 du.jd.com 是店铺域, 拦了破店铺页)。
 * 这类回归没有任何运行时症状, 只有断言能抓。
 */
"use strict";

let mod = null;
let scan = null;
const load = async () => (mod ??= await import("../../tools/lib/ad-exclusions.mjs"));
const loadScan = async () => (scan ??= await import("../../tools/lib/rule-scan.mjs"));

exports.tests = {
  "ad-exclusions: 台账自洽 (域唯一 / 语义合法 / 理由类别闭集 / 取证非空)": async (a) => {
    const { AD_PLATFORM_EXCLUSIONS: EX, ALLOWED_KINDS, REASON_KINDS } = await load();
    a.ok(EX.length >= 5, `台账 ${EX.length} 条 (期望 ≥5) —— 条数变少说明排除决策被静默删除`);
    const seen = new Set();
    for (const e of EX) {
      a.ok(/^[a-z0-9.-]+\.[a-z]{2,}$/.test(e.domain), `${e.domain} 域名形态合法`);
      a.ok(["whole", "apex"].includes(e.mode), `${e.domain} 语义合法 (whole|apex), 实为 ${e.mode}`);
      a.ok(e.reason && e.reason.length >= 6, `${e.domain} 必须写理由 —— 台账不是清单`);
      a.ok(
        ALLOWED_KINDS[e.mode].includes(e.reason_kind),
        `${e.domain} reason_kind=${e.reason_kind} 不在 ${e.mode} 的闭集 [${ALLOWED_KINDS[e.mode]}] 内` +
          ` (可选: ${Object.keys(REASON_KINDS).join("/")})`
      );
      // 存活断言是**闭集之外**的第三类, 且是实测买过教训的: apex 无 A ≠ 域已死。
      // 允许它回来等于允许"无法证伪的过度断言"回来。
      a.ok(
        !/死域|已死|解析\s*0\s*条|永不命中/.test(e.reason),
        `${e.domain} 理由含存活断言("死域/永不命中") —— 本仓实测教训: apex 无 A ≠ 域已死,` +
          ` A 记录存在 ≠ 端点存在(泛解析)。请改成结构性理由(merged/site/infra),` +
          ` 或把该项移出排除台账转"未决候选"。`
      );
      a.ok(
        e.evidence && /APP-ONBOARDING\.md/.test(e.evidence),
        `${e.domain} 取证必须指向可核对来源 (本仓不接受"我记得")`
      );
      a.ok(!seen.has(e.domain), `${e.domain} 不得重复登记`);
      seen.add(e.domain);
    }
  },

  // whole: 已死域 / 已并入他方 / 主站有正常内容 —— 连子域也不该有规则。
  "ad-exclusions: 整域排除的域不得有任何规则命中 (含子域)": async (a) => {
    const { AD_PLATFORM_EXCLUSIONS: EX } = await load();
    const { collectRules, ruleHits, ROOT } = await loadScan();
    const rules = collectRules(ROOT);
    const hits = [];
    for (const e of EX.filter((x) => x.mode === "whole")) {
      for (const r of rules) {
        const type = ruleHits(r.text, e.domain, "whole");
        if (type) hits.push(`${e.domain} ← ${r.source}:${r.line} [${type}] ${r.text}`);
      }
    }
    a.equal(
      hits.length,
      0,
      `已否决面出现了规则(误伤回流):\n  ${hits.join("\n  ")}\n` +
        `处置: 删掉该规则, 或若决策已变, 连台账理由 + APP-ONBOARDING 附六一起改 —— 不许只改一处。`
    );
  },

  // apex: 含开发者后台 / 引擎本体 —— 整域拦会破功能, 但精确的广告子域该拦。
  "ad-exclusions: 只拦子域的平台, 裸域不得被拦": async (a) => {
    const { AD_PLATFORM_EXCLUSIONS: EX } = await load();
    const { collectRules, ruleHits, ROOT } = await loadScan();
    const rules = collectRules(ROOT);
    const hits = [];
    for (const e of EX.filter((x) => x.mode === "apex")) {
      for (const r of rules) {
        const type = ruleHits(r.text, e.domain, "apex");
        if (type) hits.push(`${e.domain} ← ${r.source}:${r.line} [${type}] ${r.text}`);
      }
    }
    a.equal(
      hits.length,
      0,
      `裸域被拦(整域拦会破功能: 开发者后台/引擎本体):\n  ${hits.join("\n  ")}\n` +
        `处置: 改成精确到已取证的广告子域; 若确有整域拦的理由, 先做 DoH+HTTPS 取证再改台账。`
    );
  },

  // 扫描面地板: 扫描器一旦失效(段落识别漂移/路径变化)命中集恒为空, 上面两条会**静默转绿**。
  "ad-exclusions: 扫描面地板 (主配置与插件都要真的扫到)": async (a) => {
    const { collectRules, ROOT } = await loadScan();
    const rules = collectRules(ROOT);
    a.ok(rules.length >= 550, `规则行 ${rules.length} 条 (期望 ≥550: 主配置 490 + 插件约 109) —— 过低说明扫描面失效`);
    const fromTpl = rules.filter((r) => r.source === "Profile/Loon.lcf").length;
    const fromPlugin = rules.filter((r) => r.source.startsWith("Plugin/")).length;
    a.ok(fromTpl >= 400, `主配置扫到 ${fromTpl} 条 (期望 ≥400)`);
    a.ok(fromPlugin >= 100, `插件扫到 ${fromPlugin} 条 (期望 ≥100) —— 插件段没扫到, 排除面就漏了一半`);
  },
};
