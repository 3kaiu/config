/**
 * tools/tpl-sync-check.mjs 的 customParams 双向契约断言 (2026-09-11 深度审计 NEW-13)
 *
 * 背景: `surgio.conf.js` 的 `customParams` 与 `template/**` 之间没有任何校验, 已连续两次
 * 出现同型缺陷 —— `surge_node_policy_path`(早些时候删除) 与 `dns_primary`/`dns_fallback`。
 * 后者形成**双源**: 取值恰好是 template/loon.tpl:11 硬编码 DNS 列表的首尾两台, 改
 * customParams 看似生效、实则硬编码才是真值。人工审计抓了两次 → 必须机械把关。
 *
 * 本文件既验证"判得准", 也验证"删参数后门禁不误红"(说明注释不得被当成声明)。
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const CONF = path.join(ROOT, "surgio.conf.js");

let mod = null;
const load = async () => (mod ??= await import("../../tools/tpl-sync-check.mjs"));

exports.tests = {
  // ── 真实仓库: 当前状态必须干净 ──
  "tpl-params: 真实 customParams 双向配对 (死参数与未声明键均为空)": async (a) => {
    const m = await load();
    const c = m.paramContract(fs.readFileSync(CONF, "utf8"), m.readAllTemplates());
    a.equal(c.dead, [], `不得有死参数, 实际: ${JSON.stringify(c.dead)}`);
    a.equal(c.missing, [], `不得有未声明的键, 实际: ${JSON.stringify(c.missing)}`);
    a.ok(c.declared.length > 0, "应至少声明一个 customParams 键");
  },

  "tpl-params: NEW-13 修复后 dns_primary/dns_fallback 不再是声明 (改它不生效的陷阱已移除)": async (a) => {
    const m = await load();
    const keys = m.declaredParams(fs.readFileSync(CONF, "utf8"));
    a.equal(keys.includes("dns_primary"), false, "dns_primary 应已移除");
    a.equal(keys.includes("dns_fallback"), false, "dns_fallback 应已移除");
    a.equal(keys.includes("surge_node_policy_path"), false, "surge_node_policy_path 应保持移除");
  },

  "tpl-params: 模板实际消费的 5 个键 (doh*/doq) 全部仍在声明中": async (a) => {
    const m = await load();
    const keys = m.declaredParams(fs.readFileSync(CONF, "utf8"));
    for (const k of ["doh_primary", "doh_fallback", "doh3_primary", "doh3_fallback", "doq_server"]) {
      a.ok(keys.includes(k), `${k} 应在声明中`);
    }
  },

  // ── 解析正确性 ──
  "tpl-params: 注释行不被当成声明 (删参数后门禁不误红)": async (a) => {
    const m = await load();
    const conf = [
      "module.exports = defineSurgioConfig({",
      "  customParams: {",
      "    // (已移除) dead_one: 'x',  <- 带冒号的说明注释, 最易被误判",
      "    // dead_two: 'y',",
      "    /* dead_three: 'z', */",
      "    live_one: 'a',",
      "  },",
      "});",
    ].join("\n");
    a.equal(m.declaredParams(conf), ["live_one"], "只应取出非注释行");
  },

  "tpl-params: 真实 conf 里的 (已移除) 说明注释确实含冒号 — 上一条测试不是空转": async (a) => {
    const conf = fs.readFileSync(CONF, "utf8");
    // 若说明注释没有冒号, 上一条"注释跳过"测试就失去了针对性
    a.ok(/^\s*\/\/.*dns_primary\s*\/\s*dns_fallback/m.test(conf), "应保留 dns_primary/dns_fallback 的移除说明");
    a.ok(/^\s*\/\/.*surge_node_policy_path:/m.test(conf), "应保留带冒号的 surge_node_policy_path 移除说明");
  },

  "tpl-params: 只统计 customParams 块内的键 (块外同名键不算)": async (a) => {
    const m = await load();
    const conf = [
      "  artifacts: [",
      "    { name: 'Loon.lcf', destDir: 'Profile' },",
      "  ],",
      "  customParams: {",
      "    a: '1',",
      "  },",
      "  other: {",
      "    b: '2',",
      "  },",
    ].join("\n");
    a.equal(m.declaredParams(conf), ["a"], "块外键不得混入");
  },

  "tpl-params: 模板引用解析 (含 snippet 内引用, 大括号内空白容忍)": async (a) => {
    const m = await load();
    const texts = ["doh-server = {{ customParams.doh_primary }}, {{customParams.doh_fallback}}", "y = {{  customParams.doq_server  }}"];
    const used = m.referencedParams(texts);
    a.ok(used.has("doh_primary"), "标准写法应识别");
    a.ok(used.has("doh_fallback"), "无空格写法应识别");
    a.ok(used.has("doq_server"), "大括号内多余空格应识别");
    a.equal(used.size, 3, "不得多算");
    // 刻意**不**容忍 `customParams . x` (点号两侧带空格): 真实模板无此写法, 若模板引擎
    // 也不支持, 把它算作"已消费"会造成假绿。宁可漏判也不误判。
    a.equal(m.referencedParams(["{{ customParams . x }}"]).size, 0, "点号带空格的写法不识别");
  },

  // ── 两个方向都要能拦 ──
  "tpl-params: 声明了但模板不引用 → dead 判出": async (a) => {
    const m = await load();
    const conf = "customParams: {\n    used: '1',\n    unused: '2',\n  },";
    const c = m.paramContract(conf, ["{{ customParams.used }}"]);
    a.equal(c.dead, ["unused"], "应判出死参数");
    a.equal(c.missing, [], "反向不应误报");
  },

  "tpl-params: 模板引用了但未声明 → missing 判出 (会渲染成空值)": async (a) => {
    const m = await load();
    const conf = "customParams: {\n    used: '1',\n  },";
    const c = m.paramContract(conf, ["{{ customParams.used }} {{ customParams.ghost }}"]);
    a.equal(c.dead, [], "正向不应误报");
    a.equal(c.missing, ["ghost"], "应判出未声明键");
  },

  "tpl-params: 两个方向同时出错时都不吞 (不因先报 dead 而漏报 missing)": async (a) => {
    const m = await load();
    const c = m.paramContract("customParams: {\n    unused: '1',\n  },", ["{{ customParams.ghost }}"]);
    a.equal(c.dead, ["unused"]);
    a.equal(c.missing, ["ghost"]);
  },

  // ── 门禁行为 ──
  "tpl-params: 真实仓库整体检查通过 (npm run check:sync 绿)": async (a) => {
    const out = execFileSync(process.execPath, ["tools/tpl-sync-check.mjs"], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
    a.ok(out.includes("customParams 5 个键双向配对"), `应报告参数配对, 实际: ${out.trim().slice(0, 200)}`);
  },

  "tpl-params: import 不触发 main (入口守卫生效, 否则测试进程会被 exit 掉)": async (a) => {
    const out = execFileSync(
      process.execPath,
      ["-e", 'import("./tools/tpl-sync-check.mjs").then(() => console.log("IMPORT_OK"));'],
      { cwd: ROOT, encoding: "utf8", timeout: 30000 }
    );
    a.equal(out.trim(), "IMPORT_OK", "import 应只输出 IMPORT_OK");
  },
};
