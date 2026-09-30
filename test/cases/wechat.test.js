"use strict";
/**
 * 微信(WeChat)接入台账门禁 — test/cases/wechat.test.js
 *
 * 背景: 这个 App 的失效方式**与其它 App 不同** —— 不是"字段名猜错", 而是"根本无面可打":
 *   ① 朋友圈/视频号/开屏广告走 MMTLS 私有协议, HTTP 层不可达 ⇒ 后人若"看着像漏了"补域名规则,
 *      补出来的大概率是**死规则**(「朋友圈广告」字面候选域整族已未注册, 五路解析器一致 NXDOMAIN);
 *   ② 名字里带 ad 的活域实测全是**广告主后台/官网**(ad.weixin.qq.com 是微信广告官网 SPA) ⇒
 *      按域名字义拦它零收益且伤官网, 属本仓已犯过的错;
 *   ③ `getappmsgext` 是「业务 + 广告同体」响应(`advertisement_info` 与 `more_read_list` /
 *      `appmsg_album_videos` 并存) ⇒ 整条拒 = 京东 functionId=start 白屏同源风险;
 *   ④ 新语法没有全局 enable=, 漏写 ${WECHAT_ENABLE} 的那条等于永久打开;
 *   ⑤ `mp.weixin.qq.com` 承载全部公众号文章 —— 解密面写成 `*.weixin.qq.com` 会把
 *      channels/open/res/dns 等业务与解析主机一起拉进来, 且通配被 mitm-orphan 判 generic 恒报孤儿。
 * 本文件把五条固化成断言。台账与 Plugin/wechat.plugin 的注释互为正本 —— 改一处不改另一处即判红。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const PLUGIN = path.join(ROOT, "Plugin", "wechat.plugin");

const text = fs.readFileSync(PLUGIN, "utf8");

/** 取某段的正条目(去注释与空行) */
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
 *   mode  reject = 纯推广端点       ⇒ reject_dict(200) 整条转空
 *   mode  purge  = 业务+广告同响应  ⇒ 只净化广告字段, 绝不整条拒
 * sources 同一处置的**独立**上游(去重到作者+字符串); 单来源且无一手证据的面一律停在发现项。
 * 本插件的字段级处置另有**一手样本**支撑(见 ② 的 374B 活响应), 故 sources 允许只列一份上游。
 */
const LANDED = [
  { needle: "\\/mp\\/getappmsgad", mode: "purge", sources: ["NobyDa", "chxm1023"] },
  { needle: "\\/mp\\/getappmsgext", mode: "purge", sources: ["一手探针(2026-09-30 374B 活响应)"] },
  { needle: "\\/mp\\/cps_product_info\\?action", mode: "reject", sources: ["fmz200(奶思)", "QingRex", "zirawell"] },
];

/** 明确**不落地**的发现项 / 已否决面 —— 规则层必须一条都不存在(防上游误伤回流) */
const UNCERTAIN = [
  { needle: "wxsnsdy", why: "小程序广告素材 CDN: 上游多源按域 REJECT + DoH 存活, 但本机对该族 80/443 一律 curl(7) 被本地过滤 ⇒ 拿不到内容级角色证据" },
  { needle: "wxsmsdy", why: "可莉原文的 sm 拼写实测 NXDOMAIN, 被 3 个镜像复制成'多源一致'假象" },
  { needle: "wxsnsad", why: "「朋友圈广告」字面候选域, 五路解析器一致 NXDOMAIN ⇒ 写上去即死规则" },
  { needle: "wxa\\.wxs\\.qq\\.com", why: "同上族; 且 `wxs.qq.com` 后缀拦法会连带拒掉存活的小程序资源子域" },
  { needle: "wxsmw", why: "同上族(15 A 存活, 语义为素材分发) —— 无角色证据不得拦" },
  { needle: "ad\\.weixin\\.qq\\.com", why: "实测是微信广告**官网** SPA, 拦它零收益" },
  { needle: "qpic\\.cn", why: "与本仓 `DOMAIN-SUFFIX, qpic.cn, DIRECT` 跨层矛盾(图床; qidian.qpic.cn 有撤销先例)" },
  { needle: "mmgame", why: "同上 qpic.cn 系, 且有上游自述'mmgame.qpic.cn 是订阅号正文/列表内游戏广告'但本仓已有图床职责" },
  { needle: "masonryfeed", why: "zirawell 整条拒 / QingRex 置 {} —— 但承载相关阅读/推荐内容(非纯广告), 无字段证据" },
  { needle: "relatedarticle", why: "同上" },
  { needle: "relatedsearchword", why: "同上" },
  { needle: "dl\\.wechat\\.com", why: "资源更新检查口; 该域被 blackmatrix7/BOB 当微信本体业务域分流, 收益(去开屏)未验证" },
  { needle: "payapp\\.weixin\\.qq\\.com", why: "上游自相矛盾(zirawell 拒路径 / Kuroba 白名单整域), 且属支付面(M4)" },
  { needle: "finder\\.weixin\\.qq\\.com", why: "045200 的规则已过期(实测 NXDOMAIN)" },
];

/** 业务/内容接口 —— 出现整条 reject 即判红 */
const BUSINESS = ["\\/mp\\/getappmsgext", "\\/mp\\/getappmsgad", "\\/mp\\/profile_ext", "\\/mp\\/homepage", "\\/s\\?__biz="];

