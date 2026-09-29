#!/usr/bin/env node
/**
 * App 归属索引生成器 — node tools/app-index.mjs
 *
 * 解决的问题: 插件是按**上游作者的切分**组织的, 不是按 App 组织的。46 个插件里
 * 28 个的声明 app 是"XX聚合"(如 shopping-purify), 内部实际覆盖 60+ 个 App, 而这些
 * App 只写在开关 tag 与规则行里。结果是"改一下京东的广告处理"必须先知道京东在哪个
 * 插件 —— 而聚合插件内部有 22 个 App, 谁也说不清边界。
 *
 * 本工具从插件本体**抽取**(不手工维护)索引:
 *   App → { 主责插件, 控制开关, 消费规则数, 关联脚本, 介入层, 所属模块 }
 *
 * 为什么必须抽取而非手写: 手写的索引在下一次新增插件时必然漂移, 而"某 App 到底归谁"
 * 恰恰是重构期间最常问的问题 —— 答错一次就会在错误的位置加规则。
 *
 * 用法:
 *   node tools/app-index.mjs            生成/覆盖 APP-INDEX.json (退出码 0)
 *   node tools/app-index.mjs --check    只校验磁盘产物与抽取结果一致 (供门禁)
 *
 * 门禁接线: test/cases/app-index.test.js 断言零假粒度 / 零孤儿 / 索引与磁盘同步。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "APP-INDEX.json");

/**
 * ⚠️ 刻意**不**从开关 tag 猜 App 名 —— 2026-09-29 自审推翻的做法。
 *
 * 初衷是"是否开启 XXX 净化"是作者对 App 的自述, 可自动抽取。实测不成立:
 * 微信小程序在两个插件里都存在, 但 tag 写法不同 ——
 *   wechat-pro:              WECHAT_MINIPROGRAMS_ENABLE  tag=小程序净化
 *   social-netdisk-purify:   WEXINMINIPROGRAMS_REMOVE_…  tag=是否开启微信小程序净化
 * 启发式只认后者的"是否开启X"模式, 于是同一个 App 被记成两个名字 (其中一个还是空名,
 * 17 个插件被错误并入)。全仓 tag 写法至少有四类: 是否开启X净化 / X净化 /
 * 开屏广告 / 总开关, 无法用单一模式覆盖。
 *
 * 可靠的判定只有一条: **开关是否有规则消费** —— 这个用文本匹配即可, 零歧义。
 * App 归属改为**只在 MODULE-MANIFEST.json 声明**, 由 test 校验声明与磁盘一致。
 * 换言之: 索引的自动部分只做"开关 ↔ 规则"的硬事实, App 命名交给人。
 */

/** 抽取单个插件的开关与规则 */
function scanPlugin(file) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);
  const name = path.basename(file, ".plugin");

  // [Argument] 段: KEY=switch,"true","false",tag=...,desc=...
  const argSeg = text.split(/^\[Argument\]\s*$/m)[1]?.split(/^\[[A-Za-z ]+\]\s*$/m)[0] || "";
  const switches = [];
  for (const line of argSeg.split("\n")) {
    const m = /^([A-Z0-9_]+)=switch,"([^"]*)","([^"]*)"(.*)$/.exec(line.trim());
    if (!m) continue;
    const key = m[1];
    const rest = m[4] || "";
    const tag = (/tag=([^,，]*)/.exec(rest) || [])[1]?.trim() || "";
    const desc = (/desc=([^,，]*)/.exec(rest) || [])[1]?.trim() || "";
    switches.push({ key, tag, desc });
  }

  // 规则行: 统计每个开关的规则消费数 (enable={A}&{B} 算两侧都消费)
  // 注意 slice 起点必须跳过段头本身, 否则 split 会立刻在段头处断开 (自审 BUG-1)
  const ruleSeg = ["[Rewrite]", "[Script]", "[Rule]"]
    .map((s) => {
      const head = `\n${s}\n`;
      const i = text.indexOf(head);
      if (i < 0) return "";
      return text.slice(i + head.length).split(/\n\[[A-Za-z ]+\]/)[0];
    })
    .join("\n");
  const ruleLines = ruleSeg
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && /[=|]/.test(l));

  const consumers = new Map();
  for (const line of ruleLines) {
    for (const m of line.matchAll(/\{([A-Z0-9_]+)\}/g)) {
      if (!switches.some((s) => s.key === m[1])) continue;
      consumers.set(m[1], (consumers.get(m[1]) || 0) + 1);
    }
  }

  const scripts = [...new Set([...text.matchAll(/Scripts\/([A-Za-z0-9_-]+\.js)/g)].map((m) => m[1]))].sort();
  const rewriteCount = ruleLines.filter((l) => /^\^|https?:\\?\/\\?\//.test(l)).length;
  const mitmHosts = (text.split(/^\[MitM\]\s*$/m)[1] || "").match(/^hostname\s*=\s*(.*)$/m)?.[1] || "";

  return { rel, name, switches, consumers, ruleLines: ruleLines.length, scripts, rewriteCount, mitmHostCount: mitmHosts.split(",").filter(Boolean).length };
}

