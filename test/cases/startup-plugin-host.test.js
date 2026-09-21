/**
 * tools/build-startup-plugin.mjs 行为回归 (2026-09-11 深度审计 NEW-09)
 *
 * 背景: 上游 hostname 是**不可信输入**, 而 `validHost()` 对含 `*` 的写法一律放行,
 * 于是 `*ziben.com` (可匹配 evilziben.com)、`*.flyert.*` (可匹配 a.flyert.任意域)
 * 被原样透传进 [MitM] hostname — 对非预期域开启 HTTPS 解密, 扩大证书暴露面。
 *
 * 覆盖:
 *   1. isBoundaryUnsafe — 判定"该模式能否匹配到多个注册域"
 *   2. normalizeHost   — 可无损修复的 (前导 `*` 无点) 展开; 不可修复的剔除
 *   3. 真实数据管线    — 用 Mirror 上游 conf 跑一遍, 断言产出列表零边界不安全项
 *   4. 产物一致性      — Plugin/startup-adblock-pro.plugin == f(上游 conf)
 *   5. 入口守卫        — import 本模块不得改写 Plugin/ 产物
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "Mirror", "rules", "ddgksf-StartUpAds.conf");
const OUT = path.join(ROOT, "Plugin", "startup-adblock-pro.plugin");
const XIMALAYA = path.join(ROOT, "Plugin", "ximalaya-pro.plugin");

// 动态 import() 而非 require(esm): 后者需 Node ≥22.12, 会无谓抬高 engines 下限
let mod = null;
const load = async () => (mod ??= await import("../../tools/build-startup-plugin.mjs"));

/** 从 .plugin 文本中取出 [MitM] hostname 列表 (去 %APPEND% / 负包含) */
const hostnamesOf = (txt) => {
  const m = txt.match(/^hostname\s*=\s*(.*)$/m);
  if (!m) return [];
  return m[1]
    .replace(/^%APPEND%\s*,?\s*/, "")
    .split(",")
    .map((h) => h.trim())
    .filter((h) => h && !h.startsWith("-") && !h.startsWith("%"));
};

