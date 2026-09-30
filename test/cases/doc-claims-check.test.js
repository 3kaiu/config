/**
 * tools/doc-claims-check.mjs 行为回归 (2026-09-18 优化审计, 2026-09-29 扩面)
 *
 * 背景: NEW-04/MOD-10 两处"文档与实测漂移"(34,579 条 SUFFIX 实测 0 / "跟随 latest"
 * 实测停在旧版)的根因是文档数字无自动校验。本工具把可机械反算的数字固化为断言;
 * 本用例锁其判定逻辑: 红路径 + 真仓库端态。
 *
 * 2026-09-29 扩面: 起因是 MODULES.md 与 MODULE-MANIFEST.json 的数字面**无门禁**,
 * 483/120/121/122 长期与实测(490/127)不符, 且 manifest 内部自相矛盾。现三文件一起扫,
 * 跨文件矛盾判红; 并新增 rejectRules 与「每个插件 N 个域」两类断言。
 *
 * 端态用例的含义: 改文档数字而不同步产物(或反之) → npm test 红。
 * 添加新用例会改变用例总数 → AGENTS.md 的"N 个行为级用例"必须同步更新,
 * 否则本文件的端态断言立即变红 —— 这正是该门禁要强制的纪律。
 */
"use strict";

const path = require("path");

let mod = null;
const load = async () => (mod ??= await import("../../tools/doc-claims-check.mjs"));

const claimsOf = (pairs) =>
  new Map(pairs.map(([k, ns]) => [k, { values: ns.map((n) => ({ n, line: 1 })), pattern: "" }]));
const MEASURED = { testCases: 225, ruleLines: 481, rejectRules: 90, scripts: 27, plugins: 45, devDeps: 3, nodeReq: "22" };
const OK_CLAIMS = [
  ["testCases", [225]], ["scriptArtifacts", [27]], ["ruleLines", [481]],
  ["rejectRules", [90]], ["pluginTotal", [45]], ["devDeps", [3]],
];

