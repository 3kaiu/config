/**
 * tools/doc-claims-check.mjs 行为回归 (2026-09-18 优化审计)
 *
 * 背景: NEW-04/MOD-10 两处"文档与实测漂移"(34,579 条 SUFFIX 实测 0 / "跟随 latest"
 * 实测停在旧版)的根因是文档数字无自动校验。本工具把 AGENTS.md 的可机械反算数字
 * 固化为断言; 本用例锁其判定逻辑: 四条红路径 + 真仓库端态。
 *
 * 端态用例的含义: 改文档数字而不同步产物(或反之) → npm test 红。
 * 添加新用例会改变用例总数 → AGENTS.md 的"N 个行为级用例"必须同步更新,
 * 否则本文件的端态断言立即变红 —— 这正是该门禁要强制的纪律。
 *
 * 维护注意 (2026-09-19 移除免费代理订阅): 删除 test/cases/geonode-sync.test.js
 * 使总数 231 → 220 (该文件 11 例)。删减用例文件时同样必须同步 AGENTS.md 数字。
 */
"use strict";

const path = require("path");

let mod = null;
const load = async () => (mod ??= await import("../../tools/doc-claims-check.mjs"));

const claimsOf = (pairs) =>
  new Map(pairs.map(([k, ns]) => [k, { values: ns.map((n) => ({ n, line: 1 })), pattern: "" }]));
const MEASURED = { testCases: 225, ruleLines: 481, scripts: 27, plugins: 45, kelee: 15, devDeps: 3, nodeReq: "22" };

exports.tests = {
  "claims: 文档与实测一致 → 0 fail": async (a) => {
    const { check } = await load();
    const claims = claimsOf([
      ["testCases", [225]], ["scriptArtifacts", [27]], ["ruleLines", [481]],
      ["pluginTotal", [60]], ["devDeps", [3]], ["keleeCount", [15]],
    ]);
    const { fails, rows } = check(claims, MEASURED, { claimsText: "engines.node >= 22" });
    a.equal(fails.length, 0, "全一致时无失败");
    a.equal(rows.length, 7, "7 项断言全记录");
  },
  "claims: 文档漂移 (文档 230 vs 实测 225) → 红": async (a) => {
    const { check } = await load();
    const claims = claimsOf([
      ["testCases", [230]], ["scriptArtifacts", [27]], ["ruleLines", [481]],
      ["pluginTotal", [60]], ["devDeps", [3]], ["keleeCount", [15]],
    ]);
    const { fails } = check(claims, MEASURED, { claimsText: "engines.node >= 22" });
    a.equal(fails.length, 1, "仅用例数漂移");
    a.equal(fails[0].key, "testCases", "漂移键正确");
    a.equal(fails[0].reason, "mismatch", "原因=mismatch");
  },
  "claims: 声明被删除 → 红 (missing-claim)": async (a) => {
    const { check } = await load();
    const claims = claimsOf([
      ["scriptArtifacts", [27]], ["ruleLines", [481]],
      ["pluginTotal", [60]], ["devDeps", [3]], ["keleeCount", [15]],
    ]);
    const { fails } = check(claims, MEASURED, { claimsText: "engines.node >= 22" });
    a.equal(
      fails.filter((f) => f.key === "testCases" && f.reason === "missing-claim").length,
      1,
      "缺失声明必须红 — 否则改写文档句式即静默脱检"
    );
  },
  "claims: 文档自相矛盾 (225 与 227 并存) → 红": async (a) => {
    const { check } = await load();
    const claims = claimsOf([
      ["testCases", [225, 227]], ["scriptArtifacts", [27]], ["ruleLines", [481]],
      ["pluginTotal", [60]], ["devDeps", [3]], ["keleeCount", [15]],
    ]);
    const { fails } = check(claims, MEASURED, { claimsText: "engines.node >= 22" });
    a.equal(fails[0].reason, "contradiction", "两处不同值即矛盾, 不许取其一放行");
  },
  "claims: engines.node 文档≠package.json → 红": async (a) => {
    const { check } = await load();
    const claims = claimsOf([
      ["testCases", [225]], ["scriptArtifacts", [27]], ["ruleLines", [481]],
      ["pluginTotal", [60]], ["devDeps", [3]], ["keleeCount", [15]],
    ]);
    const { fails } = check(claims, MEASURED, { claimsText: "engines.node >= 24" });
    a.equal(fails.filter((f) => f.key === "nodeReq").length, 1, "engines 漂移必须红");
  },
  "端态 (真仓库): AGENTS.md 7 项声明与当前产物全一致": async (a) => {
    const { extractClaims, measure, check, ROOT } = await load();
    const fs = await import("node:fs");
    const text = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
    const claims = extractClaims(text);
    const measured = await measure();
    const { fails, rows } = check(claims, measured, { claimsText: text });
    a.equal(fails.length, 0, `文档与实测漂移: ${JSON.stringify(fails)}`);
    a.equal(rows.length, 7, "断言面应恰为 7 项 (增删断言须同步本用例)");
  },
};
