/**
 * 广告拦截规则守卫 — 防止"规则被挪到 GEOIP 之后导致全部失效"回归 (2026-08 教训)
 *
 * 背景: 国内广告 SDK 域名的硬拦截必须在 GEOIP,CN,DIRECT 之前,
 * 否则国内域被直连截胡 (插件 [Rule] 与 Remote Rule 均无法拦截, 已验证)。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function rulesBefore(lines, keyword, limit) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(keyword)) return i < limit;
  }
  return false;
}

function check(label, file, anchor, re, expectedMin) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  const lines = text.split("\n");
  const anchorIdx = lines.findIndex((l) => l.includes(anchor));
  const ok = anchorIdx > 0;
  const hits = text.match(re) || [];
  const count = hits.length;
  const allBefore = ok && hits.every((m) => {
    const idx = lines.findIndex((l) => l.includes(m.replace(/,.*$/, "").trim()));
    return idx >= 0 && idx < anchorIdx;
  });
  const pass = ok && count >= expectedMin && allBefore;
  console.log(`${pass ? "✅" : "❌"} ${label}: ${count} 条 (锚点 ${anchor} @行${anchorIdx + 1}, ${allBefore ? "全部前置" : "存在后置!"})`);
  return pass;
}

let fail = 0;
fail += check(
  "Loon 硬拦截区先于 GEOIP",
  "Profile/Loon.lcf",
  "GEOIP, CN, DIRECT",
  /DOMAIN(?:-SUFFIX)?,\s*(?:beizi\.biz|adkwai\.com|api-access\.pangolin-sdk-toutiao\d*\.com|datagw-edge\.alipay\.com|sensors\.umetrip\.com\.cn|stats\.jpush\.cn|mobads\.baidu\.com|ugdtimg\.com)/g,
  8
) ? 0 : 1;

fail += check(
  "QX 硬拦截区先于 geoip",
  "Profile/QX.conf",
  "geoip, cn, direct",
  /host(?:-suffix)?,\s*(?:beizi\.biz|adkwai\.com|api-access\.pangolin-sdk-toutiao\d*\.com|datagw-edge\.alipay\.com|sensors\.umetrip\.com\.cn|stats\.jpush\.cn|mobads\.baidu\.com|ugdtimg\.com)/g,
  8
) ? 0 : 1;

fail += check(
  "Loon 穿山甲 REJECT 先于 SUFFIX DIRECT 白名单",
  "Profile/Loon.lcf",
  "DOMAIN-SUFFIX, pangolin-sdk-toutiao.com, DIRECT",
  /DOMAIN,\s*api-access\.pangolin-sdk-toutiao\d*\.com,\s*REJECT/g,
  2
) ? 0 : 1;

fail += check(
  "Loon 白名单例先后于 REJECT (adsmind.ugdtimg DIRECT 不被 SUFFIX 吞)",
  "Profile/Loon.lcf",
  "DOMAIN-SUFFIX, ugdtimg.com, REJECT",
  /DOMAIN,\s*adsmind\.ugdtimg\.com,\s*DIRECT/g,
  1
) ? 0 : 1;

console.log("");
if (fail) {
  console.log(`❌ 规则守卫失败: ${fail} 项 — 拦截规则顺序被破坏, 禁止合并`);
  process.exit(1);
}
console.log("✅ 规则守卫通过: 拦截区均先于 GEOIP, 白名单顺序正确");