exports.tests = {
  "claims: 文档与实测一致 → 0 fail": async (a) => {
    const { check } = await load();
    const { fails, rows } = check(claimsOf(OK_CLAIMS), MEASURED, { claimsText: "engines.node >= 22" });
    a.equal(fails.length, 0, "全一致时无失败");
    a.equal(rows.length, 7, "7 项断言全记录 (6 项 expect + nodeReq)");
  },
  "claims: 文档漂移 (文档 230 vs 实测 225) → 红": async (a) => {
    const { check } = await load();
    const claims = claimsOf(OK_CLAIMS.map(([k, v]) => (k === "testCases" ? [k, [230]] : [k, v])));
    const { fails } = check(claims, MEASURED, { claimsText: "engines.node >= 22" });
    a.equal(fails.length, 1, "仅用例数漂移");
    a.equal(fails[0].key, "testCases", "漂移键正确");
    a.equal(fails[0].reason, "mismatch", "原因=mismatch");
  },
  "claims: 声明被删除 → 红 (missing-claim)": async (a) => {
    const { check } = await load();
    const claims = claimsOf(OK_CLAIMS.filter(([k]) => k !== "testCases"));
    const { fails } = check(claims, MEASURED, { claimsText: "engines.node >= 22" });
    a.equal(
      fails.filter((f) => f.key === "testCases" && f.reason === "missing-claim").length,
      1,
      "缺失声明必须红 — 否则改写文档句式即静默脱检"
    );
  },
  // 跨文件矛盾: AGENTS.md 说 490 行, MODULES.md 说 483 行 —— 这正是 2026-09-29 真实发生过的
  // 漂移形状 (两处数字各自"看起来对", 只有一起看才矛盾)。带 source 的报错要能指出两个文件。
  "claims: 跨文件自相矛盾 (AGENTS 490 vs MODULES 483) → 红且能定位来源": async (a) => {
    const { check } = await load();
    const claims = claimsOf(OK_CLAIMS.map(([k, v]) => (k === "ruleLines" ? [k, [490, 483]] : [k, v])));
    claims.get("ruleLines").values[0].source = "AGENTS.md";
    claims.get("ruleLines").values[1].source = "MODULES.md";
    const { fails, rows } = check(claims, MEASURED, { claimsText: "engines.node >= 22" });
    a.equal(fails[0].reason, "contradiction", "两处不同值即矛盾, 不许取其一放行");
    a.ok(
      /AGENTS\.md.*MODULES\.md/.test(rows.find((r) => r.label === "[Rule] 非注释行数").detail),
      "报错须带来源文件, 否则定位不到该改哪一份"
    );
  },
  "claims: engines.node 文档≠package.json → 红": async (a) => {
    const { check } = await load();
    const { fails } = check(claimsOf(OK_CLAIMS), MEASURED, { claimsText: "engines.node >= 24" });
    a.equal(fails.filter((f) => f.key === "nodeReq").length, 1, "engines 漂移必须红");
  },
  "claims: JSON 真源(MODULE-MANIFEST)里的字符串同样被提取": async (a) => {
    const { extractClaimsFromJson } = await load();
    const claims = extractClaimsFromJson(
      { modules: [{ id: "M9", plugins: [{ reason: "12 域, 纯 L2" }], responsibilities: ["主配置 127 条 REJECT"] }] },
      "MODULE-MANIFEST.json"
    );
    a.equal(claims.get("rejectRules").values.length, 1, "嵌套数组里的字符串也要走到");
    a.equal(claims.get("rejectRules").values[0].n, 127, "取值正确");
    a.equal(claims.get("rejectRules").values[0].source, "MODULE-MANIFEST.json", "来源标签正确");
    a.equal(claims.get("ruleLines").values.length, 0, "无该形态声明时为空 (不猜)");
  },
  "端态 (真仓库): 三文件的 7 项声明与当前产物全一致": async (a) => {
    const { extractClaims, extractClaimsFromJson, mergeClaims, measure, check, CLAIM_FILES, CLAIM_JSON, ROOT } = await load();
    const fs = await import("node:fs");
    const texts = CLAIM_FILES.map((f) => ({ f, text: fs.readFileSync(path.join(ROOT, f), "utf8") }));
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, CLAIM_JSON), "utf8"));
    const claims = mergeClaims(
      ...texts.map(({ f, text }) => extractClaims(text, f)),
      extractClaimsFromJson(manifest, CLAIM_JSON)
    );
    const measured = await measure();
    const agentsText = texts.find((t) => t.f === "AGENTS.md").text;
    const { fails, rows } = check(claims, measured, { claimsText: agentsText });
    a.equal(fails.length, 0, `文档与实测漂移: ${JSON.stringify(fails)}`);
    a.equal(rows.length, 7, "断言面应恰为 7 项 (增删断言须同步本用例)");
  },
  // manifest 里最多的一类声明: 每个插件的「N 个域」。它必然随插件增删域而漂,
  // 且无法用全局正则断言 (会与"共 38 域"这类汇总互相判成矛盾)。
  // 2026-09-30 平台集合化后断言面 = 1 个 ad-block 集合 (59 域) + 6 个 probe-* = 7 项。
  "端态 (真仓库): 每个插件的「N 个域」声明与插件本体一致": async (a) => {
    const { checkPluginDomains, ROOT } = await load();
    const { fails, rows } = checkPluginDomains(ROOT);
    a.equal(fails.length, 0, `插件域数声明漂移: ${JSON.stringify(fails)}`);
    a.ok(rows.length >= 7, `断言面 ${rows.length} 项 (期望 ≥7: 1 个 ad-block 集合 + 6 个 probe-*); ` +
      "新增带域数声明的插件须同步抬高本下限, 否则可静默脱检");
  },
};
