/**
 * tools/rule-shadow-check.mjs 行为回归 (2026-09-11 深度审计 NEW-05)
 *
 * 该工具取代了 mirror-scripts.yml 里那段硬编码 20 个关键词的 grep。旧门禁的
 * 两个独立缺陷都在这里被锁住:
 *   1. **方向反了** — 旧检查查的是"Global 里有没有广告域", 而真正的静默失效是反向的:
 *      Global 是 Proxy 列表且排在三个 REJECT 列表之前, 其 DOMAIN-KEYWORD 是宽匹配,
 *      会抢先命中后续 REJECT 条目。`findShadowed` 必须能识别这个方向。
 *   2. **关键词表写死** — 上游新增组合天然漏检。现改为对**实际列表内容**求交集。
 *
 * 另覆盖 `isCompensated`: 被遮蔽条目必须由本地 [Rule] 的 REJECT 兜底才算通过。
 */
"use strict";

const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

// 动态 import() 而非 require(esm): 后者需 Node ≥22.12, 会无谓抬高 engines 下限。
let mod = null;
const load = async () => (mod ??= await import("../../tools/rule-shadow-check.mjs"));

exports.tests = {
  "shadow: sectionLines 精确切出段落 (不含后续段头)": async (a) => {
    const { sectionLines } = await load();
    const tpl = ["[Rule]", "A, x, REJECT", "", "[Remote Rule]", "B, y, Proxy", "[MitM]", "C"].join("\n");
    a.equal(sectionLines(tpl, "Rule"), ["A, x, REJECT", ""], "[Rule] 应止于下一个段头");
    a.equal(sectionLines(tpl, "Remote Rule"), ["B, y, Proxy"], "[Remote Rule] 应止于 [MitM]");
    a.equal(sectionLines(tpl, "Nope"), [], "不存在的段落返回空数组");
  },

  "shadow: parseRuleLines 解析类型/策略并跳过注释与宏行": async (a) => {
    const { parseRuleLines } = await load();
    const rules = parseRuleLines([
      "# 注释",
      "",
      "{% include \"./snippet/x.tpl\" %}",
      "DOMAIN-KEYWORD, googleads, REJECT",
      "DOMAIN-SUFFIX,google.com,Streaming",
      "DOMAIN, g.co, Proxy",
      "FINAL, Final",
    ]);
    a.equal(rules.length, 4, "注释/空行/宏行应被跳过");
    a.equal(rules[0], { type: "DOMAIN-KEYWORD", pattern: "googleads", policy: "REJECT" }, "含空格形式");
    a.equal(rules[1].pattern, "google.com", "无空格形式也应解析");
    a.equal(rules[3].type, "FINAL", "FINAL 无 policy 时 policy 为空串");
  },

  "shadow: parseRemoteRules 保持文件顺序并解出 name/policy": async (a) => {
    const { parseRemoteRules } = await load();
    const out = parseRemoteRules([
      "# 注释",
      "https://ws.wenn.in/main/Mirror/rules/loon-China.list, policy=DIRECT, tag=🇨🇳 国内域名, enabled=true",
      "https://ws.wenn.in/main/Mirror/rules/loon-Global.list, policy=Proxy, tag=🌍 国际域名, enabled=true",
    ]);
    a.equal(out.length, 2, "两行都应解析");
    a.equal(out[0].name, "China", "应从 URL basename 解出列表名");
    a.equal(out[0].policy, "DIRECT", "应解出 policy");
    a.equal(out[1].name, "Global", "顺序必须保持 (顺序即语义)");
    a.equal(out[1].policy, "Proxy", "应解出 policy");
  },

  "shadow: findShadowed 命中 Proxy 关键词抢先 REJECT 条目 (NEW-05 方向)": async (a) => {
    const { findShadowed } = await load();
    const lists = [
      { name: "Global", policy: "Proxy", rules: [{ type: "DOMAIN-KEYWORD", pattern: "google" }] },
      { name: "Advertising", policy: "REJECT", rules: [{ type: "DOMAIN-KEYWORD", pattern: "googleads" }] },
    ];
    const hit = findShadowed(lists);
    a.equal(hit.length, 1, "应识别出 1 条遮蔽");
    a.equal(hit[0].from, "Global", "遮蔽方应为靠前的 Proxy 列表");
    a.equal(hit[0].to, "Advertising", "被遮蔽方应为靠后的 REJECT 列表");
    a.equal(hit[0].entry.pattern, "googleads", "应指向具体被遮蔽条目");
    a.equal(hit[0].keyword, ["google"], "应记录命中的关键词");
  },

  "shadow: findShadowed 在 REJECT 列表靠前时不报遮蔽 (顺序即语义)": async (a) => {
    const { findShadowed } = await load();
    const lists = [
      { name: "Advertising", policy: "REJECT", rules: [{ type: "DOMAIN-KEYWORD", pattern: "googleads" }] },
      { name: "Global", policy: "Proxy", rules: [{ type: "DOMAIN-KEYWORD", pattern: "google" }] },
    ];
    a.equal(findShadowed(lists).length, 0, "REJECT 靠前时不存在遮蔽");
  },

  "shadow: findShadowed 忽略 IP-CIDR 等非域名类条目": async (a) => {
    const { findShadowed } = await load();
    const lists = [
      { name: "Global", policy: "Proxy", rules: [{ type: "DOMAIN-KEYWORD", pattern: "google" }] },
      { name: "Advertising", policy: "REJECT", rules: [
        { type: "IP-CIDR", pattern: "1.2.3.0/24" },
        { type: "URL-REGEX", pattern: "^https?://.*google.*" },
      ] },
    ];
    a.equal(findShadowed(lists).length, 0, "IP-CIDR/URL-REGEX 不参与域名关键词遮蔽判定");
  },

  "shadow: isCompensated 认同样类型精确与更宽的 KEYWORD 兜底": async (a) => {
    const { isCompensated } = await load();
    const entry = { type: "DOMAIN-KEYWORD", pattern: "googleads" };
    a.equal(
      isCompensated(entry, [{ type: "DOMAIN-KEYWORD", pattern: "googleads", policy: "REJECT" }]),
      true, "同类型同模式应算已兜底");
    a.equal(
      isCompensated(entry, [{ type: "DOMAIN-KEYWORD", pattern: "googlead", policy: "REJECT" }]),
      true, "更宽的 KEYWORD (子串包含) 也应算已兜底");
    a.equal(
      isCompensated(entry, [{ type: "DOMAIN-KEYWORD", pattern: "googleads", policy: "Proxy" }]),
      false, "非 REJECT 的兜底无效 (仍会被代理)");
    a.equal(
      isCompensated(entry, [{ type: "DOMAIN-SUFFIX", pattern: "googleads.com", policy: "REJECT" }]),
      false, "SUFFIX 不等于 KEYWORD, 覆盖不到 googleads.g.doubleclick.net");
    a.equal(isCompensated(entry, []), false, "无本地规则时应判未兜底");
  },

  "shadow: 仓库实际状态应通过 (遮蔽面已被本地规则兜住)": async (a) => {
    const { run } = await load();
    a.equal(run(ROOT), 0, "仓库当前状态应通过规则顺序遮蔽检查");
  },
};