/** 聚合: 构建 app → 归属 */
export function buildIndex(root = ROOT) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "MODULE-MANIFEST.json"), "utf8"));
  const modOf = new Map();
  for (const m of manifest.modules) for (const p of m.plugins || []) modOf.set(p.file, m.id);
  // covers 索引: "<plugin file>::<SWITCH>" → App 名。App 名由**开关 KEY** 决定
  // (KEY 自描述: LUCKINCOFFEE_ENABLE→瑞幸咖啡), 不用 tag —— tag 写法不统一, 见文件头说明。
  const coversOf = new Map();
  const KEY_TO_APP = {
    LUCKINCOFFEE_ENABLE: "瑞幸咖啡", SPOTIFY_ENABLE: "Spotify", WPS_ENABLE: "WPS",
    REDDIT_ENABLE: "Reddit", KUGOU_ENABLE: "酷狗音乐", DOUYU_ENABLE: "斗鱼",
    MANGOTV_ENABLE: "芒果TV", WEXINMINIPROGRAMS_REMOVE_ENABLE: "微信小程序",
    QQ_MUSIC: "QQ音乐", FEISHU_ENABLE: "Feishu",
  };
  for (const m of manifest.modules)
    for (const p2 of m.plugins || [])
      for (const k of p2.covers || []) {
        const app = KEY_TO_APP[k] || (k.replace(/^(APP_)?/, "").replace(/_?ENABLE$/, "").replace(/_/g, " "));
        coversOf.set(`${p2.file}::${k}`, app);
      }
  const manifestScriptApp = new Map();
  for (const m of manifest.modules) for (const sc of m.scripts || []) manifestScriptApp.set(sc.file, sc);

  const plugins = fs
    .readdirSync(path.join(root, "Plugin"))
    .filter((f) => f.endsWith(".plugin"))
    .sort()
    .map((f) => scanPlugin(path.join(root, "Plugin", f)));

  const apps = new Map();
  const undeclaredScripts = [];
  const fakeGranularity = [];

  for (const p of plugins) {
    const pname = p.name + ".plugin";
    const m = modOf.get(pname) || "M?";
    for (const s of p.switches) {
      const uses = p.consumers.get(s.key) || 0;
      if (uses === 0) fakeGranularity.push({ plugin: pname, switch: s.key, tag: s.tag });
    }
    // 脚本 → App 归属: 取自 MODULE-MANIFEST.json 的 scripts[].app 字段,
    // **不**从脚本文件名猜 —— 文件名是实现细节 (traffic-notify/health-notify 根本不是 App)。
    for (const sc of p.scripts) {
      const rec = manifestScriptApp.get(sc);
      if (!rec) { undeclaredScripts.push({ plugin: pname, script: sc }); continue; }
      if (!apps.has(rec.app)) apps.set(rec.app, { app: rec.app, owners: [] });
      const own = apps.get(rec.app).owners;
      const hit = own.find((o) => o.plugin === pname);
      if (hit) hit.script = sc;
      else own.push({ plugin: pname, module: m, script: sc, rules: p.ruleLines, rules_basis: "plugin-total", granularity: "via-script" });
    }
    // 跨 App 聚合: 逐 App 展开 covers, 规则量取该开关的消费数 (可精确到单 App)
    for (const sw of p.switches) {          // 注意 switches 是**对象**数组, 不是字符串
      const cov = coversOf.get(`${pname}::${sw.key}`);
      if (!cov) continue;
      if (!apps.has(cov)) apps.set(cov, { app: cov, owners: [] });
      const own = apps.get(cov).owners;
      if (!own.some((o) => o.plugin === pname))
        own.push({ plugin: pname, module: m, switch: sw.key, rules: p.consumers.get(sw.key) || 0, rules_basis: "switch-consumers", granularity: "per-app-switch" });
    }
    // 插件自身的 App 归属: 只认 manifest 声明, 不猜
    const declared = (manifest.modules.find((x) => x.id === m)?.plugins || []).find((p2) => p2.file === pname);
    if (declared && declared.covers && declared.covers.length) {
      // 聚合插件: covers 里的 App 才是它的真归属, declared.app ("XX聚合") 仅作门面
      continue;
    }
    if (declared && declared.app) {
      if (!apps.has(declared.app)) apps.set(declared.app, { app: declared.app, owners: [] });
      const own = apps.get(declared.app).owners;
      // 同一插件可能已由 script 路径登记过 → 合并, 不重复建 owner (自审 BUG-3)
      const hit = own.find((o) => o.plugin === pname);
      if (hit) {
        hit.granularity = declared.granularity;
        hit.covers = declared.covers || hit.covers || null;
        hit.rules = Math.max(hit.rules || 0, p.ruleLines);
      } else {
        own.push({
          plugin: pname, module: m, switch: null, rules: p.ruleLines,
          rules_basis: "plugin-total",
          granularity: declared.granularity, covers: declared.covers || null,
        });
      }
    }
  }

  // 多重归属 = 同一 App 被多个插件管 (重构期必须收敛的信号)
  const multi = [];
  for (const [k, v] of apps) if (v.owners.length > 1) multi.push({ app: k, owners: v.owners.map((o) => o.plugin) });

  return {
    schema_version: 1,
    plugin_count: plugins.length,
    app_count: apps.size,
    multi_owner: multi.sort((a, b) => a.app.localeCompare(b.app)),
    fake_granularity: fakeGranularity,
    undeclared_scripts: undeclaredScripts,
    apps: [...apps.values()].sort((a, b) => a.app.localeCompare(b.app)),
    plugins: plugins.map((p) => ({
      file: p.rel,
      module: modOf.get(p.name + ".plugin") || "M?",
      switches: p.switches.length,
      rules: p.ruleLines,
      scripts: p.scripts,
      mitm_hosts: p.mitmHostCount,
      // 逐开关的消费度 —— 这是索引里唯一全自动且零歧义的事实
      switch_usage: p.switches
        .map((s2) => ({ switch: s2.key, rules: p.consumers.get(s2.key) || 0, tag: s2.tag }))
        .sort((a, b) => a.switch.localeCompare(b.switch)),
    })),
  };
}

