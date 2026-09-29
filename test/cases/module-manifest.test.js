/**
 * 资源模块清单门禁 — test/cases/module-manifest.test.js
 *
 * 断言 MODULE-MANIFEST.json 与磁盘实际资源**零偏差**:
 *   1. 每个 Plugin/*.plugin 恰好归入一个模块 (零未归类、零重复)
 *   2. 每个 Scripts/*.js 恰好归入一个模块
 *   3. 每个 template/snippet/*.tpl 恰好归入一个模块
 *   4. 枚举值合法 (module/layer/granularity)
 *   5. 每个归类都有 reason —— 防止"先塞进去以后再说"
 *   6. M1-M6 全覆盖, 每模块有 purpose/responsibilities
 *
 * 为什么不写成"注释清单": 清单若只存在于文档, 新增插件时会静默漏登记,
 * 而这正是本仓 `wiring-check` 当初想解决的那类死代码问题。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const MANIFEST = path.join(ROOT, "MODULE-MANIFEST.json");

const M = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

const VALID_LAYERS = new Set(["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L2+L3", "L2+L4", "L2+L6", "L4+L5", "L2+L4+L5", "L-", "L?"]);
const VALID_GRANULARITY = new Set(["single-app", "cross-app", "global"]);

const listDir = (rel, ext) => fs.readdirSync(path.join(ROOT, rel)).filter((f) => f.endsWith(ext)).sort();
const allPlugins = listDir("Plugin", ".plugin");
const allScripts = listDir("Scripts", ".js");
const allSnippets = listDir("template/snippet", ".tpl");

/** 收集清单里声明的成员, 并报告重复 */
function collect(key) {
  const seen = new Map();
  const dupes = [];
  for (const mod of M.modules) {
    for (const item of mod[key] || []) {
      if (seen.has(item.file)) dupes.push(`${item.file} (${seen.get(item.file)} 与 ${mod.id})`);
      else seen.set(item.file, mod.id);
    }
  }
  return { seen, dupes };
}

