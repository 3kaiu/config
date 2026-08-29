/**
 * Loon 规则顺序守卫 — 守护"规则前置顺序"这条不可见不变量。
 *
 * 背景: 本地 [Rule] 段在 Loon 中先于远端规则求值, 且同段内按行序匹配。
 * 顺序错了不会报错, 只会静默失效 (2026-08 教训: 广告硬拦截被挪到 GEOIP 之后 → 全失效)。
 *
 * 2026-08-29 重写 (审计 P1): 原版两项检查锚点已失效 ——
 *   - "DOMAIN-SUFFIX, pangolin-sdk-toutiao.com, DIRECT" (旧白名单) 已按 2026-08-12
 *     用户决策改为 REJECT, 锚点消失 → 守卫永远失败;
 *   - "adsmind.ugdtimg.com, DIRECT" 同理改为 REJECT。
 * 一个永远红且无人执行 (不在 npm test、不在任何 workflow) 的守卫比没有守卫更糟:
 * 它制造"有防护"的错觉。现按现行拓扑重写, 并接入 config-validate.yml。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function linesOf(file) {
  return fs.readFileSync(path.join(root, file), "utf8").split("\n");
}

// 精确行定位 (1-based); 注释行不算命中
function indexOf(lines, exact) {
  const i = lines.findIndex((l) => l.trim() === exact && !l.trim().startsWith("#"));
  return i >= 0 ? i + 1 : -1;
}

let fail = 0;

// 断言 a 在 b 之前 (均为精确规则文本)
function before(file, label, a, b) {
  const lines = linesOf(file);
  const ia = indexOf(lines, a);
  const ib = indexOf(lines, b);
  const ok = ia > 0 && ib > 0 && ia < ib;
  console.log(`${ok ? "✅" : "❌"} ${label}: "${a.split(",")[0]}" @${ia} ${ok ? "<" : "≥"} "${b.split(",")[0]}" @${ib}`);
  return ok ? 0 : 1;
}

// 断言一组规则全部位于锚点之前
function allBefore(file, label, anchor, specs, expectedMin) {
  const lines = linesOf(file);
  const ia = indexOf(lines, anchor);
  const hits = specs.map((s) => indexOf(lines, s)).filter((i) => i > 0);
  const ok = ia > 0 && hits.length >= expectedMin && hits.every((i) => i < ia);
  console.log(`${ok ? "✅" : "❌"} ${label}: ${hits.length} 条 / 需 ≥${expectedMin} (锚点 @${ia}, ${ok ? "全部前置" : "存在后置!"})`);
  return ok ? 0 : 1;
}

const LCF = "Profile/Loon.lcf";

// 1) 广告 SDK 硬拦截必须早于 GEOIP 兜底 (否则国内域被直连截胡)
//    按域名匹配: 同一域名可能以 DOMAIN 或 DOMAIN-SUFFIX 形式出现, 两种都算命中
function allDomainsBefore(file, label, anchor, domains, expectedMin) {
  const lines = linesOf(file);
  const ia = indexOf(lines, anchor);
  const hits = [];
  for (const d of domains) {
    const i = lines.findIndex((l) => /^(DOMAIN|DOMAIN-SUFFIX),\s*/.test(l.trim()) && l.trim().startsWith("DOMAIN") && l.trim().split(",").slice(1).map((x) => x.trim()).includes(d));
    if (i > 0) hits.push(i + 1);
  }
  const ok = ia > 0 && hits.length >= expectedMin && hits.every((i) => i < ia);
  console.log(`${ok ? "✅" : "❌"} ${label}: ${hits.length} 条 / 需 ≥${expectedMin} (锚点 @${ia}, ${ok ? "全部前置" : "存在后置!"})`);
  return ok ? 0 : 1;
}
fail += allDomainsBefore(LCF, "广告 SDK 硬拦截先于 GEOIP 兜底", "GEOIP, CN, DIRECT", [
  "beizi.biz", "adkwai.com", "stats.jpush.cn", "mobads.baidu.com",
  "ugdtimg.com", "adsmind.ugdtimg.com", "api-access.pangolin-sdk-toutiao.com",
], 6);

// 2) 穿山甲: 精确域名 REJECT 先于 SUFFIX 兜底
fail += before(LCF, "穿山甲精确 REJECT 先于 SUFFIX 兜底", "DOMAIN, api-access.pangolin-sdk-toutiao.com, REJECT", "DOMAIN-SUFFIX, pangolin-sdk-toutiao.com, REJECT");

// 3) 优量汇: 同上拓扑
fail += before(LCF, "优量汇精确 REJECT 先于 SUFFIX 兜底", "DOMAIN, adsmind.ugdtimg.com, REJECT", "DOMAIN-SUFFIX, ugdtimg.com, REJECT");

// 4) STUN 白名单先于泛 stun REJECT (否则 WhatsApp/Meet/Zoom 通话被阻断)
fail += allBefore(LCF, "STUN 白名单先于泛 stun REJECT", "DOMAIN-KEYWORD, stun, REJECT", [
  "DOMAIN-SUFFIX, stun.whatsapp.net, Social",
  "DOMAIN, stun.l.google.com, Streaming",
  "DOMAIN, stun.services.mozilla.com, Proxy",
  "DOMAIN-SUFFIX, stun.twilio.com, Proxy",
  "DOMAIN, stun.zoom.us, Proxy",
], 4);

// 5) FINAL 紧随 GEOIP 兜底 (兜底后不得再有业务规则, 否则兜底失效)
fail += before(LCF, "FINAL 紧随 GEOIP 兜底", "GEOIP, CN, DIRECT", "FINAL, Final");
{
  const lines = linesOf(LCF);
  const geo = indexOf(lines, "GEOIP, CN, DIRECT");
  const fin = indexOf(lines, "FINAL, Final");
  const ok = geo > 0 && fin === geo + 1;
  console.log(`${ok ? "✅" : "❌"} GEOIP/FINAL 相邻收尾: GEOIP @${geo}, FINAL @${fin}`);
  fail += ok ? 0 : 1;
}

console.log("");
if (fail) {
  console.log(`❌ 规则守卫失败: ${fail} 项 — 拦截规则顺序被破坏, 禁止合并`);
  process.exit(1);
}
console.log("✅ 规则守卫通过: 拦截区前置、STUN 白名单生效、GEOIP/FINAL 正确收尾");