exports.tests = {
  // ── isBoundaryUnsafe: 安全形态 ──
  "startup-host: 安全通配形态不误判 (真实清单取样)": async (a) => {
    const m = await load();
    const safe = [
      "*.zhijianmedia.cn", "*.weathercn.com", "*.tianmu.mobi", "*.1rtb.net",
      "*.ximalaya.com", "*.ximalaya.com.cn",
      "pinggai*.caixin.com", "emdcad*.eastmoney.com", "mage*.if.qidian.com",
      "p*.meituan.net", "interface*.music.163.com",
      "www.flyert.com", "ziben.com", "*.ziben.com", "gaoqingdianshi.com",
      "203.107.1.97", "misc.eol.cn",
    ];
    for (const h of safe) a.equal(m.isBoundaryUnsafe(h), false, `${h} 应判为安全`);
  },

  // ── isBoundaryUnsafe: 边界不安全形态 ──
  "startup-host: 边界不安全通配被判定 (TLD 位 / 二级域 / 跨标签)": async (a) => {
    const m = await load();
    const unsafe = [
      "*ziben.com",              // 前导 * 无点 → 可匹配 evilziben.com
      "*gaoqingdianshi.com",     // 同上
      "*.flyert.*",              // TLD 位通配 → 可匹配 a.flyert.任意域
      "*mangaapi.manhuaren.*",   // 同上
      "api-access.pangolin-sdk-toutiao.*com", // TLD 位 (*com)
      "120.241.*",               // TLD 位
      "*.xima*.com",             // 二级域中段通配 → 可匹配 ximaevil.com
      "*.xima*.cn",
      "a.*.com",                 // 裸 * 不在最左 → 跨标签吞点
      "foo.bar*.com",            // 二级域含通配 → 改写注册域
      "splash.*",
      "..com",                   // 空标签
    ];
    for (const h of unsafe) a.equal(m.isBoundaryUnsafe(h), true, `${h} 应判为边界不安全`);
  },

  // ── normalizeHost: 无损展开 ──
  "startup-host: 前导 `*` 无点 → 无损展开为裸域 + 子域通配": async (a) => {
    const m = await load();
    const r1 = m.normalizeHost("*ziben.com");
    a.equal(r1.unsafe, false, "*ziben.com 可无损修复");
    a.equal(r1.hosts, ["ziben.com", "*.ziben.com"], "*ziben.com 展开");
    const r2 = m.normalizeHost("*gaoqingdianshi.com");
    a.equal(r2.hosts, ["gaoqingdianshi.com", "*.gaoqingdianshi.com"], "展开");
    // 展开后的两条都必须是安全形态 (否则修复无意义)
    for (const h of r1.hosts.concat(r2.hosts)) a.equal(m.isBoundaryUnsafe(h), false, `${h} 展开后应安全`);
  },

  "startup-host: 不可无损修复的形态 → unsafe 且不产出 host": async (a) => {
    const m = await load();
    for (const h of ["*.flyert.*", "*mangaapi.manhuaren.*", "*.xima*.com", "120.241.*"]) {
      const r = m.normalizeHost(h);
      a.equal(r.unsafe, true, `${h} 应标记 unsafe`);
      a.equal(r.hosts.length, 0, `${h} 不应产出 host`);
    }
  },

  "startup-host: 安全形态原样返回 (含裸 `*.suffix` 与 IPv4)": async (a) => {
    const m = await load();
    for (const h of ["*.weathercn.com", "pinggai*.caixin.com", "203.107.1.97", "ziben.com"]) {
      const r = m.normalizeHost(h);
      a.equal(r.unsafe, false, `${h} 安全`);
      a.equal(r.hosts, [h], `${h} 应原样返回`);
    }
  },

  // ── 真实数据管线 ──
  "startup-host: 真实上游 conf 跑一遍 → 产出列表零边界不安全项": async (a) => {
    const m = await load();
    const parsed = m.parseConf(fs.readFileSync(SRC, "utf8"));
    const { rules } = m.buildRules(parsed.rejects);
    const upstreamHosts = m.upstreamHostsOf(parsed.mitmBody);
    const { kept, unsafe } = m.minimizeHosts(upstreamHosts, rules);
    const bad = kept.filter((h) => m.isBoundaryUnsafe(h));
    a.equal(bad, [], "产出 hostname 不得含边界不安全通配");
    // 已知的两条上游"内部标签通配"必须被剔除且被报告
    a.ok(unsafe.includes("*.flyert.*"), "*.flyert.* 应被剔除");
    a.ok(unsafe.includes("*mangaapi.manhuaren.*"), "*mangaapi.manhuaren.* 应被剔除");
    // 前导 `*` 无点的两条必须已展开 (原形不得残留)
    a.equal(kept.includes("*ziben.com"), false, "*ziben.com 原形不应残留");
    a.equal(kept.includes("ziben.com"), true, "ziben.com 裸域应在场");
    a.equal(kept.includes("*.ziben.com"), true, "*.ziben.com 应在场");
    a.equal(kept.includes("gaoqingdianshi.com"), true, "gaoqingdianshi.com 裸域应在场");
    a.equal(kept.includes("*.gaoqingdianshi.com"), true, "*.gaoqingdianshi.com 应在场");
    // 展开不得引入重复
    a.equal(new Set(kept).size, kept.length, "产出列表应无重复项");
  },

  "startup-host: 每个上游 hostname 都有归宿 (未被静默吞掉)": async (a) => {
    const m = await load();
    const parsed = m.parseConf(fs.readFileSync(SRC, "utf8"));
    const { rules } = m.buildRules(parsed.rejects);
    const upstreamHosts = m.upstreamHostsOf(parsed.mitmBody);
    const { kept, dropped, unsafe } = m.minimizeHosts(upstreamHosts, rules);
    const keptSet = new Set(kept);
    const lost = [];
    for (const h of upstreamHosts) {
      // 归宿三选一: 未消费剔除 / 边界不安全剔除 / 规范化后进入产出
      if (dropped.includes(h) || unsafe.includes(h)) continue;
      const { hosts } = m.normalizeHost(h);
      if (!hosts.every((x) => keptSet.has(x))) lost.push(h);
    }
    a.equal(lost, [], "上游 hostname 不得静默丢失");
    // 展开只会增加条目: kept 数量 = 存活数 + 展开增量
    const survived = upstreamHosts.filter((h) => !dropped.includes(h) && !unsafe.includes(h)).length;
    a.ok(kept.length >= survived, `kept(${kept.length}) 应 ≥ 存活数(${survived})`);
  },

  // ── 通配覆盖报告 (P2-3, 2026-09-19; 计数口径 2026-09-20 收敛为根域子串) ──
  "startup-host: 通配覆盖报告 — 根域口径计数, 真实管线零消费通配 = 0": async (a) => {
    const m = await load();
    // 夹具: 仅含通配条目入报告, 消费数按根域统计
    const rows = m.wildcardReport(
      ["*.ziben.com", "api.foo.com"],
      [{ regex: "^https?:\\/\\/api\\.ziben\\.com\\/x" }, { regex: "^https?:\\/\\/other\\.com" }]
    );
    a.equal(rows.length, 1, "非通配条目不进报告");
    a.equal(rows[0], { host: "*.ziben.com", rules: 1 }, "消费数应正确");
    // 回归: 旧实现取最左 label 子串 — `p*.meituan.net` → label "p" 会命中 449 条。
    // 根域口径下实测应为个位数 (当前上游 6 条); 若回退到 label 口径, 本断言即红。
    const meituanRows = m.wildcardReport(
      ["p*.meituan.net"],
      Array.from({ length: 449 }, (_, i) => ({ regex: `^https://x${i}.p${i}.com/y` }))
    );
    a.equal(meituanRows[0].rules, 0, "label 口径回归: 无 meituan.net 根域的规则不得被计入");
    // 真实管线: 通配全部有规则消费 (0 消费 = 纯解密面浪费, 报告应能暴露)
    const parsed = m.parseConf(fs.readFileSync(SRC, "utf8"));
    const { rules } = m.buildRules(parsed.rejects);
    const upstreamHosts = m.upstreamHostsOf(parsed.mitmBody);
    const { kept } = m.minimizeHosts(upstreamHosts, rules);
    const real = m.wildcardReport(kept, rules);
    a.ok(real.length > 0, "真实管线应有通配条目");
    a.equal(real.filter((r) => r.rules === 0), [], "不得存在零消费通配");
  },

  // ── 手写块 host 并入 [MitM] (2026-09-21 回归修复: 去掉 splash.*/ad.*/flash.*
  //    边界不安全通配后, 手写块精确 host 必须显式并入, 否则 https 规则静默失效) ──
  "startup-host: 手写块规则 host 并入 [MitM], 死规则 veto 域不回流": async (a) => {
    const m = await load();
    const manual = m.extractManualBlock(fs.readFileSync(OUT, "utf8"));
    const manualLines = manual.split("\n").filter((l) => l);
    const { hosts, unsafe } = m.manualMitmHosts(manualLines);
    // 精确域示例须并入 (此前被 splash.* 通配盖住, NEW-09 剔除后失去解密面)
    for (const h of ["ad.m.taobao.com", "splash.jd.com", "flash.qq.com", "app.abc.china.cn", "api.amap.com"]) {
      a.ok(hosts.includes(h), `${h} 应并入 [MitM] (手写块 reject 规则)`);
    }
    // alternation 展开: (yy|6rooms) → 两个精确域
    a.ok(hosts.includes("ads.api.yy.com"), "(yy|6rooms) 展开 → ads.api.yy.com");
    a.ok(hosts.includes("ads.api.6rooms.com"), "(yy|6rooms) 展开 → ads.api.6rooms.com");
    // 被模板 veto 的银行域 (规则已删) 不得回流
    a.equal(hosts.includes("m.ccb.com"), false, "m.ccb.com 规则已删, host 不应并入");
    a.equal(hosts.includes("app.cmbchina.com"), false, "app.cmbchina.com 规则已删, host 不应并入");
    // 跨标签通配 (api.wan..*.weixin.qq.com) 无法安全表达精确域 → 剔除并报告
    a.equal(hosts.includes("api.wan..*.weixin.qq.com"), false, "跨标签通配不得并入 [MitM]");
    a.ok(unsafe.length >= 1, "跨标签通配应在 unsafe 报告中可见");
    a.ok(hosts.every((h) => !m.isBoundaryUnsafe(h)), "并入的 host 全部边界安全");
    // 与产物联动: [MitM] hostname 实际包含本次并入 (artifact 一致性以外)
    const mitm = hostnamesOf(fs.readFileSync(OUT, "utf8"));
    for (const h of ["ad.m.taobao.com", "splash.jd.com", "flash.qq.com", "app.abc.china.cn"]) {
      a.ok(mitm.includes(h), `产物 [MitM] 应含手写块 host ${h}`);
    }
  },

  // ── 产物一致性 (生成器 ↔ 提交产物, 等价于 Loon.lcf 的 artifact-idempotency) ──
  "startup-host: 产物 == f(上游 conf) — 生成器与提交产物无漂移": async (a) => {
    const m = await load();
    const parsed = m.parseConf(fs.readFileSync(SRC, "utf8"));
    const { rules, seen, droppedGarbage } = m.buildRules(parsed.rejects);
    const upstreamHosts = m.upstreamHostsOf(parsed.mitmBody);
    const { kept, dropped, unsafe } = m.minimizeHosts(upstreamHosts, rules);
    const manualBlock = m.extractManualBlock(fs.readFileSync(OUT, "utf8"));
    const expected = m.renderPlugin({
      updateTime: parsed.updateTime, rules, rejects: parsed.rejects, seen, droppedGarbage,
      scripts: parsed.scripts, hostRules: parsed.hostRules, manualBlock,
      kept, dropped, unsafe, upstreamCount: upstreamHosts.length,
    });
    a.equal(expected, fs.readFileSync(OUT, "utf8"), "Plugin/startup-adblock-pro.plugin 应与生成器输出逐字节一致");
  },

  // ── script 型条目台账 (2026-09-20, 精准去广告审计) ──
  "startup-host: script 型条目全分诊 (covered/extra/pending, 零 unregistered)": async (a) => {
    const m = await load();
    const parsed = m.parseConf(fs.readFileSync(SRC, "utf8"));
    const rows = m.scriptLedger(parsed.scripts);
    a.equal(rows.length, parsed.scripts.length, "台账应逐条覆盖全部 script 条目");
    const unreg = rows.filter((r) => r.status === "unregistered");
    a.equal(unreg, [], "不允许未登记条目 — 上游新增 script 条目时此断言判红, 需人工分诊");
    const byStatus = (s) => rows.filter((r) => r.status === s).length;
    a.equal(byStatus("covered"), 14, "covered 14 (2026-09-20 path 级核对)");
    a.equal(byStatus("extra"), 5, "extra 5 (delivery_show/queryInfoFlow/GetSplashAd + 2026-09-22 get_all_advertise/cardes)");
    a.equal(byStatus("pending"), 8, "pending 8 (待真机/已判定不做)");
    const tokens = m.SCRIPT_LEDGER.map(([t]) => t);
    a.equal(new Set(tokens).size, tokens.length, "SCRIPT_LEDGER token 应唯一, 否则匹配语义漂移");
  },

  "startup-host: EXTRA_REJECTS 规则与 host 同生 — 规则进 [Rewrite], host 进 [MitM]": async (a) => {
    const m = await load();
    const txt = fs.readFileSync(OUT, "utf8");
    const hosts = hostnamesOf(txt);
    a.ok(m.EXTRA_REJECTS.length > 0, "EXTRA_REJECTS 非空");
    for (const e of m.EXTRA_REJECTS) {
      a.includes(txt, e.regex, `${e.host} 规则应出现在产物 [Rewrite]`);
      a.includes(txt, ` ${e.action} enable={ENABLE_STARTUP}`, `${e.host} 动作 ${e.action} 应在场`);
      a.equal(hosts.includes(e.host), true, `${e.host} 应并入 [MitM] hostname (与规则配对, 防 mitm-orphan)`);
      a.equal(m.isBoundaryUnsafe(e.host), false, `${e.host} 应为安全 host 形态`);
    }
  },

  "startup-host: 生成器不再产出死开关 STARTUP_DEBUG (check:contract 会判红)": async (a) => {
    const txt = fs.readFileSync(OUT, "utf8");
    a.notIncludes(txt, "STARTUP_DEBUG", "产物不得含死开关 STARTUP_DEBUG");
    const argsDesc = (txt.match(/^#!arguments-desc=(.*)$/m) || [])[1] || "";
    a.includes(argsDesc, "ENABLE_STARTUP", "arguments-desc 应声明 ENABLE_STARTUP");
    a.equal((txt.match(/^([A-Z_]+)=switch/m) || [])[1], "ENABLE_STARTUP", "[Argument] 首个 switch 参数");
  },

  // ── NEW-09 part B: ximalaya 插件收敛 ──
  "startup-host: ximalaya 插件无边界不安全 hostname, 且 `*.xima*` 已收敛": async (a) => {
    const m = await load();
    const txt = fs.readFileSync(XIMALAYA, "utf8");
    const hosts = hostnamesOf(txt);
    a.ok(hosts.length > 0, "应解析出 hostname");
    const bad = hosts.filter((h) => m.isBoundaryUnsafe(h));
    a.equal(bad, [], "ximalaya 插件 hostname 不得含边界不安全通配");
    a.equal(hosts.includes("*.xima*.com"), false, "*.xima*.com 应已收敛");
    a.equal(hosts.includes("*.xima*.cn"), false, "*.xima*.cn 应已收敛");
    a.ok(hosts.includes("*.ximalaya.com"), "应收敛为 *.ximalaya.com");
    // 规则侧必须同步出现具体域, 否则 mitm-orphan-check 会把新 hostname 判为孤儿
    a.includes(txt, "ximalaya\\.com", "[Rewrite] 规则应引用具体域 ximalaya.com");
  },

  "startup-host: 全仓库 Plugin/ MitM 清单零边界不安全通配 (防止其它插件回流)": async (a) => {
    const m = await load();
    const dir = path.join(ROOT, "Plugin");
    const offenders = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".plugin"))) {
      for (const h of hostnamesOf(fs.readFileSync(path.join(dir, f), "utf8"))) {
        if (m.isBoundaryUnsafe(h)) offenders.push(`${f}:${h}`);
      }
    }
    a.equal(offenders, [], "Plugin/ 下不得有边界不安全 MitM hostname");
  },

  // ── 入口守卫 ──
  "startup-host: import 不触发 main() / 不改写产物 (入口守卫生效)": async (a) => {
    const before = fs.statSync(OUT).mtimeMs;
    const out = execFileSync(
      process.execPath,
      ["-e", 'import("./tools/build-startup-plugin.mjs").then(() => console.log("IMPORT_OK"));'],
      { cwd: ROOT, encoding: "utf8", timeout: 20000 }
    );
    const after = fs.statSync(OUT).mtimeMs;
    a.equal(out.trim(), "IMPORT_OK", "import 应只输出 IMPORT_OK, 无 main() 副作用");
    a.equal(after, before, "import 不应改写 Plugin/startup-adblock-pro.plugin");
  },
};