export function main() {
  const check = process.argv.includes("--check");
  const idx = buildIndex();
  const text = JSON.stringify(idx, null, 2) + "\n";
  if (check) {
    if (!fs.existsSync(OUT)) { console.error("❌ APP-INDEX.json 不存在, 先跑 node tools/app-index.mjs"); process.exit(1); }
    const onDisk = fs.readFileSync(OUT, "utf8");
    if (onDisk !== text) { console.error("❌ APP-INDEX.json 与插件本体漂移 — 跑 node tools/app-index.mjs 重新生成"); process.exit(1); }
    console.log(`✅ App 索引与插件本体一致 (${idx.app_count} 个 App / ${idx.plugin_count} 个插件)`);
    return;
  }
  fs.writeFileSync(OUT, text);
  console.log(`✅ 已生成 APP-INDEX.json — ${idx.app_count} 个 App / ${idx.plugin_count} 个插件`);
  console.log(`   多重归属: ${idx.multi_owner.length} · 假粒度开关: ${idx.fake_granularity.length} · 未登记脚本: ${idx.undeclared_scripts.length}`);
  if (idx.undeclared_scripts.length) {
    console.error("   ⛔ 以下 script-path 未登记进 MODULE-MANIFEST.json, 无法判定 App 归属:");
    for (const u of idx.undeclared_scripts) console.error(`      ${u.plugin} → Scripts/${u.script}`);
    process.exitCode = 1;
  }
}

const isEntry = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) main();
