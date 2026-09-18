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

  "shadow: findShadowed 识别 DIRECT 遮蔽者 (2026-09-18: China 是 DIRECT, 旧实现只认 Proxy 而漏检)": async (a) => {
    const { findShadowed } = await load();
    const lists = [
      { name: "China", policy: "DIRECT", rules: [{ type: "DOMAIN-KEYWORD", pattern: "aliyun" }] },
      { name: "Advertising", policy: "REJECT", rules: [{ type: "DOMAIN-KEYWORD", pattern: "adash.man.aliyuncs.com" }] },
    ];
    const hit = findShadowed(lists);
    a.equal(hit.length, 1, "DIRECT 列表同样抢先命中并终止扫描, 必须视为遮蔽者");
    a.equal(hit[0].from, "China", "遮蔽方是 DIRECT 列表");
    a.equal(hit[0].hit, ["DOMAIN-KEYWORD,aliyun"], "命中描述应含类型+模式");
  },

  "shadow: findShadowed 识别 DOMAIN-SUFFIX 遮蔽 (旧实现只比 KEYWORD 漏掉后缀吞并)": async (a) => {
    const { findShadowed } = await load();
    const lists = [
      { name: "China", policy: "DIRECT", rules: [{ type: "DOMAIN-SUFFIX", pattern: "cn" }] },
      { name: "Hijacking", policy: "REJECT", rules: [{ type: "DOMAIN-SUFFIX", pattern: "189zj.cn" }] },
    ];
    const hit = findShadowed(lists);
    a.equal(hit.length, 1, "`cn` 后缀应吞掉 189zj.cn");
    a.equal(hit[0].hit, ["DOMAIN-SUFFIX,cn"], "命中应为后缀类");
    // 方向性: 更窄的后缀不能吞更宽的后缀
    a.equal(findShadowed([
      { name: "A", policy: "DIRECT", rules: [{ type: "DOMAIN-SUFFIX", pattern: "x.com.cn" }] },
      { name: "B", policy: "REJECT", rules: [{ type: "DOMAIN-SUFFIX", pattern: "cn" }] },
    ]).length, 0, "DOMAIN-SUFFIX,x.com.cn 不遮蔽 DOMAIN,cn (子集关系方向反了)");
    a.equal(findShadowed([
      { name: "A", policy: "DIRECT", rules: [{ type: "DOMAIN", pattern: "ads.example.com" }] },
      { name: "B", policy: "REJECT", rules: [{ type: "DOMAIN", pattern: "ads.example.com" }] },
    ]).length, 1, "DOMAIN 精确相等也算完全遮蔽");
  },

  "shadow: findShadowed 视 REJECT→REJECT 为等价而非遮蔽, 且通配前缀归一": async (a) => {
    const { findShadowed } = await load();
    a.equal(findShadowed([
      { name: "Ad", policy: "REJECT", rules: [{ type: "DOMAIN-KEYWORD", pattern: "ads" }] },
      { name: "Hijack", policy: "REJECT", rules: [{ type: "DOMAIN-KEYWORD", pattern: "adsense" }] },
    ]).length, 0, "两个 REJECT 列表间不存在策略性遮蔽 (行为等价: 都拦)");
    a.equal(findShadowed([
      { name: "P", policy: "Proxy", rules: [{ type: "DOMAIN-SUFFIX", pattern: "example.com" }] },
      { name: "R", policy: "REJECT", rules: [{ type: "DOMAIN-KEYWORD", pattern: "*.example.com" }] },
    ]).length, 1, "QX 通配前缀 `*.` 应剥掉后参与子串比较");
  },

  "shadow: parseRemoteRules 由 URL 解出仓库内路径 (goodbyeads 无 loon- 前缀不再被硬拼路径吞掉)": async (a) => {
    const { parseRemoteRules } = await load();
    const out = parseRemoteRules([
      "https://ws.wenn.in/main/Mirror/rules/loon-China.list, policy=DIRECT, tag=a, enabled=true",
      "https://ws.wenn.in/main/Mirror/rules/goodbyeads-qx.list, tag=b, policy=REJECT, enabled=true",
    ]);
    a.equal(out[0].rel, "rules/loon-China.list", "loon- 前缀列表路径");
    a.equal(out[1].rel, "rules/goodbyeads-qx.list", "无 loon- 前缀列表路径必须按 URL 推出 —— 旧实现硬拼 loon-goodbyeads-qx.list 导致整张 117k 表静默跳过检查");
    a.equal(out[1].name, "goodbyeads-qx", "name 保留原始 basename");
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

  "shadow: 仓库实际状态 — 拦截区前置, 残余遮蔽仅 goodbyeads 两对且全部登记接受": async (a) => {
    const { run, ACCEPTED_PAIRS } = await load();
    a.equal(run(ROOT), 0, "重排后仓库当前状态应通过 (残余对已登记)");
    // 端态断言: 防止有人改回旧顺序 / 删掉登记而不补兜底 —— 那会让上面 run() 的 0
    // 变成"门禁绕行"。顺序契约: 拦截区 (REJECT) 必须先于 China/Global。
    a.equal(ACCEPTED_PAIRS.size, 2, "登记表应恰为 goodbyeads 两对 (清理须走用例变更)");
    const { parseRemoteRules, sectionLines } = await load();
    const tpl = require("fs").readFileSync(require("path").join(ROOT, "template", "loon.tpl"), "utf8");
    const refs = parseRemoteRules(sectionLines(tpl, "Remote Rule"));
    a.equal(
      JSON.stringify(refs.map((r) => [r.name, r.policy])),
      JSON.stringify([
        ["Advertising", "REJECT"], ["Privacy", "REJECT"], ["Hijacking", "REJECT"],
        ["China", "DIRECT"], ["Global", "Proxy"], ["goodbyeads-qx", "REJECT"], ["Epic", "Proxy"],
      ]),
      "[Remote Rule] 顺序契约: 拦截区前置, goodbyeads 压轴 (见 loon.tpl 排序注释)",
    );
  },

  "shadow: run 的登记表可注入 — 未登记的遮蔽对必须判红 (负向证明)": async (a) => {
    const { run } = await load();
    // 空登记表 → 残余的 China/Global→goodbyeads 两对无人认领 → 必须红 (exit 1)。
    // 这是"接受不是静默的"的机制证明: 删掉登记表条目, 门禁立刻变红。
    a.equal(run(ROOT, new Map()), 1, "未登记的遮蔽对应判红");
    // 只登记其中一对 → 仍红 (另一对没人认领)
    a.equal(
      run(ROOT, new Map([["China→goodbyeads-qx", { reason: "x", reviewBy: "y" }]])),
      1, "只登记一对仍应判红 (另一对未认领)");
  },
};
