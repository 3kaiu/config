"use strict";
/**
 * 汽水音乐(抖音音乐版)接入台账门禁 — test/cases/soda.test.js
 *
 * 背景: 本 App 的处置**全部来自第三方去广告配置**(没有任何一手响应体样本, 字段名是上游
 * jq/path 表达式里的字面量)。这种来源结构的失效方式是静默的:
 *   ① 后人"看着像漏了"把单来源/无证据的面补进来(例如 /luna/splash 只有一份上游提到,
 *      且本机对 3 个 API host × GET/POST 全 404 ⇒ 写上去就是永不命中的死规则);
 *   ② 把"业务+广告同响应"的接口整条 reject_dict(200) —— 本仓在京东 functionId=start
 *      已经付过白屏的学费;
 *   ③ 新语法没有全局 enable=, 漏写 ${SODA_ENABLE} 的那条等于永久打开(用户关不掉);
 *   ④ 解密面写成通配 `*.qishui.com` ⇒ 整个字节主 App 族进解密面, 且 mitm-orphan 会把
 *      通配判为 generic 恒报孤儿。
 * 本文件把这四条固化成断言。台账与 Plugin/soda.plugin 的注释互为正本 —— 改一处不改另一处
 * 就判红, 不允许"文档说 A、规则写 B"。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const PLUGIN = path.join(ROOT, "Plugin", "soda.plugin");

const text = fs.readFileSync(PLUGIN, "utf8");

/** 取某段的正条目 */
const section = (name) => {
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => l.trim() === `[${name}]`);
  if (i < 0) return [];
  const out = [];
  for (let k = i + 1; k < lines.length; k++) {
    if (/^\[[A-Za-z ]+\]\s*$/.test(lines[k])) break;
    out.push(lines[k]);
  }
  return out;
};

const rewrites = section("Rewrite")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

/**
 * 处置台账 (与插件 [Rewrite] 注释逐条对应)。
 *   mode  reject = 纯广告/纯推广端点 ⇒ reject_dict(200) 整条转空
 *   mode  purge  = 业务+广告同响应     ⇒ 只删广告字段, 字段名必须 ≥2 份上游逐字一致
 * sources 同一处置的上游份数 —— 单来源的面一律停在发现项, 不入此表 (见 UNCERTAIN)。
 */
const LANDED = [
  { needle: "\\/luna\\/ads\\/", mode: "reject", sources: ["kelee", "QingRex", "BOBOLAOSHIV587", "edcjason"] },
  { needle: "\\/luna\\/media_ads\\?", mode: "reject", sources: ["kelee", "ddgksf2013", "BOBOLAOSHIV587", "QingRex"] },
  { needle: "\\/luna\\/commerce\\/upsells_config\\?", mode: "reject", sources: ["kelee", "BOBOLAOSHIV587", "QingRex"] },
  { needle: "\\/luna\\/commerce\\/upsells\\?", mode: "reject", sources: ["kelee", "BOBOLAOSHIV587"] },
  { needle: "\\/luna\\/commerce\\/v2\\/commerce_info\\?", mode: "reject", sources: ["kelee", "BOBOLAOSHIV587", "jnlaoshu"] },
  { needle: "\\/luna\\/treasure\\/entrance\\/config\\?", mode: "reject", sources: ["kelee", "BOBOLAOSHIV587", "QingRex"] },
  { needle: "\\/luna\\/listen-video\\/reminder\\?", mode: "reject", sources: ["kelee", "BOBOLAOSHIV587"] },
  { needle: "\\/webcast\\/openapi\\/feed\\/\\?", mode: "reject", sources: ["kelee", "QingRex", "zirawell", "zira", "fmz200"] },
  { needle: "\\/luna\\/me\\?", mode: "purge", sources: ["kelee", "ddgksf2013", "BOBOLAOSHIV587"] },
  { needle: "\\/luna\\/activities\\?", mode: "purge", sources: ["ddgksf2013", "jnlaoshu", "lihx"] },
  { needle: "\\/luna\\/search-block", mode: "purge", sources: ["ddgksf2013", "lihx"] },
  { needle: "\\/luna\\/card\\?", mode: "purge", sources: ["kelee", "QingRex", "BOBOLAOSHIV587", "jnlaoshu"] },
  { needle: "\\/luna\\/feed\\/song-tab\\?", mode: "purge", sources: ["kelee", "QingRex", "BOBOLAOSHIV587", "ddgksf2013"] },
  { needle: "\\/luna\\/more-panel\\?", mode: "purge", sources: ["kelee", "QingRex", "BOBOLAOSHIV587", "fmz200"] },
  { needle: "\\/luna\\/me\\/recently-played-media\\?", mode: "purge", sources: ["edcjason", "kelee"] },
];