exports.tests = {
  "wechat: 台账 3 条处置逐条在 [Rewrite] 落地 (且 mode 与 Action 一致)": async (a) => {
    a.equal(rewrites.length, LANDED.length, `[Rewrite] 正条目 ${rewrites.length} 条, 台账 ${LANDED.length} 条 —— 两者必须逐条对应`);
    for (const row of LANDED) {
      const hit = rewrites.filter((l) => l.includes(row.needle));
      a.ok(hit.length > 0, `台账里的 ${row.needle} 在 [Rewrite] 无对应规则 (文档与规则脱节)`);
      if (row.mode === "reject") {
        a.ok(
          hit.every((l) => /reject_dict\(200\)$/.test(l)),
          `${row.needle} 是纯推广端点, 应整条 reject_dict(200); 实际: ${hit.join(" | ")}`
        );
      } else {
        a.ok(
          hit.every((l) => /response\.json\.(jq|delete|replace)\(/.test(l) && !/reject/.test(l)),
          `${row.needle} 是业务+广告同响应接口, 只能字段级净化, 不得整条拒; 实际: ${hit.join(" | ")}`
        );
      }
    }
  },

  "wechat: 业务/内容接口不得被整条拒绝 (京东 functionId=start 白屏同源风险)": async (a) => {
    // 与 LANDED 的 purge 组同源, 但这里**独立**按路径列举 —— 台账若被后人改成 reject 也会被抓
    const bad = rewrites.filter((l) => /reject/.test(l) && BUSINESS.some((b) => l.includes(b)));
    a.equal(bad, [], `文章/内容接口被整条拒绝会白屏或缺正文:\n  ${bad.join("\n  ")}`);
  },

  "wechat: 无一手/上游证据的面一律不得落地 (防上游误伤回流)": async (a) => {
    for (const u of UNCERTAIN) {
      const hit = rewrites.filter((l) => l.includes(u.needle));
      a.equal(
        hit.length,
        0,
        `${u.needle} 已写进 [Rewrite] 但依据不足 —— ${u.why}; 要落地须先自行取证并更新 test/cases/wechat.test.js 的台账`
      );
    }
  },

  "wechat: 每条 Rewrite 必须带开关条件 (新语法无全局 enable=)": async (a) => {
    const missing = rewrites.filter((l) => !/\$\{WECHAT_ENABLE\} == true/.test(l));
    a.equal(
      missing,
      [],
      `${missing.length} 条 [Rewrite] 漏写 \${WECHAT_ENABLE} == true —— 新语法没有全局 enable=, 漏写等于该条永久打开:\n  ` +
        missing.join("\n  ")
    );
    const arg = section("Argument").filter((l) => l.trim() && !l.trim().startsWith("#"));
    a.ok(
      arg.some((l) => /^WECHAT_ENABLE=switch,"true","false",/.test(l.trim())),
      '[Argument] 缺少 WECHAT_ENABLE=switch,"true","false" (tools/app-index.mjs 只认带引号形式)'
    );
  },

  "wechat: 解密面无通配、被规则消费, 且不含业务/长连接主机": async (a) => {
    const mitm = section("MitM").filter((l) => l.trim() && !l.trim().startsWith("#"));
    a.equal(mitm.length, 1, "[MitM] 应恰好一条 hostname= 行");
    const hosts = mitm[0].replace(/^hostname\s*=\s*%APPEND%\s*/, "").split(",").map((s) => s.trim()).filter(Boolean);
    a.equal(hosts.length, 1, `解密面应只有 mp.weixin.qq.com 一个 host, 实际 ${hosts.length} 个`);
    for (const h of hosts) {
      a.ok(!h.includes("*"), `解密面出现通配 ${h} —— 通配会被 mitm-orphan 判 generic 恒报孤儿, 且把 channels/open/res/dns 一起拉进解密面`);
      a.ok(
        rewrites.some((l) => l.includes("mp\\.weixin\\.qq\\.com")),
        `解密面 ${h} 没有任何 [Rewrite] 消费 (mitm-coverage 会判孤儿)`
      );
    }
    // 反面: 长连接 / 业务与解析主机不得进解密面
    for (const forbidden of ["weixin.qq.com", "qq.com", "wechat.com", "qpic.cn", "gtimg.com", "servicewechat.com"]) {
      a.ok(!hosts.includes(forbidden), `解密面含 ${forbidden} —— 与最小解密面原则相悖`);
    }
    for (const h of hosts) {
      a.ok(
        !/^(long|short|szlong|szshort|szminorshort|szextshort|hklong|hkshort|dns|aedns|channels|open|res)\./.test(h),
        `解密面含长连接/解析/业务主机 ${h}`
      );
    }
  },

  "wechat: App 身份、覆盖天花板与不落地清单必须写在插件头部 (防后人重查一遍)": async (a) => {
    a.ok(text.includes("com.tencent.xin"), "未记录 iOS bundle id com.tencent.xin —— 它是 App Store 一手事实(iTunes Lookup 414478124)");
    a.ok(text.includes("com.tencent.mm"), "未记录安卓包名 com.tencent.mm");
    a.ok(/MMTLS/.test(text), "未记录 MMTLS 这一结构性不可达结论 —— 后人会以为朋友圈广告只是'没写完'");
    a.ok(/NXDOMAIN/.test(text), "未记录'朋友圈候选域整族 NXDOMAIN 五路一致'的负结果 —— 会被当成漏项重复劳动");
    a.ok(/广告主|官网/.test(text) && text.includes("ad.weixin.qq.com"), "未记录 ad.weixin.qq.com 是广告官网(名义陷阱)");
    a.ok(/404/.test(text) && /控制组/.test(text), "未记录路由探针的控制组判据(200=路由存在, 依据是对照组稳定 404)");
    for (const u of UNCERTAIN) {
      const plain = u.needle.replace(/\\\./g, ".").replace(/\\\//g, "/");
      a.ok(text.includes(plain), `不落地发现项 ${plain} 未在插件注释里留档 —— 后人会当漏项重查`);
    }
  },
};