exports.tests = {
  "module: 46 个 Plugin 零未归类": async (a) => {
    const { seen } = collect("plugins");
    for (const f of allPlugins) a.ok(seen.has(f), `Plugin/${f} 未在 MODULE-MANIFEST.json 归类`);
    a.equal(seen.size, allPlugins.length, `清单应覆盖全部 ${allPlugins.length} 个插件, 实际 ${seen.size}`);
  },

  "module: 29 个 Scripts 零未归类": async (a) => {
    const { seen } = collect("scripts");
    for (const f of allScripts) a.ok(seen.has(f), `Scripts/${f} 未在 MODULE-MANIFEST.json 归类`);
    a.equal(seen.size, allScripts.length, `清单应覆盖全部 ${allScripts.length} 个脚本, 实际 ${seen.size}`);
  },

  "module: 全部 snippet 零未归类": async (a) => {
    const seen = new Set();
    for (const mod of M.modules)
      for (const s of (mod.tpl_resources && mod.tpl_resources.snippets) || []) seen.add(s);
    for (const f of allSnippets) a.ok(seen.has(f), `template/snippet/${f} 未归类`);
  },

  "module: 无插件/脚本被重复归为主责 (主责唯一; 次要职责走 also_members)": async (a) => {
    for (const key of ["plugins", "scripts"]) {
      const { dupes } = collect(key);
      a.equal(dupes, [], `${key} 主责重复: ${dupes.join(", ")}`);
    }
  },

  // 2026-09-29 对抗审计 E5: 审计前 schema 强制"一插件一模块", 结果是把 5 个真跨模块的插件
  // 误分类 (最典型 apple-services-pro 被塞进 M1 分流, 而它没有任何分流规则)。
  // 改为 primary 唯一 + also_members 表达次要职责后, 跨模块成为可表达的事实。
  "module: also_members 必须指向真实主责模块且带理由 (跨模块归属可追溯)": async (a) => {
    const { seen } = collect("plugins");
    const ids = new Set(M.modules.map((m) => m.id));
    for (const m of M.modules) {
      for (const a2 of m.also_members || []) {
        a.ok(seen.has(a2.file), `${m.id}: also_member ${a2.file} 不是任何模块的主责成员 (幽灵)`);
        a.ok(a2.from && a2.from !== m.id, `${m.id}/${a2.file}: from 须是另一模块且不等于自身`);
        a.ok(ids.has(a2.from), `${m.id}/${a2.file}: from="${a2.from}" 不是合法模块`);
        a.ok(a2.reason && a2.reason.length > 6, `${m.id}/${a2.file}: 缺跨模块理由`);
      }
    }
  },

  // 自审抓到 E6: 最初把 safari-webview-pro 同时写成 "M2 跨 M3" 与 "M3 跨 M2",
  // 等于同一段关系登记两次。语义应是: also 只在**次要责任方**声明一次。
  "module: also 声明不得重复 (同一 插件×模块 对只登记一次)": async (a) => {
    const seen = new Map();
    for (const m of M.modules)
      for (const x of m.also_members || []) {
        const k = `${x.file}→${m.id}`;
        a.ok(!seen.has(k), `${k} 重复登记 — also 只应在次要责任方声明一次 (主责方不要再写"跨 X")`);
        seen.set(k, true);
      }
  },

  "module: also 声明的 from 必须等于该插件的真实主责模块": async (a) => {
    const { seen: prim } = collect("plugins");
    for (const m of M.modules)
      for (const x of m.also_members || []) {
        const owner = prim.get(x.file);
        a.equal(x.from, owner, `${x.file} 挂在 ${m.id} 的 also, 但 from 写的是 ${x.from}, 真实主责是 ${owner}`);
      }
  },

  "module: M7 功能增强必须逐条给出规则消费证据 (拒绝仅凭措辞归类)": async (a) => {
    const m7 = M.modules.find((m) => m.id === "M7");
    a.ok(m7, "M7 应存在 —— 14/46 插件带真实功能解锁/签到规则, 审计 E4 判定原 M1-M6 为过早闭合");
    // 2026-09-29 精简: 45 个插件删除后仅剩 qidian.plugin, 而它**本身就是 M7 主责**。
    // 原断言要求 also_members 非空, 隐含"存在主责在别的模块、本模块只挂次要"的前提 ——
    // 该前提在单插件场景下不成立。故改为: M7 有主责成员 **或** 有跨模块次要成员, 二者其一即可。
    const m7Primary = (m7.plugins || []).length + (m7.scripts || []).length;
    a.ok(
      m7Primary > 0 || (m7.also_members || []).length > 0,
      "M7 既无主责成员也无次要成员 —— 空模块 (原断言要求 also_members 非空, " +
        "但单插件场景下 M7 主责插件无法把 from 指向自己, 断言自相矛盾)"
    );
    for (const x of m7.also_members || [])
      a.ok(/消费 \d+ 处|规则|cron|http-response|条改写/.test(x.reason),
        `M7/${x.file}: 理由须指明规则消费或 cron 事实, 实际 "${x.reason}"`);
  },

  "module: 清单无幽灵成员 (声明了但磁盘不存在)": async (a) => {
    const { seen: ps } = collect("plugins");
    const { seen: ss } = collect("scripts");
    for (const f of ps.keys()) a.ok(allPlugins.includes(f), `清单声明 Plugin/${f} 但磁盘不存在`);
    for (const f of ss.keys()) a.ok(allScripts.includes(f), `清单声明 Scripts/${f} 但磁盘不存在`);
  },

  "module: layer / granularity 枚举合法": async (a) => {
    for (const mod of M.modules) {
      a.ok(VALID_LAYERS.has(mod.layer), `${mod.id}: 未知 layer "${mod.layer}"`);
      for (const p of mod.plugins || []) {
        a.ok(VALID_GRANULARITY.has(p.granularity), `${mod.id}/${p.file}: 未知 granularity "${p.granularity}"`);
        a.ok(VALID_LAYERS.has(p.layer) || /L\d\+L\d/.test(p.layer), `${mod.id}/${p.file}: 未知 layer "${p.layer}"`);
      }
    }
  },

  "module: 每个归类都带 reason (禁止\"先塞进去以后再说\")": async (a) => {
    for (const mod of M.modules)
      for (const p of mod.plugins || [])
        a.ok(p.reason && p.reason.length > 6, `${mod.id}/${p.file} 缺归类理由`);
  },

  "module: M1-M7 全覆盖且各有 purpose / responsibilities": async (a) => {
    const ids = M.modules.map((m) => m.id).sort();
    a.equal(ids, ["M1", "M2", "M3", "M4", "M5", "M6", "M7"], `模块集合应为 M1-M7, 实际 ${ids.join(",")}`);
    for (const mod of M.modules) {
      a.ok(mod.purpose && mod.purpose.length > 8, `${mod.id} 缺 purpose`);
      a.ok(Array.isArray(mod.responsibilities) && mod.responsibilities.length > 0, `${mod.id} 缺 responsibilities`);
    }
  },

  "module: M2 广告治理必须自述跨层结构 (唯一跨 3 层的模块)": async (a) => {
    const m2 = M.modules.find((m) => m.id === "M2");
    a.ok(m2.internal_layers && m2.internal_layers.L2 && m2.internal_layers.L4 && m2.internal_layers.L5,
      "M2 必须显式区分 L2/L4/L5 三层处置 —— 这是它区别于其他模块的结构特征");
  },

  "module: 缺口台账非空且每条有 owner": async (a) => {
    a.ok(Array.isArray(M.gaps) && M.gaps.length > 0, "gaps 台账不应为空 (Loon 仍有未用能力)");
    for (const g of M.gaps) {
      a.ok(/^M[1-7]$/.test(g.owner), `缺口 ${g.id}: owner 须归到 M1-M7 之一, 实际 ${g.owner}`);
      a.ok(g.capability && g.used && g.impact, `缺口 ${g.id} 三要素 (capability/used/impact) 不完整`);
    }
  },

  "module: 自审台账存在且每条错误有标识与说明": async (a) => {
    a.ok(M.audit && Array.isArray(M.audit.found), "缺 audit 自审台账 (清单必须记录自己的错误史)");
    a.ok(M.audit.found.length > 0, "自审台账为空 —— 对抗审计若未抓到任何问题, 多半是没真查");
    for (const f of M.audit.found) a.ok(/^E\d/.test(f), `自审条目应带 E 编号: ${f.slice(0, 40)}`);
    a.ok(/对抗审计/.test(M.audit.method), "自审须写明方法");
  },

  "module: 已定论问题必须带官方依据": async (a) => {
    a.ok(Array.isArray(M.resolved) && M.resolved.length > 0, "resolved 台账不应为空");
    for (const r of M.resolved)
      a.ok(r.answer && r.consequence, `已定论问题缺 answer/consequence: ${r.question}`);
    // 优先级结论是本仓多处注释的依据, 一旦 Loon 改规则此处应最先被发现
    const pri = M.resolved.find((r) => /优先/.test(r.question));
    a.ok(pri && /官方/.test(pri.answer), "优先级结论必须标注官方文档来源");
  },
};
