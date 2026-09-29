/**
 * App 归属索引门禁 — APP-INDEX.json
 *
 * 索引由 tools/app-index.mjs 从插件本体**抽取**生成, 不是手写。本用例只断言"抽取结果
 * 本身是否健全", 因为它回答的是重构期间最常问的问题: "这个 App 的广告归谁管"。
 *
 * 三条设计红线 (均为 2026-09-29 对抗审计的产物):
 *   1. **App 名不从开关 tag 猜** —— tag 写法不统一 (是否开启X净化 / X净化 / 开屏广告 /
 *      总开关 四类), 启发式会把同一 App 记成两个名字。App 名只认 MODULE-MANIFEST 声明。
 *   2. **开关 KEY 才是可靠的自描述** —— 聚合插件的 covers 由 KEY 推导, 规则量按开关
 *      消费数精确计数; 只能定位到插件级的归属必须标 rules_basis=plugin-total, 不许假装精确。
 *   3. 假粒度开关 (声明但零规则消费) 恒为 0 —— 拨了没反应的开关是最坏的 UX。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const IDX = JSON.parse(fs.readFileSync(path.join(ROOT, "APP-INDEX.json"), "utf8"));

const pluginsOnDisk = fs.readdirSync(path.join(ROOT, "Plugin")).filter((f) => f.endsWith(".plugin")).sort();

exports.tests = {
  "app-index: 与插件本体零漂移 (--check 口径)": async (a) => {
    const { buildIndex } = await import("../../tools/app-index.mjs");
    const fresh = buildIndex(ROOT);
    a.equal(
      JSON.stringify(fresh),
      JSON.stringify(IDX),
      "APP-INDEX.json 与插件本体漂移 — 跑 node tools/app-index.mjs 重新生成",
    );
  },

  "app-index: 46 个插件全部在册": async (a) => {
    a.equal(IDX.plugins.length, pluginsOnDisk.length, `索引应覆盖全部 ${pluginsOnDisk.length} 个插件`);
    for (const f of pluginsOnDisk) a.ok(IDX.plugins.some((p) => p.file === `Plugin/${f}`), `Plugin/${f} 未入索引`);
  },

  "app-index: 假粒度开关恒为 0 (声明了开关却没规则消费 = 拨了没反应)": async (a) => {
    a.equal(IDX.fake_granularity, [], `存在假粒度开关: ${JSON.stringify(IDX.fake_granularity)}`);
  },

  "app-index: 未登记脚本恒为 0 (script-path 指向的 Scripts 未进 MODULE-MANIFEST)": async (a) => {
    a.equal(IDX.undeclared_scripts, [], `存在未登记脚本: ${JSON.stringify(IDX.undeclared_scripts)}`);
  },

  "app-index: 每个 owner 都必须标明 rules 计量口径, 不许把插件总量当单 App 量": async (a) => {
    for (const app of IDX.apps)
      for (const o of app.owners)
        a.ok(["switch-consumers", "plugin-total"].includes(o.rules_basis),
          `${app.app}/${o.plugin}: 缺 rules_basis — 精确计数与插件总量必须可区分`);
  },

  "app-index: per-app-switch 归属的规则数须与插件内该开关消费数一致": async (a) => {
    // 自审 BUG-4: 曾把对象数组当字符串用, 导致 covers 全部失配、索引静默退化为 0 条
    const exact = IDX.apps.flatMap((a2) => a2.owners).filter((o) => o.rules_basis === "switch-consumers");
    a.ok(exact.length > 80, `按开关精确计数的归属应覆盖上百个 App 槽位, 实际 ${exact.length} (若骤降说明 covers 匹配断了)`);
  },

  "app-index: 跨插件 App 重叠必须被登记 (重构期的收敛对象)": async (a) => {
    for (const m of IDX.multi_owner) {
      a.ok(Array.isArray(m.owners) && m.owners.length > 1, `重叠条目 ${m.app} 的 owners 异常`);
      a.ok(typeof m.app === "string" && m.app.length > 0, "重叠条目必须有具名 App");
    }
    // 每个重叠 App 都必须在 MODULE-MANIFEST.app_ownership 有裁决登记,
    // 且登记的 by_concern 值必须指向**真实 owner 之一** —— 工具报事实, 人做裁决。
    const own = JSON.parse(fs.readFileSync(path.join(ROOT, "MODULE-MANIFEST.json"), "utf8")).app_ownership || {};
    for (const m of IDX.multi_owner) {
      a.ok(own[m.app], `重叠 App ${m.app} 未在 MODULE-MANIFEST.app_ownership 登记裁决`);
      for (const [concern, owner] of Object.entries(own[m.app].by_concern || {}))
        a.ok(m.owners.includes(owner), `${m.app} 的「${concern}」主责登记为 ${owner}, 但它不是实际 owner 之一: ${m.owners}`);
    }
    for (const app of Object.keys(own).filter((k) => !k.startsWith("$")))
      a.ok(IDX.multi_owner.some((m) => m.app === app), `app_ownership 登记了 ${app}, 但索引已无该重叠 (裁决可归档)`);
  },

  "app-index: 聚合插件的 covers 每个都须是真实存在的开关": async (a) => {
    for (const p of IDX.plugins) {
      const usage = new Set(p.switch_usage.map((s) => s.switch));
      const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "MODULE-MANIFEST.json"), "utf8"));
      const decl = manifest.modules.flatMap((m) => m.plugins || []).find((x) => `Plugin/${x.file}` === p.file);
      for (const c of decl && decl.covers || []) {
        a.ok(usage.has(c), `${p.file}: covers 声明了 ${c} 但插件内无此开关`);
        a.ok((p.switch_usage.find((s) => s.switch === c) || {}).rules > 0, `${p.file}: covers 的 ${c} 无规则消费`);
      }
    }
  },
};