/** 明确**不落地**的发现项 —— 必须不存在对应规则 (防上游误伤回流) */
const UNCERTAIN = [
  { needle: "\\/luna\\/splash", why: "仅 edcjason 一份来源; 本机 3 host × GET/POST 全 404" },
  { needle: "\\/luna\\/hashtag\\/recommend", why: "端点实测 200, 但仅 ddgksf2013 一份按 reject-200, 无字段证据 ⇒ 不得整条拒" },
  { needle: "\\/location\\/info", why: "ddgksf2013/lihx 按 reject-200, 但属 M3 隐私面不是广告面" },
];

exports.tests = {
  "soda: 台账 15 条处置逐条在 [Rewrite] 落地 (且 mode 与 Action 一致)": async (a) => {
    a.ok(rewrites.length >= LANDED.length, `[Rewrite] 正条目 ${rewrites.length} 条, 少于台账 ${LANDED.length} 条`);
    for (const row of LANDED) {
      const hit = rewrites.filter((l) => l.includes(row.needle));
      a.ok(hit.length > 0, `台账里的 ${row.needle} 在 [Rewrite] 无对应规则 (文档与规则脱节)`);
      if (row.mode === "reject") {
        a.ok(
          hit.every((l) => /reject_dict\(200\)$/.test(l)),
          `${row.needle} 是纯广告端点, 应整条 reject_dict(200); 实际: ${hit.join(" | ")}`
        );
      } else {
        a.ok(
          hit.some((l) => /response\.json\.(delete|jq)\(/.test(l)) && hit.every((l) => !/reject/.test(l)),
          `${row.needle} 是业务+广告同响应接口, 只能字段级 delete/jq, 不得整条拒; 实际: ${hit.join(" | ")}`
        );
      }
    }
  },

  "soda: 单来源/无语义证据的发现项不得落地 (防上游误伤回流)": async (a) => {
    for (const u of UNCERTAIN) {
      a.equal(
        rewrites.filter((l) => l.includes(u.needle)).length,
        0,
        `${u.needle} 已写进 [Rewrite] 但依据不足 —— ${u.why}; 要落地须先自行取证并更新 test/cases/soda.test.js 的台账`
      );
    }
  },

  "soda: 业务接口不得被整条拒绝 (京东 functionId=start 白屏同源风险)": async (a) => {
    // 与 LANDED 的 purge 组同源, 但这里**独立**按路径列举 —— 台账若被后人改成 reject 也会被抓
    const business = [
      "\\/luna\\/me\\?",
      "\\/luna\\/activities\\?",
      "\\/luna\\/search-block",
      "\\/luna\\/card\\?",
      "\\/luna\\/feed\\/song-tab\\?",
      "\\/luna\\/more-panel\\?",
      "\\/luna\\/me\\/recently-played-media\\?",
    ];
    const bad = rewrites.filter((l) => /reject/.test(l) && business.some((b) => l.includes(b)));
    a.equal(bad, [], `业务接口被整条拒绝会让页面白屏/缺数据:\n  ${bad.join("\n  ")}`);
  },

  "soda: 每条 Rewrite 必须带开关条件 (新语法无全局 enable=)": async (a) => {
    const missing = rewrites.filter((l) => !/\$\{SODA_ENABLE\} == true/.test(l));
    a.equal(
      missing,
      [],
      `${missing.length} 条 [Rewrite] 漏写 \${SODA_ENABLE} == true —— 新语法没有全局 enable=, 漏写等于该条永久打开:\n  ` +
        missing.join("\n  ")
    );
    // 开关必须在 [Argument] 声明, 且格式能被 tools/app-index.mjs 解析 (带引号形式)
    const arg = section("Argument").filter((l) => l.trim() && !l.trim().startsWith("#"));
    a.ok(
      arg.some((l) => /^SODA_ENABLE=switch,"true","false",/.test(l.trim())),
      "[Argument] 缺少 SODA_ENABLE=switch,\"true\",\"false\" (app-index 只认带引号形式)"
    );
  },

  "soda: 解密面无通配且每个 host 都被 [Rewrite] 消费": async (a) => {
    const mitm = section("MitM").filter((l) => l.trim() && !l.trim().startsWith("#"));
    a.equal(mitm.length, 1, "[MitM] 应恰好一条 hostname= 行");
    const hosts = mitm[0].replace(/^hostname\s*=\s*%APPEND%\s*/, "").split(",").map((s) => s.trim()).filter(Boolean);
    a.ok(hosts.length >= 3, `解密面 host 数异常: ${hosts.length}`);
    for (const h of hosts) {
      a.ok(!h.includes("*"), `解密面出现通配 ${h} —— 通配会被 mitm-orphan 判 generic 恒报孤儿, 且把一个注册域整个拉进解密面`);
      // host 必须真的出现在某条 Rewrite 的 host 部分(允许 host 面向下取分片, 故按 root 比对)
      const root = h.split(".").slice(-2).join(".");
      a.ok(
        rewrites.some((l) => l.includes(root.replace(".", "\\."))),
        `解密面 ${h} 没有任何 [Rewrite] 消费 (mitm-orphan 会判孤儿)`
      );
    }
    // 反面: 主 App 族不得进解密面
    for (const forbidden of ["douyin.com", "snssdk.com", "zijieapi.com", "amemv.com", "qishui.com"]) {
      a.ok(
        !hosts.some((h) => h === forbidden),
        `解密面含 ${forbidden} —— 会把整个字节主 App 族拉进 MitM, 与最小解密面原则相悖`
      );
    }
  },

  "soda: L2 层用 AND 锚定, 无裸 DOMAIN-KEYWORD (官方《子规则》KEYWORD 耗时警告)": async (a) => {
    const rules = section("Rule").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    a.ok(rules.length >= 3, `[Rule] 条目异常: ${rules.length}`);
    for (const l of rules) {
      a.ok(!/^DOMAIN-KEYWORD,/.test(l), `裸 DOMAIN-KEYWORD 由 plugin-lint 判红: ${l}`);
      if (/^AND,/.test(l)) {
        a.ok(/DOMAIN-KEYWORD/.test(l) && /DOMAIN-SUFFIX/.test(l), `AND 规则必须同时被 KEYWORD 与 SUFFIX 锚定: ${l}`);
      }
    }
    // 上游 fmz200 原文的 4 条裸 KEYWORD 里, 只有两条能落到**有证据**的锚点上 —— 其余停发现项
    for (const dom of ["dm.bytedance.com", "dm.pstatp.com", "dm.toutiao.com"]) {
      a.ok(rules.includes(`DOMAIN, ${dom}, REJECT`), `[Rule] 缺少已取证的 ${dom}`);
    }
    a.ok(
      rules.some((l) => l.includes("-ad-sign") && l.includes("byteimg.com")),
      "[Rule] 缺 -ad-sign.byteimg.com 的 AND 锚定规则"
    );
    a.ok(rules.some((l) => l.includes("tnc") && l.includes("zijieapi.com")), "[Rule] 缺 tnc*.zijieapi.com 的自带 HTTPDNS 收编");
  },

  "soda: App 身份与不落地清单必须写在插件头部 (防后人重查一遍)": async (a) => {
    a.ok(text.includes("com.soda.music"), "未记录 iOS bundle id com.soda.music —— 它是 App Store 一手事实(iTunes Lookup 1605585211)");
    a.ok(/com\.luna\.music[\s\S]{0,40}安卓/.test(text), "未说明 com.luna.music 是**安卓**包名 —— 两者混写会导致后续取证张冠李戴");
    for (const u of UNCERTAIN) {
      a.ok(text.includes(u.needle.replace(/\\\//g, "/")), `不落地发现项 ${u.needle} 未在插件注释里留档 —— 后人会当漏项重查`);
    }
    // 路由存活判据必须留档: GET 404 / POST 200 是本次最容易踩的取证陷阱
    a.ok(/POST/.test(text) && /404/.test(text), "未记录'GET 404 而 POST 200'的路由探针陷阱");
  },
};
